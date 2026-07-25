import { defineConfig } from "vitest/config";

// Config dedicada e isolada do vite.config.ts da aplicação — só para os
// testes do ZanotelliBridgeClient (scripts/zanotelli-bridge). Não afeta
// dev/build do app.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },
});
