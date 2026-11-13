# Cardápio Digital — Chopperia Gorde

## O que está incluído
- `index.html`: cardápio público para clientes.
- `admin.html`: painel para cadastrar, editar e excluir produtos.
- `config.js`: configura WhatsApp, taxa de entrega e Supabase.
- `supabase.sql`: tabelas e políticas de segurança.
- `app.js` / `admin.js`: funcionamento do cardápio e painel.
- `style.css`: visual responsivo para celular e computador.

## Configuração
1. Crie um projeto no Supabase.
2. No SQL Editor, execute todo o conteúdo de `supabase.sql`.
3. Em Authentication > Users, crie o usuário administrador com e-mail e senha.
4. Copie o UUID desse usuário e execute no SQL Editor:
   `insert into public.store_admins (user_id) values ('UUID-DO-ADMIN');`
5. Em Project Settings > API, copie Project URL e a chave `anon`/publishable.
6. Abra `config.js` e substitua `supabaseUrl`, `supabaseAnonKey` e `whatsapp`.
   O WhatsApp deve conter código do país + DDD + número, apenas dígitos (ex.: 5511999999999).
7. Publique os arquivos em uma hospedagem HTTPS (Apache/XAMPP local serve para testes).

## Observações
- A taxa de entrega está configurada inicialmente em R$ 5,00.
- Sem Supabase configurado, a página pública mostra produtos demonstrativos e o painel administrativo não permite salvar.
- A finalização abre o WhatsApp com a mensagem preenchida; o cliente ainda precisa tocar em **Enviar** no WhatsApp.
- Não coloque a chave `service_role` no navegador. Use somente a chave pública anon/publishable.
- Para segurança, mantenha a autenticação e as políticas RLS do SQL.
<<<<<<< HEAD
=======


https://devfellipera.github.io/chopperia-gorde/
>>>>>>> origin/main
