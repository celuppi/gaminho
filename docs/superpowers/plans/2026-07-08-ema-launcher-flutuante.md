# EMA — Launcher Flutuante + Resposta Caprichada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a bolinha "E" do widget da EMA por um campo de escrever flutuante centralizado embaixo e abrir a resposta de forma mais bonita (animação, balões + avatar + "digitando…", tipografia caprichada, micro-animação por mensagem).

**Architecture:** `EmaChat.tsx` continua orquestrador (estado `open` + hooks `useEmaAuth`/`useEmaChat`). Extraímos três componentes de apresentação em `apps/web/src/components/ema-chat/`: `TypingDots` (pontinhos), `MessageBubble` (balão + avatar + markdown + animação), `EmaLauncher` (o pill flutuante). Animações via `framer-motion`; tipografia via `prose` (`@tailwindcss/typography`). Nenhuma dependência nova.

**Tech Stack:** React 18, Next.js (Pages Router), TypeScript, Tailwind CSS, framer-motion (^12), react-markdown (^10) + remark-gfm (^4).

## Global Constraints

- **Nenhuma dependência nova.** Só `framer-motion`, `@tailwindcss/typography`, `react-markdown`, `remark-gfm` — todas já em `apps/web/package.json`.
- **API pública de `useEmaAuth`/`useEmaChat` inalterada** — os testes `useEmaChat.test.ts` e `pageContext.test.ts` continuam verdes.
- **Não mexer** em auth/MSAL (`useEmaAuth.ts`, `authBridge.ts`), streaming SSE / criação de sessão (lógica de `useEmaChat.ts`), persistência em localStorage, envs/gate (`emaEnv.ts`, `EmaChatLoader.tsx`).
- **Marca:** header do painel = `EMA — Assistente da Baggio`. "gaminho" nunca aparece ao usuário.
- **Placeholder do launcher:** `Pergunte à EMA…`. **Avatar:** a letra `E` em círculo violeta.
- **Respeitar `prefers-reduced-motion`** (via `useReducedMotion()` do framer-motion): sem entrada/saída animadas quando o usuário pede menos movimento.
- **Links de card/board** abrem em nova aba (`target="_blank" rel="noreferrer"`) — preservar.
- **Verificação** (não há harness de DOM no projeto; vitest roda só lógica): cada task termina com `pnpm --filter @kan/web typecheck` limpo; tasks de integração incluem conferência visual no dev (servidor já roda em `localhost:3000`, `/boards` logado, envs EMA presentes); `pnpm --filter @kan/web test` verde ao final.
- Trailer de commit obrigatório: `Co-Authored-By: Raphael Celuppi <raphael.celuppi@gmail.com>`.

---

### Task 1: TypingDots (indicador "digitando…")

**Files:**
- Create: `apps/web/src/components/ema-chat/TypingDots.tsx`

**Interfaces:**
- Consumes: `framer-motion` (`motion`).
- Produces: `export default function TypingDots(): JSX.Element` — três pontinhos animados em loop. Sem props.

- [ ] **Step 1: Criar o componente**

```tsx
// apps/web/src/components/ema-chat/TypingDots.tsx
// Três pontinhos animados: substitui o "…" enquanto a EMA gera a resposta.
import { motion } from "framer-motion";

export default function TypingDots() {
  return (
    <span
      className="inline-flex items-center gap-1 py-1"
      aria-label="EMA está digitando"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kan/web typecheck`
Expected: sem erros (saída só com o cabeçalho `tsc --noEmit`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ema-chat/TypingDots.tsx
git commit -m "feat(ema-chat): componente TypingDots (indicador de digitação)

Co-Authored-By: Raphael Celuppi <raphael.celuppi@gmail.com>"
```

---

### Task 2: MessageBubble (balão + avatar + markdown + animação)

**Files:**
- Create: `apps/web/src/components/ema-chat/MessageBubble.tsx`

**Interfaces:**
- Consumes: `TypingDots` (Task 1); `react-markdown`, `remark-gfm`, `framer-motion`; o tipo `EmaMessage` de `./useEmaChat`.
- Produces: `export default function MessageBubble({ message, isTyping }: { message: EmaMessage; isTyping?: boolean }): JSX.Element`.
  - `message.role === "user"` → balão à direita (tom violeta).
  - `message.role === "assistant"` → avatar "E" à esquerda + conteúdo markdown; se `content` vazio e `isTyping` → `<TypingDots />`.
  - Move para cá o `stripSuggestions()` e os `markdownComponents` (hoje em `EmaChat.tsx`), acrescentando o estilo de **badge** para links de card/board.

- [ ] **Step 1: Criar o componente**

```tsx
// apps/web/src/components/ema-chat/MessageBubble.tsx
// Um balão de mensagem do chat da EMA: usuário (direita) ou assistente
// (avatar + markdown). Entrada animada (fade/slide). Enquanto a resposta
// ainda não chegou, mostra o indicador de digitação.
import type { Components } from "react-markdown";
import { motion } from "framer-motion";
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
    <span className="mt-0.5 flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
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
  const text = isUser ? message.content : stripSuggestions(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kan/web typecheck`
Expected: sem erros.

> Nota: `EmaMessage` já é exportado por `useEmaChat.ts` (`export interface EmaMessage`). Não alterar esse arquivo.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ema-chat/MessageBubble.tsx
git commit -m "feat(ema-chat): componente MessageBubble (avatar, markdown, badges, animação)

Co-Authored-By: Raphael Celuppi <raphael.celuppi@gmail.com>"
```

---

### Task 3: EmaLauncher (campo flutuante do estado fechado)

**Files:**
- Create: `apps/web/src/components/ema-chat/EmaLauncher.tsx`

**Interfaces:**
- Consumes: React (`useState`).
- Produces: `export default function EmaLauncher({ onSubmit }: { onSubmit: (text: string) => void }): JSX.Element` — pill com avatar "E", input (placeholder `Pergunte à EMA…`) e botão enviar. Enter (sem Shift) ou clique → `onSubmit(text.trim())` se não-vazio; limpa o input local.

> **Centralização:** NÃO usar `-translate-x-1/2` no elemento que o framer-motion anima — o framer-motion escreve `transform` inline e apagaria o translate do Tailwind. No EmaChat (Task 5) o wrapper animado centraliza via `flex justify-center`; aqui o `EmaLauncher` é só o pill (largura própria), sem posicionamento fixo.

- [ ] **Step 1: Criar o componente**

```tsx
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
      aria-label="Conversar com a EMA"
      className="flex w-[min(90vw,440px)] items-center gap-2 rounded-full border border-light-300 bg-light-50/95 px-2 py-1.5 shadow-lg backdrop-blur dark:border-dark-300 dark:bg-dark-50/95"
    >
      <span className="ml-1 flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kan/web typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ema-chat/EmaLauncher.tsx
git commit -m "feat(ema-chat): componente EmaLauncher (campo flutuante de entrada)

Co-Authored-By: Raphael Celuppi <raphael.celuppi@gmail.com>"
```

---

### Task 4: Integrar no EmaChat (launcher + MessageBubble/TypingDots + handleSend com texto)

**Files:**
- Modify: `apps/web/src/components/ema-chat/EmaChat.tsx`

**Interfaces:**
- Consumes: `EmaLauncher` (Task 3), `MessageBubble` (Task 2). `TypingDots` passa a ser usado só por dentro do `MessageBubble`.
- Produces: comportamento — estado fechado mostra o `EmaLauncher` centralizado embaixo; enviar por ele abre o painel e dispara a pergunta; a lista de mensagens usa `MessageBubble`.

> Esta task entrega tudo funcionando **sem** a animação de abertura (o painel aparece direto). A animação vem na Task 5, isolada para revisão.

- [ ] **Step 1: Trocar imports do topo do arquivo**

Remover os imports agora movidos para `MessageBubble` e adicionar os novos componentes. Substituir o bloco de imports (linhas ~4-14) por:

```tsx
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import type { EmaEnv } from "./emaEnv";

import { buildPageContext } from "./pageContext";
import EmaLauncher from "./EmaLauncher";
import MessageBubble from "./MessageBubble";
import { useEmaAuth } from "./useEmaAuth";
import { useEmaChat } from "./useEmaChat";
```

- [ ] **Step 2: Remover `stripSuggestions` e `markdownComponents` do EmaChat**

Eles agora vivem em `MessageBubble.tsx`. Apagar do `EmaChat.tsx`:
- a função `stripSuggestions` (comentário + corpo);
- a const `markdownComponents` (comentário + corpo);
- os imports `ReactMarkdown`, `remarkGfm` e `type Components` (já removidos no Step 1).

Manter as constantes `MSG_ENTRAR`, `MSG_POPUP_BLOQUEADO`, `MSG_LOGIN_FALHOU` e a função `isPopupBlocked`.

- [ ] **Step 3: `handleSend` aceita um texto explícito**

Substituir a assinatura/uso do `handleSend` (linhas ~90-111) para aceitar um parâmetro opcional; assim o launcher injeta o texto sem depender do estado `input` do painel:

```tsx
  const handleSend = async (overrideMessage?: string) => {
    const message = (overrideMessage ?? input).trim();
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

  // Enviar a partir do campo flutuante: abre o painel e dispara a pergunta.
  const handleLaunch = (text: string) => {
    setOpen(true);
    void handleSend(text);
  };
```

- [ ] **Step 4: Estado fechado = EmaLauncher (substitui o FAB "E")**

Trocar o bloco `{!open && (<button …>E</button>)}` (linhas ~130-139) por:

```tsx
      {!open && (
        <div className="fixed bottom-5 left-0 right-0 z-50 flex justify-center px-4">
          <EmaLauncher onSubmit={handleLaunch} />
        </div>
      )}
```

- [ ] **Step 5: Lista de mensagens usa MessageBubble**

Trocar o `.map` das mensagens (linhas ~179-201) por:

```tsx
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                isTyping={busy && i === messages.length - 1}
              />
            ))}
```

- [ ] **Step 6: Ajustar o `onClick` do botão "Enviar" do painel**

O botão do rodapé chamava `handleSend()` sem argumento — continua válido (usa o `input` do painel). Confirmar que a linha ficou `onClick={() => void handleSend()}` (sem alteração necessária além do Step 3).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @kan/web typecheck`
Expected: sem erros. (Se acusar `stripSuggestions`/`markdownComponents`/`ReactMarkdown` não usados, é porque sobrou resíduo do Step 2 — remover.)

- [ ] **Step 8: Testes existentes verdes**

Run: `pnpm --filter @kan/web test`
Expected: todos passam (nenhum arquivo de teste foi tocado; hooks intactos).

- [ ] **Step 9: Conferência visual no dev**

Servidor já roda em `localhost:3000`. Em `/boards` (logado, envs EMA no `.env`):
- fechado: pill flutuante centralizado embaixo com "E", placeholder "Pergunte à EMA…" e botão ➤;
- digitar + Enter: o painel abre à direita e a pergunta é enviada;
- resposta: balões com avatar "E", markdown formatado, "digitando…" (pontinhos) enquanto gera;
- sem sessão AAD: aparece o aviso + botão "Entrar com Microsoft" com o texto preservado no input do painel;
- "Nova conversa" e ✕ funcionam.

Confirmar no log do dev que compilou (`✓ Compiled`) sem erro.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/ema-chat/EmaChat.tsx
git commit -m "feat(ema-chat): campo flutuante substitui o FAB; balões via MessageBubble

Co-Authored-By: Raphael Celuppi <raphael.celuppi@gmail.com>"
```

---

### Task 5: Animação de abertura (AnimatePresence) + reduced-motion

**Files:**
- Modify: `apps/web/src/components/ema-chat/EmaChat.tsx`

**Interfaces:**
- Consumes: `framer-motion` (`AnimatePresence`, `motion`, `useReducedMotion`).
- Produces: transição cross-fade launcher↔painel; painel desliza da direita; respeita `prefers-reduced-motion`.

- [ ] **Step 1: Importar framer-motion**

Adicionar ao topo do `EmaChat.tsx`:

```tsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
```

- [ ] **Step 2: Ler a preferência de movimento**

Dentro do componente, junto aos outros hooks (após `useEmaChat`):

```tsx
  const reduceMotion = useReducedMotion();
```

- [ ] **Step 3: Envolver o launcher em AnimatePresence + motion**

Trocar o bloco do Step 4 da Task 4 por:

```tsx
      <AnimatePresence>
        {!open && (
          <motion.div
            key="ema-launcher"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-5 left-0 right-0 z-50 flex justify-center px-4"
          >
            <EmaLauncher onSubmit={handleLaunch} />
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 4: Envolver o painel em AnimatePresence + motion**

Trocar `{open && (<div className="fixed bottom-0 right-0 top-0 …">…</div>)}` por um `motion.div` que desliza da direita. Substituir a abertura do bloco (linha `{open && (` e a `<div className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[400px] …">`) por:

```tsx
      <AnimatePresence>
        {open && (
          <motion.div
            key="ema-panel"
            initial={reduceMotion ? false : { x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[400px] flex-col border-l border-light-300 bg-light-50 shadow-2xl dark:border-dark-300 dark:bg-dark-50"
          >
```

E o fechamento correspondente: trocar o `</div>` que fechava esse painel e o `)}` por `</motion.div>` + `)}` + `</AnimatePresence>`. (O conteúdo interno do painel — header, mensagens, rodapé — permanece igual.)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @kan/web typecheck`
Expected: sem erros. (JSX balanceado: `motion.div` do painel fechado com `</motion.div>`.)

- [ ] **Step 6: Conferência visual no dev**

Em `/boards`:
- abrir: o pill some com fade e o painel desliza suavemente da direita;
- fechar (✕): o painel desliza de volta e o pill reaparece;
- com `prefers-reduced-motion` ligado no SO: abertura/fechamento sem deslize (só troca), sem travar.

Confirmar `✓ Compiled` no log do dev.

- [ ] **Step 7: Testes verdes + commit**

```bash
pnpm --filter @kan/web test
git add apps/web/src/components/ema-chat/EmaChat.tsx
git commit -m "feat(ema-chat): abertura animada do painel + reduced-motion

Co-Authored-By: Raphael Celuppi <raphael.celuppi@gmail.com>"
```

---

## Notas de verificação final

- `pnpm --filter @kan/web typecheck` limpo.
- `pnpm --filter @kan/web test` verde (testes de lógica intactos).
- Widget: campo flutuante embaixo ao centro; abertura animada; balões + avatar + "digitando…"; tipografia caprichada; micro-animação por mensagem; caminho de login Microsoft preservado.
- Nenhuma dependência nova; hooks de auth/chat inalterados.
