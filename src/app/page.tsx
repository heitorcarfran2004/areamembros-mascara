import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MENSAGENS: Record<string, string> = {
  email: "Digite um email válido.",
  naocomprou:
    "Não encontramos nenhuma compra com esse email. Use o mesmo email da compra.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  // Se já está logado, vai direto pra área de membros
  const email = await getSessionEmail();
  if (email) redirect("/membros");

  const { erro } = await searchParams;
  const msg = erro ? MENSAGENS[erro] : null;

  return (
    <main className="login-wrap">
      <div className="login-card">
        <button type="button" className="install-btn">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7 11 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          Instalar App
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login-logo" src="/logo.png" alt="Espaço Criativo" />
        <h1>Acesse sua área de membros</h1>
        <p className="sub">
          Digite o email que você usou na compra para liberar seus produtos.
        </p>

        {msg && <div className="alert">{msg}</div>}

        <form action="/api/login" method="post">
          <div className="field">
            <label htmlFor="email">Seu email</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              required
            />
          </div>
          <button className="btn" type="submit">
            Entrar →
          </button>
        </form>
      </div>
    </main>
  );
}
