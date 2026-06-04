import { supabaseAdmin } from "./supabase";

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  content_url: string | null;
  checkout_url: string | null;
  is_main: boolean;
  is_bonus: boolean;
  sort_order: number;
};

export type ProductWithAccess = Product & { unlocked: boolean };

// Resolve uma lista de IDs/nomes externos -> produtos internos, via mapa.
// Casa quando o gateway bate OU quando o mapeamento foi cadastrado como 'qualquer'.
export async function resolveProductRefs(
  gateway: string,
  refs: string[]
): Promise<{ productIds: string[]; unmatched: string[] }> {
  if (refs.length === 0) return { productIds: [], unmatched: [] };

  const { data, error } = await supabaseAdmin
    .from("product_external_ids")
    .select("product_id, external_id, gateway")
    .in("external_id", refs)
    .in("gateway", [gateway, "qualquer"]);

  if (error) throw error;

  const matchedRefs = new Set((data ?? []).map((r) => r.external_id));
  const productIds = Array.from(new Set((data ?? []).map((r) => r.product_id)));
  const unmatched = refs.filter((r) => !matchedRefs.has(r));
  return { productIds, unmatched };
}

// Se o produto PRINCIPAL estiver entre os liberados, adiciona também os BÔNUS
// (Animes, Monumentos, Animais) — eles não vêm por webhook, vão junto.
async function expandWithBonuses(productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return productIds;

  const { data: flags, error } = await supabaseAdmin
    .from("products")
    .select("id, is_main, is_bonus");
  if (error) throw error;

  const mainIds = new Set((flags ?? []).filter((p) => p.is_main).map((p) => p.id));
  const grantedHasMain = productIds.some((id) => mainIds.has(id));
  if (!grantedHasMain) return productIds;

  const bonusIds = (flags ?? []).filter((p) => p.is_bonus).map((p) => p.id);
  return Array.from(new Set([...productIds, ...bonusIds]));
}

// Garante o membro e libera os produtos (idempotente).
export async function grantAccess(
  email: string,
  productIds: string[],
  gateway: string,
  orderRef: string | null
): Promise<void> {
  const lower = email.toLowerCase();

  await supabaseAdmin
    .from("members")
    .upsert({ email: lower }, { onConflict: "email", ignoreDuplicates: true });

  productIds = await expandWithBonuses(productIds);

  if (productIds.length === 0) return;

  const rows = productIds.map((product_id) => ({
    email: lower,
    product_id,
    source_gateway: gateway,
    order_ref: orderRef,
  }));

  const { error } = await supabaseAdmin
    .from("entitlements")
    .upsert(rows, { onConflict: "email,product_id", ignoreDuplicates: true });

  if (error) throw error;
}

// Registra a chamada de webhook (log cru + o que foi resolvido).
export async function logWebhookEvent(args: {
  gateway: string;
  email: string | null;
  status: string | null;
  isPaid: boolean;
  matchedProductIds: string[];
  unmatchedExternalIds: string[];
  raw: unknown;
  ok: boolean;
}): Promise<void> {
  await supabaseAdmin.from("webhook_events").insert({
    gateway: args.gateway,
    email: args.email,
    status: args.status,
    is_paid: args.isPaid,
    matched_product_ids: args.matchedProductIds,
    unmatched_external_ids: args.unmatchedExternalIds,
    raw: args.raw,
    ok: args.ok,
  });
}

// True se o email já é membro (já comprou algo) — usado no login.
export async function memberExists(email: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("email", email.toLowerCase());
  return (count ?? 0) > 0;
}

// Lista os 10 produtos marcando quais o email tem liberado.
export async function getProductsForEmail(email: string): Promise<ProductWithAccess[]> {
  const lower = email.toLowerCase();

  const [{ data: products, error: pErr }, { data: ents, error: eErr }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, slug, title, description, cover_url, content_url, checkout_url, is_main, is_bonus, sort_order")
      .order("sort_order", { ascending: true }),
    supabaseAdmin.from("entitlements").select("product_id").eq("email", lower),
  ]);

  if (pErr) throw pErr;
  if (eErr) throw eErr;

  const unlocked = new Set((ents ?? []).map((e) => e.product_id));
  return (products ?? []).map((p) => ({ ...p, unlocked: unlocked.has(p.id) }));
}

// Atualiza o último login (carimbo informativo).
export async function touchLogin(email: string): Promise<void> {
  await supabaseAdmin
    .from("members")
    .update({ last_login: new Date().toISOString() })
    .eq("email", email.toLowerCase());
}
