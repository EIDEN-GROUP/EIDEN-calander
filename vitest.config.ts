import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Unit tests run outside React Server Components: stub the marker.
      "server-only": fileURLToPath(new URL("./lib/mail/server-only.stub.ts", import.meta.url)),
    },
  },
});
