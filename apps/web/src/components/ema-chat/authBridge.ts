// Bridge de retorno do login da EMA (MSAL v5).
//
// No fluxo do MSAL v5, o popup/iframe de login volta da Microsoft para o
// redirectUri (a raiz do hub2) e a resposta PRECISA ser retransmitida à
// janela principal via BroadcastChannel — quem faz isso é o script
// "redirect-bridge" do próprio MSAL, rodando NA página de retorno. Sem ele,
// o ssoSilent estoura timed_out e o popup fica carregando o app inteiro em
// vez de concluir o login (foi exatamente o sintoma em produção).
//
// installEmaAuthBridge() deve rodar no ESCOPO DE MÓDULO do _app (antes da
// hidratação e do router): assim o broadcast dispara antes de qualquer
// redirect client-side derrubar o fragment (#code=...&state=...).

/**
 * True quando ESTA janela é um popup/iframe do MSAL voltando do
 * login.microsoftonline.com: janela filha + resposta OAuth no fragment.
 * Os callbacks OAuth do próprio Kan (Better Auth) usam query string em
 * rotas /api/auth/* — nunca fragment em página renderizada — então não
 * colidem com esta detecção.
 */
function isMsalAuthReturn(): boolean {
  if (typeof window === "undefined") return false;
  const isChildWindow = window.opener !== null || window.parent !== window;
  if (!isChildWindow) return false;
  const hash = window.location.hash;
  return hash.includes("code=") && hash.includes("state=");
}

export function installEmaAuthBridge(): void {
  if (!isMsalAuthReturn()) return;
  const authHash = window.location.hash;
  void import("@azure/msal-browser/redirect-bridge")
    .then((bridge) => {
      // Se algum redirect do app derrubou o fragment enquanto o chunk
      // carregava, restaura antes do broadcast (o bridge lê a URL).
      if (window.location.hash !== authHash) window.location.hash = authHash;
      return bridge.broadcastResponseToMainFrame();
    })
    .catch((err: unknown) => {
      console.error("[ema-chat] redirect-bridge falhou:", err);
    });
}
