
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

  async function show() {
    $("loginPanel").hidden = true;
    $("dashboard").hidden = false;
    await load();
  }

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

  function render() {
    $("adminProducts").innerHTML = products.length
      ? products.map(p => `
        <div class="admin-product">
          <div>
            <b>${esc(p.name)}</b>
            <small>
              ${esc(p.category)} · R$ ${Number(p.price).toFixed(2).replace(".", ",")}
              · ${p.available ? "Disponível" : "Indisponível"}
            </small>
          </div>
          <div class="admin-actions">
            <button data-edit="${esc(p.id)}" class="secondary small">Editar</button>
            <button data-delete="${esc(p.id)}" class="danger small">Excluir</button>
          </div>
        </div>
      `).join("")
      : '<p class="muted">Nenhum produto cadastrado ainda.</p>';

    $("adminProducts").querySelectorAll("[data-edit]").forEach(button => {
      button.onclick = () => edit(button.dataset.edit);
    });

    $("adminProducts").querySelectorAll("[data-delete]").forEach(button => {
      button.onclick = () => del(button.dataset.delete);
    });
  }

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

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clear() {
    $("productForm").reset();
    $("productId").value = "";
    $("pAvailable").checked = true;
    $("formTitle").textContent = "Adicionar produto";
  }

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

  $("clearForm").onclick = clear;

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

    if (!row.name || !row.category || !Number.isFinite(row.price) || row.price <= 0) {
      msg("Preencha nome, categoria e preço válido.");
      return;
    }

    const id = $("productId").value;
    const button = $("productForm").querySelector('[type="submit"]');

    button.disabled = true;

    try {
      const result = id
        ? await sb.from("products").update(row).eq("id", id).select().maybeSingle()
        : await sb.from("products").insert(row).select().single();

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

  session();
})();
