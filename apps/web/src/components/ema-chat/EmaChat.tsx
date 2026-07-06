// Widget da EMA no Kanban: botão flutuante + painel lateral de chat.
// Auto-contido: não renderiza sem sessão Better Auth ou sem as envs
// NEXT_PUBLIC_EMA_* (fail-soft). Contexto de tela vai em cada mensagem.
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import type { EmaEnv } from "./emaEnv";

import { buildPageContext } from "./pageContext";
import { useEmaAuth } from "./useEmaAuth";
import { useEmaChat } from "./useEmaChat";

/** Remove a tag <suggestions> que a EMA anexa para o app dela. */
function stripSuggestions(content: string): string {
  return content.replace(/<suggestions>[\s\S]*?<\/suggestions>/g, "").trim();
}

const MSG_ENTRAR = "Para falar com a EMA, entre com sua conta Microsoft.";
const MSG_POPUP_BLOQUEADO =
  "O navegador bloqueou a janela de login — permita popups para este site e tente de novo.";
const MSG_LOGIN_FALHOU =
  "Não consegui completar o login. Tente de novo em instantes.";

/** MSAL sinaliza popup bloqueado/fechado via errorCode do BrowserAuthError. */
function isPopupBlocked(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("errorCode" in err))
    return false;
  const code = (err as { errorCode: unknown }).errorCode;
  return code === "popup_window_error" || code === "empty_window_error";
}

export default function EmaChatWidget({
  cfg,
  loginHint,
}: {
  cfg: EmaEnv;
  loginHint: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const router = useRouter();
  const { status, getToken, loginWithPopup, warmUp } = useEmaAuth(loginHint);
  const { messages, busy, error, send, reset } = useEmaChat();

  // Aquecimento ao abrir o painel: resolve o initialize() do MSAL e tenta o
  // caminho silencioso — assim o clique em "Entrar com Microsoft" (se
  // necessário) abre o popup sem awaits pesados no meio do gesto.
  useEffect(() => {
    if (open) void warmUp();
  }, [open, warmUp]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || busy) return;
    // Login pendente: o aviso com o botão já está na tela — repetir o
    // caminho silencioso só faria o usuário esperar outro timeout.
    if (status === "needs_login") return;
    setInput("");
    const pageContext = buildPageContext(
      window.location.origin,
      router.pathname,
      router.query,
    );
    const outcome = await send({
      message,
      pageContext,
      getToken,
      apiUrl: cfg.apiUrl,
    });
    // Precisa de login interativo: devolve o texto ao input — o aviso com o
    // botão "Entrar com Microsoft" já está visível (status = needs_login).
    if (outcome === "auth") setInput(message);
  };

  // Chamado DIRETO do onClick: o popup precisa carregar o gesto do usuário
  // (Safari bloqueia popups abertos depois de awaits longos).
  const handleLogin = () => {
    setLoginError(null);
    loginWithPopup().catch((err: unknown) => {
      console.error("[ema-chat] login interativo falhou:", err);
      setLoginError(isPopupBlocked(err) ? MSG_POPUP_BLOQUEADO : MSG_LOGIN_FALHOU);
    });
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Conversar com a EMA"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-lg font-semibold text-white shadow-lg hover:bg-violet-700"
        >
          E
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[400px] flex-col border-l border-light-300 bg-light-50 shadow-2xl dark:border-dark-300 dark:bg-dark-50">
          <div className="flex items-center justify-between border-b border-light-300 px-4 py-3 dark:border-dark-300">
            <div className="text-sm font-semibold text-neutral-900 dark:text-dark-1000">
              EMA — Assistente da Baggio
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={reset}
                className="rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-light-200 disabled:opacity-50 dark:text-dark-900 dark:hover:bg-dark-200"
              >
                Nova conversa
              </button>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-light-200 dark:text-dark-900 dark:hover:bg-dark-200"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-dark-900">
                Pergunte sobre suas tarefas — por exemplo: “quais são minhas
                tarefas atrasadas?” ou, com um card aberto, “o que é essa
                tarefa?”.
              </p>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="ml-8 rounded-lg bg-violet-600/10 px-3 py-2 text-sm text-neutral-900 dark:text-dark-1000"
                >
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className="prose prose-sm dark:prose-invert mr-4 max-w-none text-sm text-neutral-900 dark:text-dark-1000"
                >
                  <ReactMarkdown>
                    {stripSuggestions(m.content) ||
                      (busy && i === messages.length - 1 ? "…" : "")}
                  </ReactMarkdown>
                </div>
              ),
            )}
            {status === "needs_login" && (
              <div className="rounded-lg bg-violet-600/10 px-3 py-2 text-sm text-neutral-900 dark:text-dark-1000">
                <p>{MSG_ENTRAR}</p>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
                >
                  Entrar com Microsoft
                </button>
                {loginError && (
                  <p className="mt-2 text-red-600 dark:text-red-400">
                    {loginError}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="border-t border-light-300 p-3 dark:border-dark-300">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Escreva para a EMA… (Enter envia)"
              className="w-full resize-none rounded-lg border border-light-300 bg-light-50 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-violet-500/50 dark:border-dark-300 dark:bg-dark-100 dark:text-dark-1000"
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void handleSend()}
              className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? "EMA respondendo…" : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
