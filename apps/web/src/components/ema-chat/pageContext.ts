// Contexto de tela enviado à EMA em cada mensagem do widget: descreve o que
// o usuário está vendo (card/board) a partir da rota Next.js. Puro — testável.

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function buildPageContext(
  origin: string,
  pathname: string,
  query: Record<string, string | string[] | undefined>,
): string {
  const base = origin.replace(/\/+$/, "");
  if (pathname === "/cards/[cardId]") {
    const id = first(query.cardId);
    return `Card aberto: ${base}/cards/${id}`;
  }
  if (pathname === "/[workspaceSlug]/[...boardSlug]") {
    const ws = first(query.workspaceSlug);
    const board = first(query.boardSlug);
    return `Board aberto: ${board} (workspace ${ws}) — ${base}/${ws}/${board}`;
  }
  return `Tela: ${pathname}`;
}
