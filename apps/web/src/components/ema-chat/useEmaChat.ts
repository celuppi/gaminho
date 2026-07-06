// Estado do chat com a EMA: cria a sessão na primeira mensagem e consome o
// SSE do POST /api/v2/chat via fetch streaming (EventSource não faz POST).
import { useCallback, useRef, useState } from "react";

export interface EmaMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * "ok" = enviado; "auth" = precisa de login interativo (o painel mostra o
 * botão "Entrar com Microsoft" e devolve o texto ao input); "error" = falha
 * de rede/EMA (mensagem amigável em `error`).
 */
export type SendOutcome = "ok" | "auth" | "error";

export interface SendArgs {
  message: string;
  pageContext: string;
  getToken: () => Promise<string>;
  apiUrl: string;
}

const MSG_SEM_ACESSO =
  "Seu usuário não tem acesso à EMA — fale com o administrador.";
const MSG_ERRO_GENERICO =
  "Não consegui falar com a EMA agora. Tente novamente em instantes.";

export function useEmaChat() {
  const [messages, setMessages] = useState<EmaMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    sessionRef.current = null;
    setMessages([]);
    setError(null);
  }, []);

  const appendToAssistant = useCallback((chunk: string) => {
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") {
        copy[copy.length - 1] = {
          role: "assistant",
          content: last.content + chunk,
        };
      }
      return copy;
    });
  }, []);

  const send = useCallback(
    async ({
      message,
      pageContext,
      getToken,
      apiUrl,
    }: SendArgs): Promise<SendOutcome> => {
      setBusy(true);
      setError(null);

      // Token ANTES de renderizar a mensagem: se precisar de login
      // interativo, o painel devolve o texto ao input em vez de deixar uma
      // pergunta órfã no histórico.
      let token: string;
      try {
        token = await getToken();
      } catch (err) {
        console.error("[ema-chat] autenticação silenciosa falhou:", err);
        setBusy(false);
        return "auth";
      }

      setMessages((m) => [
        ...m,
        { role: "user", content: message },
        { role: "assistant", content: "" },
      ]);
      try {
        const authHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        if (!sessionRef.current) {
          const res = await fetch(`${apiUrl}/api/v2/chat/sessions`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ title: `Kanban — ${message.slice(0, 50)}` }),
          });
          if (res.status === 401 || res.status === 403)
            throw new Error("SEM_ACESSO");
          if (!res.ok) throw new Error(`EMA respondeu ${res.status}`);
          const session = (await res.json()) as { id: string };
          sessionRef.current = session.id;
        }

        const res = await fetch(`${apiUrl}/api/v2/chat`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            sessionId: sessionRef.current,
            message,
            pageContext,
          }),
        });
        if (res.status === 401 || res.status === 403)
          throw new Error("SEM_ACESSO");
        if (!res.ok || !res.body) throw new Error(`EMA respondeu ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const line = evt
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!line) continue;
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              error?: string;
            };
            if (data.type === "chunk" && data.content) {
              appendToAssistant(data.content);
            } else if (data.type === "error") {
              throw new Error(data.error ?? "erro no stream");
            }
            // type === "done": o conteúdo final já foi acumulado via chunks
          }
        }
        return "ok";
      } catch (err) {
        console.error("[ema-chat] falha ao falar com a EMA:", err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg === "SEM_ACESSO" ? MSG_SEM_ACESSO : MSG_ERRO_GENERICO);
        return "error";
      } finally {
        setBusy(false);
      }
    },
    [appendToAssistant],
  );

  return { messages, busy, error, send, reset };
}
