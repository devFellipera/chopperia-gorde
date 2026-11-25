
(() => {
  "use strict";

  // ==========================================
  // CONFIGURAÇÃO
  // ==========================================

  const cfg = window.GORDE_CONFIG || {};
  const STORAGE_KEY = "gorde_delivery_state";

  const valid =
    typeof cfg.supabaseUrl === "string" &&
    cfg.supabaseUrl.startsWith("https://") &&
    cfg.supabaseUrl.includes(".supabase.co") &&
    typeof cfg.supabaseAnonKey === "string" &&
    cfg.supabaseAnonKey.trim().length > 20;

  const sb = valid && window.supabase
    ? window.supabase.createClient(
        cfg.supabaseUrl,
        cfg.supabaseAnonKey
      )
    : null;

  const $ = id => document.getElementById(id);

  let products = [];
  let cart = [];
  let category = "Todos";
  let savedScroll = 0;
  let restoringPage = false;

  let appliedCoupon = null;
  let savedCouponCode = "";
  let couponRequest = 0;

  // ==========================================
  // FUNÇÕES GERAIS
  // ==========================================

  const money = value =>
    Number(value || 0).toLocaleString("pt-BR", {
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

  function getSubtotal() {
    return cart.reduce(
      (sum, item) =>
        sum + Number(item.price) * item.quantity,
      0
    );
  }

  function showCouponMessage(message, type = "") {
    const element = $("couponMessage");

    if (!element) return;

    element.textContent = message;
    element.className = "fine-print";

    if (type) {
      element.classList.add(type);
    }
  }

  // ==========================================
  // SALVAR ESTADO
  // ==========================================

  function saveState() {
    try {
      const state = {
        category,
        search: $("search")?.value || "",
        scroll: window.scrollY,
        couponCode: appliedCoupon?.code || savedCouponCode || "",
        cart: cart.map(item => ({
          id: item.id,
          quantity: item.quantity
        }))
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

    } catch (error) {
      console.warn("Erro ao salvar estado:", error);
    }
  }

  function loadSavedState() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      category = saved.category || "Todos";
      savedScroll = Number(saved.scroll) || 0;
      savedCouponCode = saved.couponCode || "";

      if ($("search")) {
        $("search").value = saved.search || "";
      }

      return Array.isArray(saved.cart)
        ? saved.cart
        : [];

    } catch (error) {
      console.warn("Erro ao recuperar estado:", error);
      return [];
    }
  }

  const savedCart = loadSavedState();

  // ==========================================
  // RESTAURAR CARRINHO
  // ==========================================

  function restoreCart() {
    cart = savedCart
      .map(savedItem => {
        const product = products.find(
          item => String(item.id) === String(savedItem.id)
        );

        if (!product) return null;

        const quantity = Math.max(
          1,
          Math.floor(Number(savedItem.quantity) || 1)
        );

        return {
          ...product,
          quantity
        };
      })
      .filter(Boolean);

    renderCart();
  }

  // ==========================================
  // RESTAURAR POSIÇÃO DA PÁGINA
  // ==========================================

  function restorePagePosition() {
    restoringPage = true;

    requestAnimationFrame(() => {
      window.scrollTo({
        top: savedScroll,
        behavior: "auto"
      });

      requestAnimationFrame(() => {
        restoringPage = false;
        saveState();
      });
    });
  }

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  window.addEventListener("scroll", () => {
    if (!restoringPage) {
      saveState();
    }
  }, { passive: true });

  window.addEventListener("beforeunload", saveState);

  // ==========================================
  // VALIDAR CUPOM NO SUPABASE
  // ==========================================

  async function applyCoupon(code, silent = false) {
    const normalizedCode = String(code || "")
      .trim()
      .toUpperCase();

    if (!normalizedCode) {
      couponRequest++;
      appliedCoupon = null;
      savedCouponCode = "";

      showCouponMessage("Digite um cupom.", "error");
      renderCart();

      return false;
    }

    if (!sb) {
      showCouponMessage(
        "Erro na conexão com o sistema.",
        "error"
      );

      return false;
    }

    if (!cart.length) {
      appliedCoupon = null;

      showCouponMessage(
        "Adicione produtos antes de aplicar o cupom.",
        "error"
      );

      renderCart();
      return false;
    }

    const subtotal = Number(getSubtotal());

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      appliedCoupon = null;

      showCouponMessage(
        "Subtotal inválido.",
        "error"
      );

      renderCart();
      return false;
    }

    const requestId = ++couponRequest;
    const button = $("applyCoupon");

    if (button) {
      button.disabled = true;
      button.textContent = "VALIDANDO...";
    }

    if (!silent) {
      showCouponMessage("Verificando cupom...");
    }

    try {
      const { data, error } = await sb.rpc(
        "validate_coupon",
        {
          p_code: normalizedCode,
          p_subtotal: subtotal
        }
      );

      // Ignora respostas de tentativas antigas
      if (requestId !== couponRequest) {
        return false;
      }

      if (error) {
        console.error("Erro ao validar cupom:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        appliedCoupon = null;
        savedCouponCode = "";

        showCouponMessage(
          "Não foi possível consultar o cupom.",
          "error"
        );

        renderCart();
        return false;
      }

      console.log("Resultado da validação:", data);

      if (!data || data.valid !== true) {
        appliedCoupon = null;
        savedCouponCode = "";

        showCouponMessage(
          data?.message || "Cupom inválido.",
          "error"
        );

        renderCart();
        return false;
      }

      const discount = Number(data.discount);

      if (!Number.isFinite(discount) || discount <= 0) {
        appliedCoupon = null;
        savedCouponCode = "";

        showCouponMessage(
          "Este cupom não gerou desconto.",
          "error"
        );

        renderCart();
        return false;
      }

      appliedCoupon = {
        code: normalizedCode,
        discount: Math.min(discount, subtotal)
      };

      savedCouponCode = normalizedCode;

      if ($("couponCode")) {
        $("couponCode").value = normalizedCode;
      }

      showCouponMessage(
        `${data.message || "Cupom aplicado!"} Você economizou ${money(appliedCoupon.discount)}.`,
        "success"
      );

      renderCart();

      return true;

    } catch (error) {
      console.error("Falha na validação do cupom:", error);

      if (requestId === couponRequest) {
        appliedCoupon = null;
        savedCouponCode = "";

        showCouponMessage(
          "Erro ao consultar o cupom.",
          "error"
        );

        renderCart();
      }

      return false;

    } finally {
      if (requestId === couponRequest && button) {
        button.disabled = false;
        button.textContent = "APLICAR";
      }
    }
  }

  // ==========================================
  // REVALIDAR CUPOM QUANDO O CARRINHO MUDA
  // ==========================================

  function revalidateAppliedCoupon() {
    if (!appliedCoupon) return;

    const code = appliedCoupon.code;

    if (!cart.length) {
      couponRequest++;
      appliedCoupon = null;
      savedCouponCode = "";

      showCouponMessage(
        "Adicione produtos para usar o cupom.",
        "error"
      );

      renderCart();
      return;
    }

    applyCoupon(code, true);
  }

  // ==========================================
  // BOTÃO APLICAR CUPOM
  // ==========================================

  if ($("applyCoupon")) {
    $("applyCoupon").onclick = () => {
      applyCoupon($("couponCode")?.value || "");
    };
  }

  if ($("couponCode")) {
    $("couponCode").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();

        applyCoupon(
          $("couponCode").value
        );
      }
    });

    $("couponCode").addEventListener("input", () => {
      if (
        appliedCoupon &&
        $("couponCode").value.trim().toUpperCase() !== appliedCoupon.code
      ) {
        couponRequest++;
        appliedCoupon = null;
        savedCouponCode = "";

        showCouponMessage(
          "Aplique novamente para validar o novo código."
        );

        renderCart();
      }
    });
  }

  // ==========================================
  // CARREGAR PRODUTOS
  // ==========================================

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
        esc(error.message) +
        "</p>";

      console.error("Erro ao carregar produtos:", error);

      return;
    }

    products = data || [];

    const categoryExists = products.some(
      product => product.category === category
    );

    if (category !== "Todos" && !categoryExists) {
      category = "Todos";
    }

    renderCategories();
    renderProducts();
    restoreCart();
    restorePagePosition();

    // Recupera o cupom salvo e consulta novamente
    if (savedCouponCode && cart.length) {
      if ($("couponCode")) {
        $("couponCode").value = savedCouponCode;
      }

      await applyCoupon(savedCouponCode, true);

    } else if ($("couponCode")) {
      $("couponCode").value = "";
    }
  }

  // ==========================================
  // CATEGORIAS
  // ==========================================

  function renderCategories() {
    const categories = [
      "Todos",
      ...new Set(
        products
          .map(product => product.category)
          .filter(Boolean)
      )
    ];

    $("categories").innerHTML = categories
      .map(cat => `
        <button
          class="${category === cat ? "active" : ""}"
          data-category="${esc(cat)}"
          type="button"
        >
          ${esc(cat)}
        </button>
      `)
      .join("");

    $("categories")
      .querySelectorAll("[data-category]")
      .forEach(button => {
        button.onclick = () => {
          category = button.dataset.category;

          renderCategories();
          renderProducts();
          saveState();
        };
      });
  }

  // ==========================================
  // PRODUTOS
  // ==========================================

  function renderProducts() {
    const search = $("search").value
      .trim()
      .toLowerCase();

    const filtered = products.filter(product => {
      const matchesCategory =
        category === "Todos" ||
        product.category === category;

      const matchesSearch =
        String(product.name).toLowerCase().includes(search) ||
        String(product.category).toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });

    if (!filtered.length) {
      $("products").innerHTML =
        '<p class="muted">Nenhum produto encontrado.</p>';

      return;
    }

    $("products").innerHTML = filtered
      .map(product => `
        <article class="product-card">
          ${
            product.image_url
              ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}" loading="lazy">`
              : ""
          }

          <div class="product-info">
            <small>${esc(product.category)}</small>

            <h3>${esc(product.name)}</h3>

            <p>${esc(product.description || "")}</p>

            <strong>${money(product.price)}</strong>

            <button
              class="primary"
              data-add="${esc(product.id)}"
              type="button"
            >
              ADICIONAR
            </button>
          </div>
        </article>
      `)
      .join("");

    $("products")
      .querySelectorAll("[data-add]")
      .forEach(button => {
        button.onclick = () => {
          addToCart(button.dataset.add);
        };
      });
  }

  // ==========================================
  // ADICIONAR PRODUTO
  // ==========================================

  function addToCart(id) {
    const product = products.find(
      item => String(item.id) === String(id)
    );

    if (!product) return;

    const item = cart.find(
      cartItem => String(cartItem.id) === String(id)
    );

    if (item) {
      item.quantity++;
    } else {
      cart.push({
        ...product,
        quantity: 1
      });
    }

    renderCart();
    revalidateAppliedCoupon();
  }

  // ==========================================
  // RENDERIZAR CARRINHO
  // ==========================================
function renderCart() {
  const count = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const subtotal = getSubtotal();
  const fee = Number(cfg.deliveryFee) || 0;

  const discount = Math.min(
    Number(appliedCoupon?.discount) || 0,
    subtotal
  );

  const total = Math.max(
    0,
    subtotal - discount + fee
  );

  $("cartBar").hidden = count === 0;

  $("cartCount").textContent = `${count} itens`;
  $("cartTotal").textContent = money(subtotal);

  $("cartItems").innerHTML = cart
    .map(item => `
      <div class="cart-item">
        <div>
          <b>${esc(item.name)}</b>
          <small>${money(item.price)} × ${item.quantity}</small>
        </div>

        <div>
          <button data-minus="${esc(item.id)}" type="button">−</button>
          <button data-plus="${esc(item.id)}" type="button">+</button>
        </div>
      </div>
    `)
    .join("");

  $("cartItems")
    .querySelectorAll("[data-minus]")
    .forEach(button => {
      button.onclick = () => {
        changeQuantity(button.dataset.minus, -1);
      };
    });

  $("cartItems")
    .querySelectorAll("[data-plus]")
    .forEach(button => {
      button.onclick = () => {
        changeQuantity(button.dataset.plus, 1);
      };
    });

  $("subtotal").textContent = money(subtotal);
  $("delivery").textContent = money(fee);

  if ($("discount")) {
    $("discount").textContent = `- ${money(discount)}`;
  }

  if ($("discountRow")) {
    $("discountRow").hidden = discount <= 0;
  }

  $("grandTotal").textContent = money(total);

  saveState();
}


  // ==========================================
  // ALTERAR QUANTIDADE
  // ==========================================

  function changeQuantity(id, amount) {
    const item = cart.find(
      product => String(product.id) === String(id)
    );

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
      cart = cart.filter(
        product => String(product.id) !== String(id)
      );
    }

    renderCart();
    revalidateAppliedCoupon();
  }

  // ==========================================
  // PESQUISA
  // ==========================================

  $("search").addEventListener("input", () => {
    renderProducts();
    saveState();
  });

  // ==========================================
  // ABRIR E FECHAR CARRINHO
  // ==========================================

  $("openCart").onclick = () => {
    $("cartModal").hidden = false;
  };

  $("closeCart").onclick = () => {
    $("cartModal").hidden = true;
  };

  // ==========================================
  // FINALIZAR PEDIDO
  // ==========================================

  $("checkoutForm").onsubmit = async event => {
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

    // Revalida o cupom antes de montar o pedido
    if (appliedCoupon) {
      const code = appliedCoupon.code;

      const validCoupon = await applyCoupon(code, true);

      if (!validCoupon) {
        alert(
          "Não foi possível confirmar seu cupom. Verifique o código e tente novamente."
        );

        return;
      }
    }

    const subtotal = getSubtotal();
    const fee = Number(cfg.deliveryFee) || 0;

    const discount = Math.min(
      Number(appliedCoupon?.discount) || 0,
      subtotal
    );

    const total = Math.max(
      0,
      subtotal - discount + fee
    );

    let message = `*PEDIDO - CHOPPERIA GORDE*\n\n`;

    message += `*Cliente:* ${name}\n`;
    message += `*Endereço:* ${address}\n\n`;

    message += `*PRODUTOS:*\n`;

    cart.forEach(item => {
      message += `${item.quantity}x ${item.name} - ${money(item.price * item.quantity)}\n`;
    });

    message += `\nSubtotal: ${money(subtotal)}`;

    if (appliedCoupon && discount > 0) {
      message += `\nCupom: ${appliedCoupon.code}`;
      message += `\nDesconto: - ${money(discount)}`;
    }

    message += `\nEntrega: ${money(fee)}`;
    message += `\n*TOTAL: ${money(total)}*`;
    message += `\nPagamento: ${payment}`;

    if (notes) {
      message += `\nObservações: ${notes}`;
    }

    const phone = String(cfg.whatsapp || "")
      .replace(/\D/g, "");

    if (!phone) {
      alert("Configure o WhatsApp no config.js.");
      return;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  // ==========================================
  // INICIAR SISTEMA
  // ==========================================

  loadProducts();

})();
          
