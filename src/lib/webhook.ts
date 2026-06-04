// ---------------------------------------------------------------------------
// Parser TOLERANTE de webhook.
// Não sabemos o formato exato de Vega/GG, então vasculhamos o payload nos
// lugares mais comuns. O payload cru é salvo em webhook_events para calibrar.
// ---------------------------------------------------------------------------

type Json = any;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Palavras que indicam pagamento concluído / aprovado
const PAID_RE = /(^|[^a-z])(paid|approved|aprovad|complete|completed|pago|confirmed|confirmad|active|authorized|succeeded|success)($|[^a-z])/i;
// Palavras que indicam que NÃO deve liberar (estorno, recusa, etc.)
const NOT_PAID_RE = /(refund|estorn|chargeback|charged_back|cancel|recus|reject|denied|expired|pending|aguard|waiting|abandoned)/i;

// Chaves cujo VALOR costuma ser um identificador de produto/oferta
const ID_KEYS = new Set([
  "product_id", "productid", "offer_id", "offerid", "offer", "code",
  "sku", "plan_id", "planid", "external_id", "externalid", "product_code",
  "productcode", "id_produto", "produto_id", "hash", "product_hash",
  "offer_code", "offer_hash", "plan_code",
]);

// Chaves cujo valor costuma ser o NOME do produto (útil pra mapear por nome)
const NAME_KEYS = new Set([
  "product_name", "productname", "produto", "name", "title", "nome",
  "plan_name", "offer_name",
]);

// Chaves cujo valor é uma lista de itens comprados (principal + order bumps)
const ITEM_ARRAY_KEYS = new Set([
  "items", "products", "order_items", "line_items", "offers", "bumps",
  "order_bumps", "orderbumps", "plans", "cart", "produtos", "itens",
]);

// Chaves de status
const STATUS_KEYS = new Set([
  "status", "payment_status", "order_status", "transaction_status",
  "situacao", "situation", "state", "event", "eventtype", "event_type",
  "type", "action", "trigger",
]);

function lc(s: string) { return s.toLowerCase(); }

// Procura recursivamente o primeiro email válido no payload
export function extractEmail(payload: Json): string | null {
  let found: string | null = null;
  const walk = (node: Json) => {
    if (found) return;
    if (node == null) return;
    if (typeof node === "string") {
      if (EMAIL_RE.test(node.trim())) found = node.trim().toLowerCase();
      return;
    }
    if (typeof node !== "object") return;
    // dá prioridade a chaves chamadas "email"
    for (const k of Object.keys(node)) {
      if (lc(k).includes("email") && typeof node[k] === "string" && EMAIL_RE.test(node[k].trim())) {
        found = node[k].trim().toLowerCase();
        return;
      }
    }
    for (const k of Object.keys(node)) walk(node[k]);
  };
  walk(payload);
  return found;
}

// Decide se a venda está paga/aprovada
export function extractIsPaid(payload: Json): { isPaid: boolean; status: string | null } {
  const statuses: string[] = [];
  const walk = (node: Json) => {
    if (node == null || typeof node !== "object") return;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (STATUS_KEYS.has(lc(k)) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
        statuses.push(String(v));
      }
      if (lc(k) === "paid" && v === true) statuses.push("paid");
      if (typeof v === "object") walk(v);
    }
  };
  walk(payload);

  const status = statuses[0] ?? null;
  const joined = statuses.join(" ");
  // Se houver sinal negativo explícito, não libera.
  if (NOT_PAID_RE.test(joined) && !PAID_RE.test(joined)) {
    return { isPaid: false, status };
  }
  return { isPaid: PAID_RE.test(joined), status };
}

// Coleta TODOS os candidatos a identificador de produto (IDs e nomes)
export function extractProductRefs(payload: Json): string[] {
  const refs = new Set<string>();
  const add = (v: Json) => {
    if (v == null) return;
    if (typeof v === "string" || typeof v === "number") {
      const s = String(v).trim();
      if (s) refs.add(s);
    }
  };

  const walk = (node: Json, insideItem: boolean) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const el of node) walk(el, insideItem);
      return;
    }
    if (typeof node !== "object") return;

    for (const k of Object.keys(node)) {
      const key = lc(k);
      const v = node[k];

      if (ID_KEYS.has(key)) add(v);
      if (NAME_KEYS.has(key) && typeof v === "string") add(v);
      // dentro de um item, um "id" cru também conta como id de produto
      if (insideItem && key === "id") add(v);

      if (ITEM_ARRAY_KEYS.has(key) && Array.isArray(v)) {
        for (const el of v) walk(el, true);
      } else if (typeof v === "object") {
        walk(v, insideItem);
      }
    }
  };

  walk(payload, false);
  return Array.from(refs);
}

// Tenta achar uma referência de pedido (pra log/idempotência)
export function extractOrderRef(payload: Json): string | null {
  let found: string | null = null;
  const KEYS = ["order_id", "orderid", "transaction_id", "transactionid", "sale_id", "saleid", "id", "code", "reference"];
  const walk = (node: Json) => {
    if (found || node == null || typeof node !== "object") return;
    for (const k of KEYS) {
      if (k in node && (typeof node[k] === "string" || typeof node[k] === "number")) {
        found = String(node[k]);
        return;
      }
    }
    for (const k of Object.keys(node)) {
      if (typeof node[k] === "object") walk(node[k]);
    }
  };
  walk(payload);
  return found;
}
