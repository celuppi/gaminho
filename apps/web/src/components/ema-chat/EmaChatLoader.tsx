// Gate leve do widget: checa sessão + envs SEM puxar o bundle pesado; o
// EmaChat (msal-browser + react-markdown) só é baixado quando habilitado.
import dynamic from "next/dynamic";

import { authClient } from "@kan/auth/client";

import { getEmaEnv } from "./emaEnv";

const EmaChat = dynamic(() => import("./EmaChat"), { ssr: false });

export function EmaChatLoader() {
  const { data: session } = authClient.useSession();
  const cfg = getEmaEnv();
  if (!session?.user || !cfg) return null;
  return <EmaChat cfg={cfg} loginHint={session.user.email} />;
}
