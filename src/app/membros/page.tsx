import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { getProductsForEmail, type ProductWithAccess } from "@/lib/data";

export const dynamic = "force-dynamic";

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="10.5" width="17" height="11" rx="2.2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

function Cover({ p }: { p: ProductWithAccess }) {
  if (p.cover_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.cover_url} alt={p.title} />;
  }
  if (p.unlocked) return <span>▶</span>;
  return (
    <span className="cover-lock">
      <LockIcon size={34} />
    </span>
  );
}

function Actions({ p }: { p: ProductWithAccess }) {
  if (p.unlocked) {
    return (
      <>
        <span className="status open">● Liberado</span>
        <a
          className="cta"
          href={p.content_url || "#"}
          {...(p.content_url ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          ACESSAR
        </a>
      </>
    );
  }
  return (
    <>
      <span className="status shut">
        <LockIcon size={13} /> Compre para liberar
      </span>
      <a
        className="cta cta-dark"
        href={p.checkout_url || "#"}
        {...(p.checkout_url ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        DESBLOQUEAR
      </a>
    </>
  );
}

function ProductCard({ p }: { p: ProductWithAccess }) {
  return (
    <article className={`card ${p.unlocked ? "unlocked" : "locked"}`}>
      <div className="cover">
        <Cover p={p} />
      </div>
      <div className="card-body">
        <h3>{p.title}</h3>
        <Actions p={p} />
      </div>
    </article>
  );
}

function FeaturedCard({ p }: { p: ProductWithAccess }) {
  return (
    <article className={`featured card ${p.unlocked ? "unlocked" : "locked"}`}>
      <span className="badge main">Principal</span>
      <div className="cover">
        <Cover p={p} />
      </div>
      <div className="card-body">
        <h3>{p.title}</h3>
        <Actions p={p} />
      </div>
    </article>
  );
}

function BonusRow({ p }: { p: ProductWithAccess }) {
  return (
    <article className={`bonus-row ${p.unlocked ? "unlocked" : "locked"}`}>
      <div className="bonus-cover">
        <Cover p={p} />
      </div>
      <div className="bonus-body">
        <h3>{p.title}</h3>
        <Actions p={p} />
      </div>
    </article>
  );
}

export default async function MembrosPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/");

  const products = await getProductsForEmail(email);
  const liberados = products.filter((p) => p.unlocked).length;

  const main = products.find((p) => p.is_main);
  const bonuses = products.filter((p) => p.is_bonus);
  const bumps = products.filter((p) => !p.is_main && !p.is_bonus);

  return (
    <main className="container">
      <div className="topbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo.png" alt="Espaço Criativo" />
        <form action="/api/logout" method="post">
          <button className="btn-ghost" type="submit">
            Sair
          </button>
        </form>
      </div>

      <h1 className="h-title">Seus produtos</h1>
      <p className="h-sub">
        <b>{liberados}</b> de {products.length} liberados. Comprou mais? Atualize a
        página que o novo produto aparece aqui.
      </p>

      {main && (
        <section className="section">
          <h2 className="section-title">Produto principal</h2>
          <FeaturedCard p={main} />
        </section>
      )}

      {bonuses.length > 0 && (
        <section className="section">
          <h2 className="section-title">Bônus inclusos</h2>
          <div className="bonus-list">
            {bonuses.map((p) => (
              <BonusRow key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {bumps.length > 0 && (
        <section className="section">
          <h2 className="section-title">Mais produtos pra você</h2>
          <div className="grid">
            {bumps.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
