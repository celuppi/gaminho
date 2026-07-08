# Design — Widget da EMA mais amigável: launcher flutuante + resposta caprichada

Data: 2026-07-08
Status: Aprovado (design)

## Objetivo

Tornar a incorporação do chat da EMA no Kanban mais amigável. Duas mudanças de
UX, **puramente de apresentação**:

1. Substituir a bolinha "E" (FAB no canto inferior direito) por um **campo de
   escrever flutuante, centralizado na parte inferior da tela**.
2. Ao enviar a pergunta, abrir a resposta **de forma mais bonita** — abertura
   animada, balões com avatar e indicador de "digitando…", tipografia caprichada
   e micro-animação em cada mensagem.

## Decisões (do brainstorming)

- **Onde a resposta aparece:** mantém o **painel lateral de 400px à direita**
  (como hoje). Só muda o ponto de entrada.
- **O campo flutuante ao abrir o painel:** é o "convite" inicial. Ao
  enviar/abrir, ele **some** e a conversa continua pelo campo **dentro do
  painel** (comportamento atual).
- **Capricho na resposta:** os quatro toques aprovados — (a) abertura animada do
  painel, (b) balões + avatar + "digitando…", (c) tipografia caprichada,
  (d) micro-animação por mensagem.

## Fora de escopo (não mexer)

- Autenticação MSAL/Azure AD (`useEmaAuth.ts`, `authBridge.ts`).
- Streaming SSE e criação de sessão (`useEmaChat.ts` — lógica).
- Persistência do histórico em localStorage.
- Envs e gate de renderização (`emaEnv.ts`, `EmaChatLoader.tsx`).

A API pública dos hooks `useEmaAuth`/`useEmaChat` permanece **estável**, para os
testes existentes (`useEmaChat.test.ts`, `pageContext.test.ts`) continuarem
passando.

## Dependências

Nenhuma nova. Já presentes em `apps/web`:

- `framer-motion` (^12) — animações (já usado em `views/boards`).
- `@tailwindcss/typography` — classe `prose` (já usada no EmaChat).
- `react-markdown` + `remark-gfm` — render do markdown (já usados).

## Arquitetura

Quebrar o `EmaChat.tsx` (hoje ~256 linhas, vai crescer) em unidades focadas.
O `EmaChat` continua como **orquestrador**: detém o estado `open` e fia os hooks
`useEmaAuth`/`useEmaChat`.

Novos componentes, todos em `apps/web/src/components/ema-chat/`:

| Componente | Responsabilidade | Depende de |
|---|---|---|
| `EmaLauncher.tsx` | O campo flutuante do estado fechado (pill centralizado embaixo). Input local próprio; ao submeter, chama `onSubmit(text)`. | — (apresentação pura) |
| `MessageBubble.tsx` | Renderiza UMA mensagem: avatar (EMA) + balão + markdown, com animação de entrada. | `react-markdown`, `remark-gfm`, `framer-motion` |
| `TypingDots.tsx` | Indicador animado de três pontinhos. | `framer-motion` |

`EmaChat.tsx` importa os três e mantém: estado `open`, painel aberto, área de
mensagens, campo do painel, e os avisos de `needs_login`/erro (restilizados).

## Componentes — detalhe

### EmaLauncher (estado fechado)

- Posição: `fixed bottom-5 left-1/2 -translate-x-1/2 z-50`, `max-w-[90vw]`
  (mobile-friendly).
- Forma: *pill* (`rounded-full`) com sombra, borda e fundo (light/dark).
- Conteúdo: avatar da EMA à esquerda (círculo violeta com "E"), input no meio
  (placeholder "Pergunte à EMA…"), botão enviar à direita (ícone de seta).
- Interação: Enter (sem Shift) ou clique no botão → `onSubmit(text)` com o texto;
  limpa o input local.
- Acessibilidade: `aria-label` na região/input ("Conversar com a EMA"),
  `aria-label` no botão de enviar.

### Transição fechado → aberto

- `AnimatePresence` no `EmaChat`: quando `open` vira `true`, o `EmaLauncher`
  sai (fade + leve scale) e o painel entra deslizando da direita
  (`initial {x: 400, opacity: 0} → animate {x: 0, opacity: 1}`,
  `exit` reverso). Cross-fade limpo — sem "morph" com `layoutId` (mais robusto).
- Respeitar `prefers-reduced-motion`: transições reduzidas/instantâneas quando o
  usuário pede menos animação (via variantes do framer-motion).

### Painel (estado aberto) — restyle

- Mantém `fixed ... right-0 top-0 bottom-0 w-full max-w-[400px]`, header
  "EMA — Assistente da Baggio" + "Nova conversa" + fechar (✕), e o
  `textarea` + botão "Enviar" **no rodapé do painel** (como hoje).

### MessageBubble

- Usuário: balão alinhado à direita, tom violeta (`bg-violet-600/10`).
- EMA: avatar pequeno à esquerda + balão com markdown via `prose prose-sm
  dark:prose-invert`, `components` de markdown (links em nova aba;
  tabelas roláveis — preservar o comportamento atual).
- Links de tarefas/cards citados pela EMA: renderizados como **badge**
  destacado (pill pequeno), mantendo `target="_blank" rel="noreferrer"`.
- Animação de entrada: `initial {opacity: 0, y: 8} → animate {opacity: 1, y: 0}`.
- Mantém o `stripSuggestions()` atual (remove a tag `<suggestions>`).

### TypingDots

- Três pontinhos com animação em loop (opacidade/altura escalonada) via
  `framer-motion`. Exibido no lugar do "…" quando `busy` e a última mensagem do
  assistant ainda está vazia — dentro de um balão da EMA com avatar.

## Fluxo de dados

- `EmaChat` detém `open` (`useState`) e os hooks (inalterados).
- **Fechado:** renderiza `<EmaLauncher onSubmit={handleLaunch} />`.
- `handleLaunch(text)`: `setOpen(true)` → chama o envio com o texto explícito.
- Refactor mínimo: `handleSend` passa a aceitar um parâmetro opcional
  `message?: string` (default = `input` do painel). Assim o launcher injeta o
  texto direto, sem depender do estado `input` do painel.
- **Caso `needs_login`:** se o envio pelo launcher retornar `outcome === "auth"`,
  o painel abre já mostrando o aviso + botão "Entrar com Microsoft" e o texto é
  devolvido ao `input` do painel (`setInput(message)`) — mesmo comportamento de
  hoje, agora a partir do launcher.
- **Aberto:** área de mensagens mapeia `messages` para `MessageBubble`; enquanto
  `busy`, mostra `TypingDots`.

## Tratamento de erros

Lógica inalterada. Os estados `needs_login` e `error` continuam vindos dos hooks;
só são **restilizados** para combinar com os novos balões (o aviso de login e a
mensagem de erro amigável seguem os mesmos textos atuais).

## Testes

Mudança majoritariamente apresentacional. Critérios:

- Os testes existentes (`useEmaChat.test.ts`, `pageContext.test.ts`) continuam
  passando — API dos hooks intacta.
- `typecheck` limpo (`pnpm --filter @kan/web typecheck`).
- Verificação manual no dev (`/boards` logado, com as envs EMA no `.env`):
  campo flutuante aparece centralizado embaixo; enviar abre o painel animado;
  balões, avatar, "digitando…" e micro-animações presentes; "Nova conversa" e
  fechar funcionam; caso sem sessão AAD, o botão "Entrar com Microsoft" aparece.
- Sem novo teste unitário obrigatório (YAGNI); o launcher é apresentação. Um
  teste de render leve do `EmaLauncher` (submit chama `onSubmit` com o texto) é
  opcional.

## Arquivos afetados

- `apps/web/src/components/ema-chat/EmaChat.tsx` — orquestrador; novo estado
  fechado (launcher), animação de abertura, uso de `MessageBubble`/`TypingDots`.
- `apps/web/src/components/ema-chat/EmaLauncher.tsx` — **novo**.
- `apps/web/src/components/ema-chat/MessageBubble.tsx` — **novo**.
- `apps/web/src/components/ema-chat/TypingDots.tsx` — **novo**.
