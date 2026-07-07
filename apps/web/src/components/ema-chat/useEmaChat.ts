// Estado do chat com a EMA: cria a sessão na primeira mensagem e consome o
// SSE do POST /api/v2/chat via fetch streaming (EventSource não faz POST).
// Histórico persistido em localStorage (por usuário): reload restaura as
// mensagens e continua a MESMA sessão do servidor — o backend da EMA é a
// fonte de verdade, aqui é só o cache de exibição.
import { useCallback, useEffect, useRef, useState } from "react";

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

export interface PersistedChat {
  sessionId: string | null;
  messages: EmaMessage[];
}

const STORAGE_PREFIX = "ema-chat.v1";
/** Teto de mensagens persistidas — o histórico completo vive no servidor. */
const PERSIST_MAX_MESSAGES = 100;

function storageKeyFor(userKey: string): string {
  return `${STORAGE_PREFIX}.${userKey.toLowerCase()}`;
}

/**
 * Valida o JSON cru vindo do localStorage (pode ser de versão antiga do
 * widget ou corrompido). Descarta mensagens malformadas e as vazias —
 * um placeholder de resposta interrompida no meio do stream, por exemplo.
 */
export function parsePersistedChat(raw: string | null): PersistedChat | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { sessionId?: unknown; messages?: unknown };
    if (!Array.isArray(data.messages)) return null;
    const messages = data.messages.filter((m: unknown): m is EmaMessage => {
      if (typeof m !== "object" || m === null) return false;
      const { role, content } = m as { role?: unknown; content?: unknown };
      return (
        (role === "user" || role === "assistant") &&
        typeof content === "string" &&
        content.trim() !== ""
      );
    });
    return {
      sessionId: typeof data.sessionId === "string" ? data.sessionId : null,
      messages,
    };
  } catch {
    return null;
  }
}

function loadPersistedChat(storageKey: string): PersistedChat | null {
  if (typeof window === "undefined") return null;
  try {
    return parsePersistedChat(window.localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

export function useEmaChat(userKey: string) {
  const storageKey = storageKeyFor(userKey);
  const [restored] = useState(() => loadPersistedChat(storageKey));
  const [messages, setMessages] = useState<EmaMessage[]>(
    restored?.messages ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(restored?.sessionId ?? null);

  // Persiste quando o turno termina (não a cada chunk do stream). Falha de
  // quota/modo privado só degrada para histórico em memória.
  useEffect(() => {
    if (busy) return;
    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      const persisted: PersistedChat = {
        sessionId: sessionRef.current,
        messages: messages
          .filter((m) => m.content.trim() !== "")
          .slice(-PERSIST_MAX_MESSAGES),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(persisted));
    } catch {
      // sem localStorage disponível — segue só em memória
    }
  }, [messages, busy, storageKey]);

  const reset = useCallback(() => {
    sessionRef.current = null;
    setMessages([]);
    setError(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // sem localStorage disponível — nada a limpar
    }
  }, [storageKey]);

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
