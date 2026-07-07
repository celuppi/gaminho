import { describe, expect, it } from "vitest";

import { parsePersistedChat } from "./useEmaChat";

describe("parsePersistedChat", () => {
  it("retorna null para vazio ou JSON inválido", () => {
    expect(parsePersistedChat(null)).toBeNull();
    expect(parsePersistedChat("")).toBeNull();
    expect(parsePersistedChat("{nope")).toBeNull();
    expect(parsePersistedChat('{"sessionId":"x"}')).toBeNull();
  });

  it("restaura sessionId e mensagens válidas", () => {
    const raw = JSON.stringify({
      sessionId: "abc-123",
      messages: [
        { role: "user", content: "minhas tarefas atrasadas?" },
        { role: "assistant", content: "Você tem 3 tarefas…" },
      ],
    });
    expect(parsePersistedChat(raw)).toEqual({
      sessionId: "abc-123",
      messages: [
        { role: "user", content: "minhas tarefas atrasadas?" },
        { role: "assistant", content: "Você tem 3 tarefas…" },
      ],
    });
  });

  it("descarta mensagens malformadas e vazias (placeholder de stream)", () => {
    const raw = JSON.stringify({
      sessionId: 42,
      messages: [
        { role: "user", content: "oi" },
        { role: "assistant", content: "" },
        { role: "system", content: "intruso" },
        { role: "assistant", content: 7 },
        null,
      ],
    });
    expect(parsePersistedChat(raw)).toEqual({
      sessionId: null,
      messages: [{ role: "user", content: "oi" }],
    });
  });
});
