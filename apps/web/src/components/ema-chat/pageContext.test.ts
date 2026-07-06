import { describe, expect, it } from "vitest";

import { buildPageContext } from "./pageContext";

const ORIGIN = "https://hub2.construtorabaggio.com.br";

describe("buildPageContext", () => {
  it("card aberto: identifica o publicId e monta o link", () => {
    const out = buildPageContext(ORIGIN, "/cards/[cardId]", {
      cardId: "abc123def456",
    });
    expect(out).toContain("Card aberto");
    expect(out).toContain(`${ORIGIN}/cards/abc123def456`);
  });

  it("board aberto: identifica workspace e board", () => {
    const out = buildPageContext(ORIGIN, "/[workspaceSlug]/[...boardSlug]", {
      workspaceSlug: "baggio",
      boardSlug: ["obras-curitiba"],
    });
    expect(out).toContain("Board aberto: obras-curitiba");
    expect(out).toContain("workspace baggio");
    expect(out).toContain(`${ORIGIN}/baggio/obras-curitiba`);
  });

  it("outras telas: caminho genérico", () => {
    expect(buildPageContext(ORIGIN, "/settings", {})).toBe("Tela: /settings");
  });

  it("query em array (catch-all) usa o primeiro segmento", () => {
    const out = buildPageContext(ORIGIN, "/cards/[cardId]", {
      cardId: ["xyz789"],
    });
    expect(out).toContain(`${ORIGIN}/cards/xyz789`);
  });
});
