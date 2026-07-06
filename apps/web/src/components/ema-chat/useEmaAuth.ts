// Autenticação contra o Azure AD para falar com a API da EMA.
// Caminho feliz: os usuários do Kanban logam com Microsoft, então costuma
// existir sessão AAD no navegador e ssoSilent (com loginHint) +
// acquireTokenSilent obtêm o token sem prompt.
// Caminho Safari/ITP: o silencioso falha (cookies de terceiros bloqueados) e
// popups só abrem em resposta DIRETA a um clique — por isso o login
// interativo é um método separado (`loginWithPopup`), chamado pelo botão
// "Entrar com Microsoft" do painel, NUNCA automaticamente após awaits
// (o navegador descartaria o gesto e bloquearia o popup em silêncio).
// A EMA valida o ID TOKEN (audience = client id da EMA) — enviamos
// result.idToken, mesmo padrão do frontend da própria EMA.
import type { AccountInfo } from "@azure/msal-browser";
import { useCallback, useRef, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";

import type { EmaEnv } from "./emaEnv";

import { getEmaEnv } from "./emaEnv";

const SCOPES = ["User.Read"];

let msalInstance: PublicClientApplication | null = null;
let msalInit: Promise<void> | null = null;

function getMsal(cfg: EmaEnv): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
        redirectUri: window.location.origin,
      },
      // localStorage: o login via popup vale para TODAS as abas e sobrevive
      // a reloads — com sessionStorage (por aba no Safari) o usuário teria
      // que logar de novo a cada aba, mesmo com refresh token válido (~24h).
      cache: { cacheLocation: "localStorage" },
      system: {
        // Safari/ITP nunca completa o iframe do ssoSilent (timed_out) — o
        // default de 10s deixa o painel parecendo travado antes do botão
        // "Entrar com Microsoft" aparecer. 4s cobre o caso feliz com folga.
        iframeBridgeTimeout: 4000,
      },
    });
    msalInit = msalInstance.initialize();
  }
  return msalInstance;
}

async function ensureMsal(cfg: EmaEnv): Promise<PublicClientApplication> {
  const msal = getMsal(cfg);
  try {
    await msalInit;
  } catch (initErr) {
    // Init falhou: zera os singletons para permitir retry na próxima
    // chamada (senão a promise rejeitada fica cacheada para sempre).
    msalInstance = null;
    msalInit = null;
    throw initErr;
  }
  return msal;
}

export type EmaAuthStatus = "idle" | "authenticating" | "ready" | "needs_login";

export function useEmaAuth(loginHint?: string | null) {
  const [status, setStatus] = useState<EmaAuthStatus>("idle");
  const accountRef = useRef<AccountInfo | null>(null);

  /**
   * Obtém um ID token válido para a EMA pelo caminho SILENCIOSO
   * (ssoSilent + acquireTokenSilent). Lança quando é preciso interação —
   * o chamador mostra o botão "Entrar com Microsoft" (loginWithPopup).
   */
  const getToken = useCallback(async (): Promise<string> => {
    const cfg = getEmaEnv();
    if (!cfg) throw new Error("Widget da EMA sem configuração.");
    setStatus("authenticating");
    try {
      const msal = await ensureMsal(cfg);
      let account =
        accountRef.current ??
        msal
          .getAllAccounts()
          .find(
            (a) => a.username.toLowerCase() === (loginHint ?? "").toLowerCase(),
          ) ??
        null;
      if (!account) {
        const sso = await msal.ssoSilent({
          scopes: SCOPES,
          loginHint: loginHint ?? undefined,
        });
        account = sso.account;
      }
      const result = await msal.acquireTokenSilent({
        scopes: SCOPES,
        account,
      });
      accountRef.current = result.account;
      setStatus("ready");
      return result.idToken;
    } catch (err) {
      setStatus("needs_login");
      throw err;
    }
  }, [loginHint]);

  /**
   * Login interativo (popup). Chamar APENAS de um onClick direto — assim o
   * popup carrega o gesto do usuário e não é bloqueado (Safari inclusive).
   * O warmUp na abertura do painel já resolveu o initialize(), então não há
   * await relevante entre o clique e a abertura do popup.
   */
  const loginWithPopup = useCallback(async (): Promise<void> => {
    const cfg = getEmaEnv();
    if (!cfg) throw new Error("Widget da EMA sem configuração.");
    const msal = await ensureMsal(cfg);
    const result = await msal.loginPopup({
      scopes: SCOPES,
      loginHint: loginHint ?? undefined,
      // Um popup interrompido (janela perdida em outra aba, reload no meio
      // do fluxo) deixa a flag interaction.status presa no sessionStorage e
      // todo clique seguinte morre com interaction_in_progress. Este botão
      // é o ÚNICO ponto interativo do widget, então assumir o controle da
      // interação órfã é seguro.
      overrideInteractionInProgress: true,
    });
    accountRef.current = result.account;
    setStatus("ready");
  }, [loginHint]);

  /**
   * Aquecimento na abertura do painel: resolve o initialize() do MSAL e
   * tenta o caminho silencioso em background. Nunca lança — se falhar, o
   * envio vai sinalizar a necessidade de login.
   */
  const warmUp = useCallback(async (): Promise<void> => {
    try {
      await getToken();
    } catch (err) {
      // Esperado sem sessão AAD (ex.: Safari/ITP) — diagnóstico no console.
      console.info("[ema-chat] aquecimento silencioso falhou:", err);
    }
  }, [getToken]);

  return { status, getToken, loginWithPopup, warmUp };
}
