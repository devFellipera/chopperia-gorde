
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
  let coupons = [];
  let selectedCategory = "all";

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

  function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function normalizeCategory(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("pt-BR");
  }

  function localDateTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
      .toISOString()
      .slice(0, 16);
  }

  // SESSÃO
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

    await Promise.all([
      loadProducts(),
      loadCoupons()
    ]);
  }

  // ABAS
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      document.querySelectorAll("[data-tab]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      $("productsSection").hidden = tab !== "products";
      $("couponsSection").hidden = tab !== "coupons";
    });
  });

  // =========================
  // PRODUTOS
  // =========================

  async function loadProducts() {
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
    renderProducts();
  }

  function renderProducts() {
    const filter = $("categoryFilter");
    const categoriesMap = new Map();

    products.forEach(product => {
      const category = String(product.category || "").trim();

      if (category) {
        const key = normalizeCategory(category);

        if (!categoriesMap.has(key)) {
          categoriesMap.set(key, category);
        }
      }
    });

    const categories = [...categoriesMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

    if (
      selectedCategory !== "all" &&
      !categoriesMap.has(selectedCategory)
    ) {
      selectedCategory = "all";
    }

    filter.innerHTML = `
      <option value="all">Todas as categorias</option>
      ${categories.map(([key, category]) => `
        <option value="${esc(key)}">${esc(category)}</option>
      `).join("")}
    `;

    filter.value = selectedCategory;

    renderFilteredProducts();
  }

  function renderFilteredProducts() {
    const filtered = selectedCategory === "all"
      ? products
      : products.filter(product =>
          normalizeCategory(product.category) === selectedCategory
        );

    $("adminProducts").innerHTML = filtered.length
      ? filtered.map(product => `
          <div class="admin-product">
            <div>
              <b>${esc(product.name)}</b>
              <small>
                ${esc(product.category)}
                · ${money(product.price)}
                · ${product.available ? "Disponível" : "Indisponível"}
              </small>
            </div>

            <div class="admin-actions">
              <button
                data-edit-product="${esc(product.id)}"
                class="secondary small"
                type="button"
              >Editar</button>

              <button
                data-delete-product="${esc(product.id)}"
                class="danger small"
                type="button"
              >Excluir</button>
            </div>
          </div>
        `).join("")
      : '<p class="muted">Nenhum produto encontrado nesta categoria.</p>';

    $("adminProducts").querySelectorAll("[data-edit-product]")
      .forEach(button => {
        button.onclick = () => editProduct(button.dataset.editProduct);
      });

    $("adminProducts").querySelectorAll("[data-delete-product]")
      .forEach(button => {
        button.onclick = () => deleteProduct(button.dataset.deleteProduct);
      });
  }

  function editProduct(id) {
    const product = products.find(item =>
      String(item.id) === String(id)
    );

    if (!product) return;

    $("productId").value = product.id;
    $("pName").value = product.name || "";
    $("pCategory").value = product.category || "";
    $("pPrice").value = product.price;
    $("pDescription").value = product.description || "";
    $("pImage").value = product.image_url || "";
    $("pAvailable").checked = product.available;

    $("formTitle").textContent = "Editar produto";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearProductForm() {
    $("productForm").reset();
    $("productId").value = "";
    $("pAvailable").checked = true;
    $("formTitle").textContent = "Adicionar produto";
  }

  const clearFormButton = $("clearForm");

if (clearFormButton) {
  clearFormButton.onclick = clearProductForm;
}

  $("categoryFilter").addEventListener("change", event => {
    selectedCategory = event.target.value;
    renderFilteredProducts();
  });

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
        ? await sb.from("products")
            .update(row)
            .eq("id", id)
            .select()
            .maybeSingle()
        : await sb.from("products")
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

      clearProductForm();
      await loadProducts();
      msg("Produto salvo com sucesso!");

    } catch (error) {
      msg("Erro: " + error.message);
    } finally {
      button.disabled = false;
    }
  };

  async function deleteProduct(id) {
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

    await loadProducts();
    msg("Produto excluído com sucesso!");
  }

  // =========================
  // CUPONS
  // =========================

  async function loadCoupons() {
    const { data, error } = await sb
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      $("adminCoupons").innerHTML =
        '<p class="muted">Não foi possível carregar os cupons. Confira se executou o SQL.</p>';

      console.error("Erro ao carregar cupons:", error);
      return;
    }

    coupons = data || [];
    renderCoupons();
  }

  function renderCoupons() {
    $("adminCoupons").innerHTML = coupons.length
      ? coupons.map(coupon => {
          const discount = coupon.discount_type === "percentage"
            ? `${Number(coupon.discount_value)}%`
            : money(coupon.discount_value);

          const usage = coupon.usage_limit
            ? `${coupon.usage_count || 0} / ${coupon.usage_limit} usos`
            : `${coupon.usage_count || 0} usos`;

          const expired = coupon.expires_at &&
            new Date(coupon.expires_at) < new Date();

          const status = !coupon.active
            ? "Inativo"
            : expired
              ? "Expirado"
              : "Ativo";

          return `
            <div class="admin-product">
              <div>
                <b>${esc(coupon.code)}</b>
                <small>
                  Influenciador: ${esc(coupon.influencer_name)}
                  · Desconto: ${discount}
                  · Comissão: ${Number(coupon.commission_percent)}%
                </small>
                <small>
                  Pedido mínimo: ${money(coupon.min_order)}
                  · ${usage}
                  · ${status}
                </small>
              </div>

              <div class="admin-actions">
                <button
                  data-edit-coupon="${esc(coupon.id)}"
                  class="secondary small"
                  type="button"
                >Editar</button>

                <button
                  data-toggle-coupon="${esc(coupon.id)}"
                  class="secondary small"
                  type="button"
                >${coupon.active ? "Desativar" : "Ativar"}</button>

                <button
                  data-delete-coupon="${esc(coupon.id)}"
                  class="danger small"
                  type="button"
                >Excluir</button>
              </div>
            </div>
          `;
        }).join("")
      : '<p class="muted">Nenhum cupom cadastrado ainda.</p>';

    $("adminCoupons").querySelectorAll("[data-edit-coupon]")
      .forEach(button => {
        button.onclick = () => editCoupon(button.dataset.editCoupon);
      });

    $("adminCoupons").querySelectorAll("[data-toggle-coupon]")
      .forEach(button => {
        button.onclick = () => toggleCoupon(button.dataset.toggleCoupon);
      });

    $("adminCoupons").querySelectorAll("[data-delete-coupon]")
      .forEach(button => {
        button.onclick = () => deleteCoupon(button.dataset.deleteCoupon);
      });
  }

  function editCoupon(id) {
    const coupon = coupons.find(item =>
      String(item.id) === String(id)
    );

    if (!coupon) return;

    $("couponId").value = coupon.id;
    $("cCode").value = coupon.code || "";
    $("cInfluencer").value = coupon.influencer_name || "";
    $("cDiscountType").value = coupon.discount_type || "percentage";
    $("cDiscountValue").value = coupon.discount_value;
    $("cCommission").value = coupon.commission_percent;
    $("cMinOrder").value = coupon.min_order;
    $("cMaxDiscount").value = coupon.max_discount ?? "";
    $("cUsageLimit").value = coupon.usage_limit ?? "";
    $("cExpiresAt").value = localDateTime(coupon.expires_at);
    $("cActive").checked = coupon.active;

    $("couponFormTitle").textContent = "Editar cupom";

    document.querySelector('[data-tab="coupons"]').click();

    $("couponForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function clearCouponForm() {
    $("couponForm").reset();

    $("couponId").value = "";
    $("cDiscountType").value = "percentage";
    $("cDiscountValue").value = 10;
    $("cCommission").value = 20;
    $("cMinOrder").value = 30;
    $("cActive").checked = true;

    $("couponFormTitle").textContent = "Criar cupom";
  }

  $("clearCouponForm").onclick = clearCouponForm;

  $("couponForm").onsubmit = async event => {
    event.preventDefault();

    if (!sb) return;

    const code = $("cCode").value.trim().toUpperCase();
    const influencer = $("cInfluencer").value.trim();
    const discountType = $("cDiscountType").value;
    const discountValue = Number($("cDiscountValue").value);
    const commission = Number($("cCommission").value);
    const minOrder = Number($("cMinOrder").value);

    const maxDiscount = $("cMaxDiscount").value === ""
      ? null
      : Number($("cMaxDiscount").value);

    const usageLimit = $("cUsageLimit").value === ""
      ? null
      : Number($("cUsageLimit").value);

    const expiresInput = $("cExpiresAt").value;
    const expiresAt = expiresInput
      ? new Date(expiresInput).toISOString()
      : null;

    if (!code || !influencer) {
      msg("Informe o código e o nome do influenciador.");
      return;
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      msg("Informe um desconto válido.");
      return;
    }

    if (
      !Number.isFinite(commission) ||
      commission < 0 ||
      commission > 100
    ) {
      msg("A comissão deve ficar entre 0% e 100%.");
      return;
    }

    if (!Number.isFinite(minOrder) || minOrder < 0) {
      msg("Informe um pedido mínimo válido.");
      return;
    }

    if (
      maxDiscount !== null &&
      (!Number.isFinite(maxDiscount) || maxDiscount <= 0)
    ) {
      msg("O desconto máximo precisa ser maior que zero.");
      return;
    }

    if (
      usageLimit !== null &&
      (!Number.isInteger(usageLimit) || usageLimit < 1)
    ) {
      msg("O limite de utilizações deve ser um número inteiro maior que zero.");
      return;
    }

    if (expiresInput && Number.isNaN(new Date(expiresInput).getTime())) {
      msg("A data de validade é inválida.");
      return;
    }

    const row = {
      code,
      influencer_name: influencer,
      discount_type: discountType,
      discount_value: discountValue,
      commission_percent: commission,
      min_order: minOrder,
      max_discount: maxDiscount,
      usage_limit: usageLimit,
      expires_at: expiresAt,
      active: $("cActive").checked
    };

    const id = $("couponId").value;
    const button = $("couponForm").querySelector('[type="submit"]');

    button.disabled = true;

    try {
      const result = id
        ? await sb.from("coupons")
            .update(row)
            .eq("id", id)
            .select()
            .maybeSingle()
        : await sb.from("coupons")
            .insert(row)
            .select()
            .single();

      if (result.error) {
        if (result.error.code === "23505") {
          msg("Esse código já está cadastrado. Escolha outro.");
        } else {
          msg("Erro ao salvar cupom: " + result.error.message);
        }
        return;
      }

      if (id && !result.data) {
        msg("Nenhum cupom foi atualizado. Verifique as permissões.");
        return;
      }

      clearCouponForm();
      await loadCoupons();
      msg("Cupom salvo com sucesso!");

    } catch (error) {
      msg("Erro ao salvar cupom: " + error.message);
    } finally {
      button.disabled = false;
    }
  };

  async function toggleCoupon(id) {
    const coupon = coupons.find(item =>
      String(item.id) === String(id)
    );

    if (!coupon) return;

    const action = coupon.active ? "desativar" : "ativar";

    if (!confirm(`Deseja ${action} o cupom ${coupon.code}?`)) {
      return;
    }

    const { error } = await sb
      .from("coupons")
      .update({ active: !coupon.active })
      .eq("id", id);

    if (error) {
      msg("Erro ao alterar cupom: " + error.message);
      return;
    }

    await loadCoupons();
    msg(`Cupom ${coupon.active ? "desativado" : "ativado"} com sucesso!`);
  }

  async function deleteCoupon(id) {
    const coupon = coupons.find(item =>
      String(item.id) === String(id)
    );

    if (!coupon) return;

    if (!confirm(`Excluir definitivamente o cupom ${coupon.code}?`)) {
      return;
    }

    const { data, error } = await sb
      .from("coupons")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      msg("Erro ao excluir cupom: " + error.message);
      return;
    }

    if (!data || !data.length) {
      msg("Cupom não excluído. Verifique as permissões.");
      return;
    }

    await loadCoupons();
    msg("Cupom excluído com sucesso!");
  }

  // =========================
  // LOGIN E LOGOUT
  // =========================

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


  // =========================
  // ABAS - MANTER ÚLTIMA ABA
  // =========================

  function activateTab(tab) {
    const selectedTab = tab === "coupons" ? "coupons" : "products";

    document.querySelectorAll("[data-tab]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.tab === selectedTab
      );
    });

    const productsSection = $("productsSection");
    const couponsSection = $("couponsSection");

    if (productsSection) {
      productsSection.hidden = selectedTab !== "products";
    }

    if (couponsSection) {
      couponsSection.hidden = selectedTab !== "coupons";
    }

    localStorage.setItem("gorde_admin_tab", selectedTab);
  }

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  });

  // Recupera a última aba escolhida
  const savedTab = localStorage.getItem("gorde_admin_tab") || "products";
  activateTab(savedTab);



  // INICIAR
  session();
})();
