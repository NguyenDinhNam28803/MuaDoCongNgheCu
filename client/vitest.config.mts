import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          environment: "node",
          globalSetup: ["./test/db-global-setup.ts"],
          setupFiles: ["dotenv/config"],
          fileParallelism: false,
        },
      },
    ],
  },
});
