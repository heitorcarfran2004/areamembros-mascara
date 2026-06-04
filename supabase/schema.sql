-- ===========================================================================
-- ÁREA DE MEMBROS — SCHEMA SUPABASE  (Moldes / Máscara)
-- Rode no Supabase: Dashboard > SQL Editor > New query > cole e RUN.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) PRODUTOS (catálogo interno — os 10 produtos)
-- ---------------------------------------------------------------------------
create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  description  text,
  cover_url    text,
  content_url  text,          -- link do conteúdo liberado (você preenche depois)
  checkout_url text,          -- link de COMPRA (GG) p/ produto bloqueado
  is_main      boolean not null default false,  -- produto principal
  is_bonus     boolean not null default false,  -- bônus: libera junto com o principal
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) MAPA DE IDs EXTERNOS -> PRODUTO INTERNO  (libera independente do ID/gateway)
-- ---------------------------------------------------------------------------
create table if not exists product_external_ids (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  gateway     text not null,        -- 'vega' | 'ggcheckout' | 'qualquer'
  external_id text not null,
  note        text,
  created_at  timestamptz not null default now(),
  unique (gateway, external_id)
);
create index if not exists idx_pei_external on product_external_ids (external_id);
create index if not exists idx_pei_product  on product_external_ids (product_id);

-- ---------------------------------------------------------------------------
-- 3) MEMBROS (login por email puro)
-- ---------------------------------------------------------------------------
create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

-- ---------------------------------------------------------------------------
-- 4) LIBERAÇÕES (email -> produto)
-- ---------------------------------------------------------------------------
create table if not exists entitlements (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  product_id     uuid not null references products(id) on delete cascade,
  source_gateway text,
  order_ref      text,
  granted_at     timestamptz not null default now(),
  unique (email, product_id)
);
create index if not exists idx_entitlements_email on entitlements (email);

-- ---------------------------------------------------------------------------
-- 5) LOG CRU DE WEBHOOKS (debug/calibração)
-- ---------------------------------------------------------------------------
create table if not exists webhook_events (
  id                     uuid primary key default gen_random_uuid(),
  gateway                text,
  received_at            timestamptz not null default now(),
  email                  text,
  status                 text,
  is_paid                boolean,
  matched_product_ids    uuid[] default '{}',
  unmatched_external_ids text[] default '{}',
  raw                    jsonb,
  ok                     boolean default true
);
create index if not exists idx_webhook_events_received on webhook_events (received_at desc);
create index if not exists idx_webhook_events_unmatched on webhook_events using gin (unmatched_external_ids);

-- ---------------------------------------------------------------------------
-- 6) SEGURANÇA (RLS): bloqueia acesso anônimo; servidor usa service_role.
-- ---------------------------------------------------------------------------
alter table products              enable row level security;
alter table product_external_ids enable row level security;
alter table members               enable row level security;
alter table entitlements          enable row level security;
alter table webhook_events        enable row level security;

-- ===========================================================================
-- SEED: os 10 produtos reais
--   is_main  = Moldes Máscaras (principal)
--   is_bonus = Animes, Monumentos, Animais (liberam junto com o principal)
--   checkout_url = link GG (mostrado no card bloqueado p/ comprar)
-- (edite cover_url e content_url depois com seus links reais)
-- ===========================================================================
insert into products (slug, title, description, is_main, is_bonus, checkout_url, sort_order) values
  ('moldes-mascaras',            'Moldes Máscaras',               'Produto principal',        true,  false, null, 0),
  ('moldes-super-herois',        'Moldes de Super Heróis',        'Order bump',               false, false, 'https://ggcheckout.app/checkout/v5/VqD6Y8KDeCg1UkbQ8DM7', 1),
  ('moldes-disney',              'Moldes da Disney',              'Order bump',               false, false, 'https://ggcheckout.app/checkout/v5/yj61bFh9PFVynPbQ9Vn4', 2),
  ('moldes-bonecos-biblicos',    'Moldes de Bonecos Bíblicos',    'Order bump',               false, false, 'https://ggcheckout.app/checkout/v5/YfxbCP5LBTZInVAsfvhh', 3),
  ('moldes-carros',              'Moldes de Carros',              'Order bump',               false, false, 'https://ggcheckout.app/checkout/v5/6zTWxf5fdvFgLci879HY', 4),
  ('moldes-motos',               'Moldes de Motos',               'Order bump',               false, false, 'https://ggcheckout.app/checkout/v5/WGKEDKAcJp2PXillK0zG', 5),
  ('moldes-avioes-helicopteros', 'Moldes de Aviões e Helicópteros','Order bump',              false, false, 'https://ggcheckout.app/checkout/v5/kQYvWUYtcfBLsqTDT3rl', 6),
  ('moldes-animes',              'Moldes de Animes',              'Bônus (liberado com o principal)',     false, true,  null, 7),
  ('moldes-monumentos',          'Moldes de Monumentos',          'Bônus (liberado com o principal)',     false, true,  null, 8),
  ('moldes-animais',             'Moldes de Animais',             'Bônus (liberado com o principal)',     false, true,  null, 9)
on conflict (slug) do nothing;

-- ===========================================================================
-- MAPA: todos os IDs externos -> produto. gateway='qualquer' libera venha de
-- onde vier (Vega ou GG), exatamente como você pediu.
-- ===========================================================================
insert into product_external_ids (product_id, gateway, external_id)
select p.id, 'qualquer', m.external_id
from products p
join (values
  -- Principal (Moldes Máscaras)
  ('moldes-mascaras','OGN83d9zdipeLJQjetn2'),
  ('moldes-mascaras','QIICXZThKgncdKO07wGn'),
  ('moldes-mascaras','3MKBO3'),
  ('moldes-mascaras','Z0BsgtKAHbJbphNVWAct'),
  ('moldes-mascaras','3MXC7S'),
  ('moldes-mascaras','3MKEN3'),
  ('moldes-mascaras','3MLCLR'),
  ('moldes-mascaras','3MLCLS'),
  ('moldes-mascaras','3MLCLT'),
  -- Super Heróis
  ('moldes-super-herois','jqjG3QruEFx6BrneDYvDJ'),
  ('moldes-super-herois','3MLNA7'),
  -- Disney
  ('moldes-disney','W6FKyqOPWzzwwesuVIIY'),
  ('moldes-disney','3MKB04'),
  -- Bonecos Bíblicos
  ('moldes-bonecos-biblicos','3MLNAC'),
  ('moldes-bonecos-biblicos','xce6Nrch8ZI0WowaLTeH'),
  -- Carros
  ('moldes-carros','3LaNcY12nud6BmEMDRUO'),
  ('moldes-carros','3MMSRH'),
  -- Motos
  ('moldes-motos','cFZVtuSzyp4Yn5neD4Jc'),
  ('moldes-motos','3MMSC'),
  -- Aviões e Helicópteros
  ('moldes-avioes-helicopteros','3MMSSF'),
  ('moldes-avioes-helicopteros','iH81q3q1RAwiHWLjSAm7')
) as m(slug, external_id) on m.slug = p.slug
on conflict (gateway, external_id) do nothing;
