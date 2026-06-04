"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

declare global {
  interface Window {
    __deferredBIP?: BIPEvent | null;
  }
}

function DownloadIcon() {
  return (
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
  );
}

export default function InstallApp() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    // Já está rodando instalado como PWA? Então não mostra o botão.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Registra o service worker (necessário pra ser instalável)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Detecta iOS + Safari (iOS não suporta beforeinstallprompt)
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome|android/.test(ua);
    if (iOS && isSafari) {
      setIsIOS(true);
      setCanInstall(true);
    }

    // Android/Chrome: pega o evento (capturado cedo no layout) ou escuta agora
    if (window.__deferredBIP) {
      setDeferred(window.__deferredBIP);
      setCanInstall(true);
    }
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setCanInstall(true);
    };
    const onReady = () => {
      if (window.__deferredBIP) {
        setDeferred(window.__deferredBIP);
        setCanInstall(true);
      }
    };
    const onInstalled = () => {
      setCanInstall(false);
      window.__deferredBIP = null;
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("bip-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("bip-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!canInstall) return null;

  const handleClick = async () => {
    if (deferred) {
      // Android/Chrome → modal nativo de instalação
      await deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {}
      setDeferred(null);
      window.__deferredBIP = null;
      setCanInstall(false);
    } else if (isIOS) {
      // iOS Safari → popup customizado com instruções
      setShowIOS(true);
    }
  };

  return (
    <>
      <button type="button" className="install-btn" onClick={handleClick}>
        <DownloadIcon />
        Instalar App
      </button>

      {showIOS && (
        <div
          className="ios-overlay"
          onClick={() => setShowIOS(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="ios-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ios-close"
              onClick={() => setShowIOS(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="ios-title">Instalar App no iOS</h2>

            <ol className="ios-steps">
              <li>
                <span className="ios-num">1</span>
                <span>
                  Toque no ícone de compartilhar (o quadrado com uma setinha
                  para cima, na parte inferior da tela).
                </span>
              </li>
              <li>
                <span className="ios-num">2</span>
                <span>
                  Deslize para baixo e selecione a opção &quot;Adicionar à Tela
                  de Início&quot;.
                </span>
              </li>
              <li>
                <span className="ios-num">3</span>
                <span>
                  Toque em &quot;Adicionar&quot; no canto superior direito.
                </span>
              </li>
            </ol>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="ios-steps-img"
              src="/ios-etapas.png"
              alt="Passos para instalar no iPhone"
            />
          </div>
        </div>
      )}
    </>
  );
}
