// Envs do widget da EMA, lidas em runtime (next-runtime-env). Módulo LEVE de
// propósito: é importado pelo _app em toda página — o widget pesado
// (msal/react-markdown) só carrega via dynamic import quando habilitado.
import { env } from "next-runtime-env";

import { env as appEnv } from "~/env";

export interface EmaEnv {
  apiUrl: string;
  clientId: string;
  tenantId: string;
}

let warnedMissing = false;

/** null = widget desabilitado (fail-soft, não renderiza nem carrega o chunk). */
export function getEmaEnv(): EmaEnv | null {
  const apiUrl = env("NEXT_PUBLIC_EMA_API_URL");
  const clientId = env("NEXT_PUBLIC_EMA_AAD_CLIENT_ID");
  const tenantId = env("NEXT_PUBLIC_EMA_AAD_TENANT_ID");
  if (!apiUrl || !clientId || !tenantId) {
    if (appEnv.NODE_ENV === "development" && !warnedMissing) {
      warnedMissing = true;
      console.info(
        "[ema-chat] Widget da EMA desabilitado: defina NEXT_PUBLIC_EMA_API_URL, NEXT_PUBLIC_EMA_AAD_CLIENT_ID e NEXT_PUBLIC_EMA_AAD_TENANT_ID.",
      );
    }
    return null;
  }
  return { apiUrl: apiUrl.replace(/\/+$/, ""), clientId, tenantId };
}
