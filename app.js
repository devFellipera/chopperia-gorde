
(() => {
  const cfg = window.GORDE_CONFIG || {};

  const valid =
    typeof cfg.supabaseUrl === "string" &&
    cfg.supabaseUrl.startsWith("https://") &&
    cfg.supabaseUrl.includes(".supabase.co") &&
    typeof cfg.supabaseAnonKey === "string" &&
    cfg.supabaseAnonKey.trim().length > 20;

  const sb = valid && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;

  const $ = id => document.getElementById(id);

  let products = [];
  let cart = [];
  let category = "Todos";

  const money = value =>
    Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  async function loadProducts() {
    if (!sb) {
      $("products").innerHTML =
        '<p class="muted">Erro na configuração do Supabase.</p>';
      return;
    }

    $("products").innerHTML =
      '<p class="muted">Carregando produtos...</p>';

    const { data, error } = await sb
      .from("products")
      .select("*")
      .eq("available", true)
      .order("category")
      .order("name");

    if (error) {
      $("products").innerHTML =
        '<p class="muted">Erro ao carregar produtos: ' +
        esc(error.message) + "</p>";
      return;
    }

    products = data || [];
    renderCategories();
    renderProducts();
  }

  function renderCategories() {
    const categories = [
      "Todos",
      ...new Set(products.map(p => p.category).filter(Boolean))
    ];

    $("categories").innerHTML = categories.map(cat => `
      <button class="${category === cat ? "active" : ""}"
        data-category="${esc(cat)}">
        ${esc(cat)}
      </button>
    `).join("");

    $("categories").querySelectorAll("[data-category]").forEach(button => {
      button.onclick = () => {
        category = button.dataset.category;
        renderCategories();
        renderProducts();
      };
    });
  }

  function renderProducts() {
    const search = $("search").value.trim().toLowerCase();

    const filtered = products.filter(p => {
      const matchesCategory =
        category === "Todos" || p.category === category;

      const matchesSearch =
        String(p.name).toLowerCase().includes(search) ||
        String(p.category).toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });

    if (!filtered.length) {
      $("products").innerHTML =
        '<p class="muted">Nenhum produto encontrado.</p>';
      return;
    }

    $("products").innerHTML = filtered.map(p => `
      <article class="product-card">
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`
          : ""}
        <div class="product-info">
          <small>${esc(p.category)}</small>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description || "")}</p>
          <strong>${money(p.price)}</strong>
          <button class="primary" data-add="${esc(p.id)}">
            ADICIONAR
          </button>
        </div>
      </article>
    `).join("");

    $("products").querySelectorAll("[data-add]").forEach(button => {
      button.onclick = () => addToCart(button.dataset.add);
    });
  }

  function addToCart(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;

    const item = cart.find(p => String(p.id) === String(id));

    if (item) {
      item.quantity++;
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    renderCart();
  }

  function renderCart() {
    const count = cart.reduce((sum, p) => sum + p.quantity, 0);
    const subtotal = cart.reduce(
      (sum, p) => sum + Number(p.price) * p.quantity, 0
    );

    $("cartBar").hidden = count === 0;
    $("cartCount").textContent = `${count} itens`;
    $("cartTotal").textContent = money(subtotal);

    $("cartItems").innerHTML = cart.map(p => `
      <div class="cart-item">
        <div>
          <b>${esc(p.name)}</b>
          <small>${money(p.price)} × ${p.quantity}</small>
        </div>
        <div>
          <button data-minus="${esc(p.id)}">−</button>
          <button data-plus="${esc(p.id)}">+</button>
        </div>
      </div>
    `).join("");

    $("cartItems").querySelectorAll("[data-minus]").forEach(button => {
      button.onclick = () => changeQuantity(button.dataset.minus, -1);
    });

    $("cartItems").querySelectorAll("[data-plus]").forEach(button => {
      button.onclick = () => changeQuantity(button.dataset.plus, 1);
    });

    const fee = Number(cfg.deliveryFee) || 0;

    $("subtotal").textContent = money(subtotal);
    $("delivery").textContent = money(fee);
    $("grandTotal").textContent = money(subtotal + fee);
  }

  function changeQuantity(id, amount) {
    const item = cart.find(p => String(p.id) === String(id));
    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
      cart = cart.filter(p => String(p.id) !== String(id));
    }

    renderCart();
  }

  $("search").addEventListener("input", renderProducts);

  $("openCart").onclick = () => {
    $("cartModal").hidden = false;
  };

  $("closeCart").onclick = () => {
    $("cartModal").hidden = true;
  };

  $("checkoutForm").onsubmit = event => {
    event.preventDefault();

    if (!cart.length) {
      alert("Seu carrinho está vazio.");
      return;
    }

    const name = $("customerName").value.trim();
    const address = $("customerAddress").value.trim();
    const payment = $("payment").value;
    const notes = $("notes").value.trim();

    if (!name || !address) {
      alert("Preencha seu nome e endereço.");
      return;
    }

    const subtotal = cart.reduce(
      (sum, p) => sum + Number(p.price) * p.quantity, 0
    );

    const fee = Number(cfg.deliveryFee) || 0;
    const total = subtotal + fee;

    let message = `*PEDIDO - CHOPPERIA GORDE*\n\n`;
    message += `*Cliente:* ${name}\n`;
    message += `*Endereço:* ${address}\n\n`;
    message += `*PRODUTOS:*\n`;

    cart.forEach(p => {
      message += `${p.quantity}x ${p.name} - ${money(p.price * p.quantity)}\n`;
    });

    message += `\nSubtotal: ${money(subtotal)}`;
    message += `\nEntrega: ${money(fee)}`;
    message += `\n*TOTAL: ${money(total)}*`;
    message += `\nPagamento: ${payment}`;

    if (notes) {
      message += `\nObservações: ${notes}`;
    }

    const phone = String(cfg.whatsapp || "").replace(/\D/g, "");

    if (!phone) {
      alert("Configure o WhatsApp no config.js.");
      return;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  loadProducts();
})();
