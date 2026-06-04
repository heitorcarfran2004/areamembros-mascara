# Área de Membros

Área de membros com **liberação automática por webhook**. Login por **email puro**.
Os produtos são liberados conforme a pessoa compra, vindo da **Vega** (front) ou do
**GG Checkout** (compras dentro da área). Qualquer ID externo libera o produto certo
através de uma **tabela de mapeamento** — independente de qual gateway enviou.

## Stack
- **Next.js 16** (App Router) → deploy na **Vercel**
- **Supabase** (Postgres) → banco
- **GitHub** → repositório

---

## 1. Criar o banco no Supabase

1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique **RUN**.
3. Isso cria as tabelas e já insere **10 produtos de exemplo**. Edite título/descrição/links
   depois pelo **Table Editor** (tabela `products`).

Pegue suas chaves em **Project Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `service_role` (secreta) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Rodar local (opcional, pra testar)

```powershell
copy .env.local.example .env.local
# edite .env.local com as chaves do Supabase e segredos
npm install
npm run dev
```

Gere os segredos aleatórios (`SESSION_SECRET` e `WEBHOOK_SECRET`) com:
```powershell
[Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))
```

Abra http://localhost:3000

## 3. Subir pro GitHub + Vercel

```powershell
git init
git add .
git commit -m "Área de membros"
# crie um repo no GitHub e:
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

Na **Vercel**: New Project → importe o repo → em **Environment Variables**, cadastre:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `WEBHOOK_SECRET`

Deploy. Sua URL fica tipo `https://seu-projeto.vercel.app`.

---

## 4. Configurar os webhooks nos gateways

Evento a ativar nos dois: **venda aprovada / paga** (no GG: `pix.paid` e `card.paid`).

**Vega** — em *Dev → Webhooks → Nova integração*, URL:
```
https://seu-projeto.vercel.app/api/webhook/vega?token=SEU_WEBHOOK_SECRET
```

**GG Checkout** — em *Configurações → Webhook → Criar Webhook*:
- **URL da integração:** `https://seu-projeto.vercel.app/api/webhook/ggcheckout`
- **Secret:** cole o **mesmo** valor do `WEBHOOK_SECRET`
- **Eventos:** marque `Pix Paid` e `Card Paid` (e, se quiser tratar estorno no futuro, `Pix Refunded` / `Card Refunded`)

> O sistema valida o segredo vindo do `?token=` (Vega) **ou** do campo Secret do GG
> (enviado no header/corpo). Sem o segredo certo, responde 401.

## 5. O mapa de produtos JÁ VEM PRONTO ✅

O `schema.sql` já cadastra os 10 produtos e **todos os IDs** que você passou
(mapeados como `gateway = 'qualquer'`, ou seja, liberam venha da Vega ou do GG):

| Produto | Tipo | IDs mapeados |
|---|---|---|
| Moldes Máscaras | **Principal** | 9 IDs |
| Moldes de Super Heróis | Order bump | 2 IDs + checkout GG |
| Moldes da Disney | Order bump | 2 IDs + checkout GG |
| Moldes de Bonecos Bíblicos | Order bump | 2 IDs + checkout GG |
| Moldes de Carros | Order bump | 2 IDs + checkout GG |
| Moldes de Motos | Order bump | 2 IDs + checkout GG |
| Moldes de Aviões e Helicópteros | Order bump | 2 IDs + checkout GG |
| Moldes de Animes | **Bônus** | — (libera com o principal) |
| Moldes de Monumentos | **Bônus** | — (libera com o principal) |
| Moldes de Animais | **Bônus** | — (libera com o principal) |

Os **3 bônus** não têm ID nem checkout: eles são liberados **automaticamente**
junto com o Moldes Máscaras (lógica em `src/lib/data.ts` → `expandWithBonuses`).

**Só falta você:** preencher `content_url` (link do conteúdo real de cada produto)
e, se quiser, `cover_url` (imagem de capa) na tabela `products`.

### Conferir após o 1º teste
Faça uma compra de teste e veja a tabela **`webhook_events`**:
- `matched_product_ids` deve listar o produto liberado.
- `unmatched_external_ids` deve ficar **vazio**. Se aparecer algum ID ali, é um
  ID novo que o gateway mandou — basta adicionar em `product_external_ids`:

```sql
insert into product_external_ids (product_id, gateway, external_id)
select id, 'qualquer', 'ID_NOVO_QUE_APARECEU'
from products where slug = 'moldes-mascaras';
```

---

## Como funciona o fluxo

```
Compra aprovada (Vega ou GG)
        │  POST com email + IDs dos produtos
        ▼
/api/webhook/[gateway]
        │  1. valida token
        │  2. extrai email + status + IDs (parser tolerante)
        │  3. só libera se status = pago
        │  4. mapeia cada ID externo -> produto interno
        │  5. grava acesso (entitlements) + salva payload cru
        ▼
Pessoa entra com o email → /membros → vê os 10 produtos
(comprados = Liberado, resto = Bloqueado)
```

## Arquivos principais
| Arquivo | O quê |
|---|---|
| `supabase/schema.sql` | Tabelas + 10 produtos de exemplo |
| `src/lib/webhook.ts` | Parser tolerante (email, status, IDs) |
| `src/lib/data.ts` | Mapa ID→produto, liberação, consulta |
| `src/app/api/webhook/[gateway]/route.ts` | Recebe Vega/GG |
| `src/app/api/login/route.ts` | Login por email |
| `src/app/membros/page.tsx` | Área de membros |

## Observações
- **Login por email puro**: qualquer um que saiba o email de um comprador entra. O cookie
  é assinado (não dá pra forjar), mas a segurança real depende do email. Para trocar por
  **magic link** depois, só muda `src/lib/auth.ts` + a rota de login — o resto não muda.
- **Reembolso/estorno**: hoje o webhook só **libera**. Se quiser **revogar** acesso em
  estorno, dá pra tratar os eventos de refund (já são detectados em `webhook.ts`) e
  remover de `entitlements`. É um próximo passo simples.
