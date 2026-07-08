// apps/web/src/components/ema-chat/MessageBubble.tsx
// Um balão de mensagem do chat da EMA: usuário (direita) ou assistente
// (avatar + markdown). Entrada animada (fade/slide). Enquanto a resposta
// ainda não chegou, mostra o indicador de digitação.
import type { Components } from "react-markdown";
import { motion, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { EmaMessage } from "./useEmaChat";

import TypingDots from "./TypingDots";

/** Remove a tag <suggestions> que a EMA anexa para o app dela. */
function stripSuggestions(content: string): string {
  return content.replace(/<suggestions>[\s\S]*?<\/suggestions>/g, "").trim();
}

// Links em nova aba; links de card/board viram badge; tabelas roláveis
// (o painel tem 400px e respostas de BI vêm largas).
const markdownComponents: Components = {
  a: ({ node: _node, href, children, ...props }) => {
    // Deep-links de card da EMA: https://hub2.construtorabaggio.com.br/cards/{id}
    const isCard = typeof href === "string" && href.includes("/cards/");
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer"
        className={
          isCard
            ? "inline-flex items-center gap-1 rounded-full bg-violet-600/10 px-2 py-0.5 text-xs font-medium text-violet-700 no-underline hover:bg-violet-600/20 dark:text-violet-300"
            : undefined
        }
      >
        {children}
      </a>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

function EmaAvatar() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white"
    >
      E
    </span>
  );
}

export default function MessageBubble({
  message,
  isTyping,
}: {
  message: EmaMessage;
  isTyping?: boolean;
}) {
  const isUser = message.role === "user";
  const text = stripSuggestions(message.content);
  const reduce = useReducedMotion();

  if (!isUser && !text && !isTyping) return null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={isUser ? "flex justify-end" : "flex gap-2"}
    >
      {!isUser && <EmaAvatar />}
      {isUser ? (
        <div className="ml-8 rounded-2xl rounded-tr-sm bg-violet-600/10 px-3 py-2 text-sm text-neutral-900 dark:text-dark-1000">
          {message.content}
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none rounded-2xl rounded-tl-sm bg-light-100 px-3 py-2 text-sm text-neutral-900 dark:bg-dark-100 dark:text-dark-1000">
          {text ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {text}
            </ReactMarkdown>
          ) : isTyping ? (
            <TypingDots />
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
