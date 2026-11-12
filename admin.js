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