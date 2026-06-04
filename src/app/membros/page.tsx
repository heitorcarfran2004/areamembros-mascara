import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { getProductsForEmail } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MembrosPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/");

  const products = await getProductsForEmail(email);
  const liberados = products.filter((p) => p.unlocked).length;

  return (
    <main className="container">
      <div className="topbar">
        <span className="who">{email}</span>
        <form action="/api/logout" method="post">
          <button className="btn-ghost" type="submit">
            Sair
          </button>
        </form>
      </div>

      <h1 className="h-title">Seus produtos</h1>
      <p className="h-sub">
        {liberados} de {products.length} liberados. Comprou mais? Atualize a
        página que o novo produto aparece aqui.
      </p>

      <div className="grid">
        {products.map((p) => (
          <article
            key={p.id}
            className={`card ${p.unlocked ? "unlocked" : "locked"}`}
          >
            {p.is_main && <span className="badge main">Principal</span>}
            <div className="cover">
              {p.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_url} alt={p.title} />
              ) : (
                <span>{p.unlocked ? "▶" : "🔒"}</span>
              )}
            </div>
            <div className="card-body">
              <h3>{p.title}</h3>
              <p>{p.description}</p>

              {p.unlocked ? (
                <>
                  <span className="status open">● Liberado</span>
                  {p.content_url ? (
                    <a
                      className="cta"
                      href={p.content_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Acessar conteúdo →
                    </a>
                  ) : (
                    <span className="cta disabled">Conteúdo em breve</span>
                  )}
                </>
              ) : (
                <>
                  <span className="status shut">🔒 Bloqueado</span>
                  {p.checkout_url ? (
                    <a
                      className="cta"
                      href={p.checkout_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Comprar para liberar →
                    </a>
                  ) : (
                    <span className="cta disabled">Incluso na compra principal</span>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
