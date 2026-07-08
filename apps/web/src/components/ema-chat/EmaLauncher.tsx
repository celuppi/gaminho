// apps/web/src/components/ema-chat/EmaLauncher.tsx
// Campo flutuante do estado fechado do widget da EMA: um "convite" para
// perguntar. Ao enviar, o EmaChat abre o painel e dispara a pergunta.
// Componente de apresentação — sem posicionamento fixo nem animação (o
// EmaChat cuida de posição/animação de abertura).
import { useState } from "react";

export default function EmaLauncher({
  onSubmit,
}: {
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const message = text.trim();
    if (!message) return;
    setText("");
    onSubmit(message);
  };

  return (
    <div
      role="search"
      aria-label="Conversar com a EMA"
      className="flex w-[min(90vw,440px)] items-center gap-2 rounded-full border border-light-300 bg-light-50/95 px-2 py-1.5 shadow-lg backdrop-blur dark:border-dark-300 dark:bg-dark-50/95"
    >
      <span
        aria-hidden="true"
        className="ml-1 flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white"
      >
        E
      </span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Pergunte à EMA…"
        aria-label="Pergunte à EMA"
        className="min-w-0 flex-1 bg-transparent px-1 text-sm text-neutral-900 placeholder-light-700 focus:outline-none dark:text-dark-1000 dark:placeholder-dark-700"
      />
      <button
        type="button"
        aria-label="Enviar pergunta"
        disabled={!text.trim()}
        onClick={submit}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
      >
        ➤
      </button>
    </div>
  );
}
