// Autenticação silenciosa contra o Azure AD para falar com a API da EMA.
// Os usuários do Kanban logam com Microsoft, então já existe sessão AAD no
// navegador: ssoSilent (com loginHint) + acquireTokenSilent funcionam sem
// prompt; o primeiro uso pode exigir um popup de consentimento.
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
      cache: { cacheLocation: "sessionStorage" },
    });
    msalInit = msalInstance.initialize();
  }
  return msalInstance;
}

export type EmaAuthStatus =
  | "idle"
  | "authenticating"
  | "ready"
  | "needs_login";

export function useEmaAuth(loginHint?: string | null) {
  const [status, setStatus] = useState<EmaAuthStatus>("idle");
  const accountRef = useRef<AccountInfo | null>(null);

  /**
   * Obtém um ID token válido para a EMA. Com interactive=true, cai para
   * popup quando o caminho silencioso falhar (primeiro consentimento,
   * sessão AAD ausente, popup necessário).
   */
  const getToken = useCallback(
    async (interactive = false): Promise<string> => {
      const cfg = getEmaEnv();
      if (!cfg) throw new Error("Widget da EMA sem configuração.");
      setStatus("authenticating");
      try {
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
        if (interactive) {
          try {
            const msalRetry = getMsal(cfg);
            await msalInit;
            const result = await msalRetry.loginPopup({
              scopes: SCOPES,
              loginHint: loginHint ?? undefined,
            });
            accountRef.current = result.account;
            setStatus("ready");
            return result.idToken;
          } catch {
            setStatus("needs_login");
            throw err;
          }
        }
        setStatus("needs_login");
        throw err;
      }
    },
    [loginHint],
  );

  return { status, getToken };
}
