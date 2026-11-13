<<<<<<< HEAD

(() => {
  const cfg = window.GORDE_CONFIG || {};

  const valid =
    cfg.supabaseUrl &&
    cfg.supabaseAnonKey;

  const sb = valid && window.supabase
    ? window.supabase.createClient(
        cfg.supabaseUrl,
        cfg.supabaseAnonKey
      )
    : null;

  const $ = id => document.getElementById(id);

  let products = [];

  function msg(text) {
    alert(text);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  // Verificar conexão e sessão
  async function session() {
    if (!sb) {
      msg('Erro: confira as configurações do Supabase em config.js.');
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

  // Mostrar painel
  async function show() {
    $('loginPanel').hidden = true;
    $('dashboard').hidden = false;

    await load();
  }

  // Carregar produtos
  async function load() {
    $('adminProducts').innerHTML =
      '<p class="muted">Carregando produtos...</p>';

    const { data, error } = await sb
      .from('products')
      .select('*')
      .order('category')
      .order('name');

    if (error) {
      $('adminProducts').innerHTML =
        '<p class="muted">Erro ao carregar produtos.</p>';

      msg('Erro ao carregar: ' + error.message);
      return;
    }

    products = data || [];
    render();
  }

  // Mostrar produtos
  function render() {
    $('adminProducts').innerHTML = products.length
      ? products.map(p => `
          <div class="admin-product">
            <div>
              <b>${esc(p.name)}</b>
              <small>
                ${esc(p.category)} ·
                R$ ${Number(p.price).toFixed(2).replace('.', ',')} ·
                ${p.available ? 'Disponível' : 'Indisponível'}
              </small>
            </div>

            <div class="admin-actions">
              <button
                type="button"
                data-edit="${esc(p.id)}"
                class="secondary small">
                Editar
              </button>

              <button
                type="button"
                data-delete="${esc(p.id)}"
                class="danger small">
                Excluir
              </button>
            </div>
          </div>
        `).join('')
      : '<p class="muted">Nenhum produto cadastrado.</p>';
  }

  // EDITAR PRODUTO
  function edit(id) {

    // Corrigido: comparar os IDs como texto
    const p = products.find(
      item => String(item.id) === String(id)
    );

    if (!p) {
      msg('Produto não encontrado. Atualize a lista e tente novamente.');
      return;
    }

    $('productId').value = p.id;
    $('pName').value = p.name || '';
    $('pCategory').value = p.category || '';
    $('pPrice').value = p.price ?? '';
    $('pDescription').value = p.description || '';
    $('pImage').value = p.image_url || '';
    $('pAvailable').checked = p.available !== false;

    $('formTitle').textContent = 'Editar produto';

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // Limpar formulário
  function clear() {
    $('productForm').reset();

    $('productId').value = '';
    $('pAvailable').checked = true;

    $('formTitle').textContent = 'Adicionar produto';
  }

  // LOGIN
  $('loginForm').onsubmit = async e => {
    e.preventDefault();

    if (!sb) {
      msg('Supabase não configurado.');
      return;
    }

    const button = $('loginForm').querySelector('button');
    button.disabled = true;

    try {
      const { error } = await sb.auth.signInWithPassword({
        email: $('email').value.trim(),
        password: $('password').value
      });

      if (error) {
        msg('Erro no login: ' + error.message);
        return;
      }

      await show();

    } finally {
      button.disabled = false;
    }
  };

  // LOGOUT
  $('logout').onclick = async () => {
    const { error } = await sb.auth.signOut();

    if (error) {
      msg(error.message);
      return;
    }

    $('dashboard').hidden = true;
    $('loginPanel').hidden = false;
    clear();
  };

  // LIMPAR
  $('clearForm').onclick = clear;

  // CLIQUES NOS BOTÕES EDITAR E EXCLUIR
  $('adminProducts').addEventListener('click', e => {

    const editButton = e.target.closest('[data-edit]');
    const deleteButton = e.target.closest('[data-delete]');

    if (editButton) {
      edit(editButton.dataset.edit);
    }

    if (deleteButton) {
      del(deleteButton.dataset.delete);
    }
  });

  // SALVAR OU ATUALIZAR PRODUTO
  $('productForm').onsubmit = async e => {
    e.preventDefault();

    if (!sb) {
      msg('Conexão com Supabase indisponível.');
      return;
    }

    const row = {
      name: $('pName').value.trim(),
      category: $('pCategory').value.trim(),
      price: Number($('pPrice').value),
      description: $('pDescription').value.trim(),
      image_url: $('pImage').value.trim() || null,
      available: $('pAvailable').checked
    };

    if (
      !row.name ||
      !row.category ||
      !Number.isFinite(row.price) ||
      row.price <= 0
    ) {
      msg('Preencha os campos corretamente.');
      return;
    }

    const id = $('productId').value;
    const button = $('productForm').querySelector(
      'button[type="submit"]'
    );

    button.disabled = true;

    try {
      let result;

      if (id) {

        // ATUALIZA SOMENTE O PRODUTO SELECIONADO
        result = await sb
          .from('products')
          .update(row)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (result.error) {
          msg('Erro ao editar: ' + result.error.message);
          return;
        }

        if (!result.data) {
          msg(
            'Nenhum produto foi atualizado. ' +
            'Verifique o ID e as permissões RLS do Supabase.'
          );
          return;
        }

        msg('Produto atualizado com sucesso!');

      } else {

        result = await sb
          .from('products')
          .insert(row)
          .select()
          .single();

        if (result.error) {
          msg('Erro ao cadastrar: ' + result.error.message);
          return;
        }

        msg('Produto cadastrado com sucesso!');
      }

      clear();
      await load();

    } catch (error) {
      msg('Erro inesperado: ' + error.message);

    } finally {
      button.disabled = false;
    }
  };

  // EXCLUIR PRODUTO
  async function del(id) {

    if (!confirm('Tem certeza que deseja excluir este produto?')) {
      return;
    }

    const { data, error } = await sb
      .from('products')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      msg('Erro ao excluir: ' + error.message);
      return;
    }

    if (!data || data.length === 0) {
      msg('Nenhum produto excluído. Verifique as permissões RLS.');
      return;
    }

    msg('Produto excluído com sucesso!');
    await load();
  }

  // INICIAR
  session();

})();
=======
(() => {
const cfg=window.GORDE_CONFIG||{},valid=cfg.supabaseUrl&&!cfg.supabaseUrl.includes('SEU-PROJETO')&&cfg.supabaseAnonKey&&!cfg.supabaseAnonKey.includes('SUA-CHAVE');
const sb=valid&&window.supabase?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null,$=id=>document.getElementById(id);
let products=[];
function msg(t){alert(t);}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function session(){if(!sb){$('loginPanel').hidden=false;$('loginForm').querySelector('button').disabled=true;msg('Configure Supabase em config.js e execute supabase.sql antes de usar o painel.');return;}const {data}=await sb.auth.getSession();if(data.session)show();}
async function show(){$('loginPanel').hidden=true;$('dashboard').hidden=false;await load();}
async function load(){const {data,error}=await sb.from('products').select('*').order('category').order('name');if(error){msg(error.message);return;}products=data||[];render();}
function render(){$('adminProducts').innerHTML=products.length?products.map(p=>`<div class="admin-product"><div><b>${esc(p.name)}</b><small>${esc(p.category)} · R$ ${Number(p.price).toFixed(2).replace('.',',')} · ${p.available?'Disponível':'Indisponível'}</small></div><div class="admin-actions"><button data-edit="${p.id}" class="secondary small">Editar</button><button data-delete="${p.id}" class="danger small">Excluir</button></div></div>`).join(''):'<p class="muted">Nenhum produto cadastrado ainda.</p>';$('adminProducts').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));$('adminProducts').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>del(b.dataset.delete));}
function edit(id){const p=products.find(x=>x.id===id);if(!p)return;$('productId').value=p.id;$('pName').value=p.name;$('pCategory').value=p.category;$('pPrice').value=p.price;$('pDescription').value=p.description||'';$('pImage').value=p.image_url||'';$('pAvailable').checked=p.available;$('formTitle').textContent='Editar produto';window.scrollTo({top:0,behavior:'smooth'});}
function clear(){$('productForm').reset();$('productId').value='';$('pAvailable').checked=true;$('formTitle').textContent='Adicionar produto';}
$('loginForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error)msg(error.message);else show();};
$('logout').onclick=async()=>{await sb.auth.signOut();$('dashboard').hidden=true;$('loginPanel').hidden=false;};
$('clearForm').onclick=clear;
$('productForm').onsubmit=async e=>{e.preventDefault();const row={name:$('pName').value.trim(),category:$('pCategory').value.trim(),price:Number($('pPrice').value),description:$('pDescription').value.trim(),image_url:$('pImage').value.trim()||null,available:$('pAvailable').checked};const id=$('productId').value;const result=id?await sb.from('products').update(row).eq('id',id):await sb.from('products').insert(row);if(result.error){msg(result.error.message);return;}clear();await load();};
async function del(id){if(!confirm('Excluir este produto?'))return;const {error}=await sb.from('products').delete().eq('id',id);if(error)msg(error.message);else load();}
session();
})();
>>>>>>> origin/main
