// Widget da EMA no Kanban: botão flutuante + painel lateral de chat.
// Auto-contido: não renderiza sem sessão Better Auth ou sem as envs
// NEXT_PUBLIC_EMA_* (fail-soft). Contexto de tela vai em cada mensagem.
import { useRouter } from "next/router";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

import type { EmaEnv } from "./useEmaAuth";

import { authClient } from "@kan/auth/client";

import { buildPageContext } from "./pageContext";
import { getEmaEnv, useEmaAuth } from "./useEmaAuth";
import { useEmaChat } from "./useEmaChat";

/** Remove a tag <suggestions> que a EMA anexa para o app dela. */
function stripSuggestions(content: string): string {
  return content.replace(/<suggestions>[\s\S]*?<\/suggestions>/g, "").trim();
}

export function EmaChat() {
  const { data: session } = authClient.useSession();
  const cfg = getEmaEnv();
  if (!session?.user || !cfg) return null;
  return <EmaChatWidget cfg={cfg} loginHint={session.user.email} />;
}

function EmaChatWidget({
  cfg,
  loginHint,
}: {
  cfg: EmaEnv;
  loginHint: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const router = useRouter();
  const { getToken } = useEmaAuth(loginHint);
  const { messages, busy, error, send, reset } = useEmaChat();

  const handleSend = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    const pageContext = buildPageContext(
      window.location.origin,
      router.pathname,
      router.query,
    );
    await send({ message, pageContext, getToken, apiUrl: cfg.apiUrl });
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
