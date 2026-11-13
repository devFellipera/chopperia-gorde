
(() => {
  const cfg = window.GORDE_CONFIG || {};

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
  let selectedCategory = "all";

  // Normalizar categorias para evitar erros de comparação
  function normalizeCategory(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("pt-BR");
  }

  function msg(text) {
    alert(text);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  // VERIFICAR SESSÃO
  async function session() {
    if (!sb) {
      msg("Erro na configuração do Supabase. Confira o config.js.");
      return;
    }

    const { data, error } = await sb.auth.getSession();

    if (error) {
      msg(error.message);
      return;
    }

    if (data.session) {
      await show();
    }
  }

  // MOSTRAR PAINEL
  async function show() {
    $("loginPanel").hidden = true;
    $("dashboard").hidden = false;
    await load();
  }

  // CARREGAR PRODUTOS
  async function load() {
    const { data, error } = await sb
      .from("products")
      .select("*")
      .order("category")
      .order("name");

    if (error) {
      msg("Erro ao carregar produtos: " + error.message);
      return;
    }

    products = data || [];
    render();
  }

  // ATUALIZAR FILTRO E CATEGORIAS
  function render() {
    const filter = $("categoryFilter");

    if (!filter) {
      console.error("Elemento categoryFilter não encontrado no HTML.");
      return;
    }

    // Buscar categorias únicas
    const categoriesMap = new Map();

    products.forEach(p => {
      const category = String(p.category || "").trim();

      if (category) {
        const key = normalizeCategory(category);

        if (!categoriesMap.has(key)) {
          categoriesMap.set(key, category);
        }
      }
    });

    const categories = [...categoriesMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

    // Se a categoria não existir mais, voltar para todas
    if (
      selectedCategory !== "all" &&
      !categoriesMap.has(selectedCategory)
    ) {
      selectedCategory = "all";
    }

    // Atualizar opções sem perder a seleção
    filter.innerHTML = `
      <option value="all">Todas as categorias</option>

      ${categories.map(([key, category]) => `
        <option value="${esc(key)}">
          ${esc(category)}
        </option>
      `).join("")}
    `;

    filter.value = selectedCategory;

    // Mostrar produtos filtrados
    renderFilteredProducts();
  }

  // FILTRAR E EXIBIR PRODUTOS
  function renderFilteredProducts() {
    const filteredProducts = selectedCategory === "all"
      ? products
      : products.filter(p =>
          normalizeCategory(p.category) === selectedCategory
        );

    $("adminProducts").innerHTML = filteredProducts.length
      ? filteredProducts.map(p => `
          <div class="admin-product">
            <div>
              <b>${esc(p.name)}</b>

              <small>
                ${esc(p.category)}
                · R$ ${Number(p.price).toFixed(2).replace(".", ",")}
                · ${p.available ? "Disponível" : "Indisponível"}
              </small>
            </div>

            <div class="admin-actions">
              <button
                data-edit="${esc(p.id)}"
                class="secondary small"
                type="button"
              >
                Editar
              </button>

              <button
                data-delete="${esc(p.id)}"
                class="danger small"
                type="button"
              >
                Excluir
              </button>
            </div>
          </div>
        `).join("")
      : '<p class="muted">Nenhum produto encontrado nesta categoria.</p>';

    // Eventos de edição
    $("adminProducts").querySelectorAll("[data-edit]").forEach(button => {
      button.onclick = () => edit(button.dataset.edit);
    });

    // Eventos de exclusão
    $("adminProducts").querySelectorAll("[data-delete]").forEach(button => {
      button.onclick = () => del(button.dataset.delete);
    });
  }

  // EDITAR PRODUTO
  function edit(id) {
    const p = products.find(item => String(item.id) === String(id));

    if (!p) return;

    $("productId").value = p.id;
    $("pName").value = p.name || "";
    $("pCategory").value = p.category || "";
    $("pPrice").value = p.price;
    $("pDescription").value = p.description || "";
    $("pImage").value = p.image_url || "";
    $("pAvailable").checked = p.available;

    $("formTitle").textContent = "Editar produto";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // LIMPAR FORMULÁRIO
  function clear() {
    $("productForm").reset();

    $("productId").value = "";
    $("pAvailable").checked = true;

    $("formTitle").textContent = "Adicionar produto";
  }

  // LOGIN
  $("loginForm").onsubmit = async event => {
    event.preventDefault();

    if (!sb) return;

    const { error } = await sb.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) {
      msg("Erro no login: " + error.message);
    } else {
      await show();
    }
  };

  // SAIR
  $("logout").onclick = async () => {
    if (!sb) return;

    const { error } = await sb.auth.signOut();

    if (error) {
      msg(error.message);
      return;
    }

    $("dashboard").hidden = true;
    $("loginPanel").hidden = false;
  };

  // BOTÃO LIMPAR
  $("clearForm").onclick = clear;

  // EVENTO DO FILTRO DE CATEGORIAS
  $("categoryFilter").addEventListener("change", event => {
    selectedCategory = event.target.value;

    renderFilteredProducts();
  });

  // SALVAR OU ATUALIZAR PRODUTO
  $("productForm").onsubmit = async event => {
    event.preventDefault();

    if (!sb) return;

    const row = {
      name: $("pName").value.trim(),
      category: $("pCategory").value.trim(),
      price: Number($("pPrice").value),
      description: $("pDescription").value.trim(),
      image_url: $("pImage").value.trim() || null,
      available: $("pAvailable").checked
    };

    if (
      !row.name ||
      !row.category ||
      !Number.isFinite(row.price) ||
      row.price <= 0
    ) {
      msg("Preencha nome, categoria e preço válido.");
      return;
    }

    const id = $("productId").value;

    const button = $("productForm").querySelector('[type="submit"]');

    button.disabled = true;

    try {
      const result = id
        ? await sb
            .from("products")
            .update(row)
            .eq("id", id)
            .select()
            .maybeSingle()
        : await sb
            .from("products")
            .insert(row)
            .select()
            .single();

      if (result.error) {
        msg("Erro ao salvar: " + result.error.message);
        return;
      }

      if (id && !result.data) {
        msg("Nenhum produto foi atualizado. Verifique as permissões.");
        return;
      }

      clear();

      await load();

      msg("Produto salvo com sucesso!");

    } catch (error) {
      msg("Erro: " + error.message);

    } finally {
      button.disabled = false;
    }
  };

  // EXCLUIR PRODUTO
  async function del(id) {
    if (!sb || !confirm("Excluir este produto?")) return;

    const { data, error } = await sb
      .from("products")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      msg("Erro ao excluir: " + error.message);
      return;
    }

    if (!data || !data.length) {
      msg("Produto não excluído. Verifique as permissões.");
      return;
    }

    await load();

    msg("Produto excluído com sucesso!");
  }

  // INICIAR PAINEL
  session();

})();
