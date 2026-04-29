import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      // istanbul provider — v8 needs `node:inspector` which Bun
      // doesn't implement yet (oven-sh/bun#2445). istanbul ships its
      // own instrumentation transform and works in every JS runtime.
      provider: "istanbul",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // main.ts and livepreview.ts are integration shells over the
      // Obsidian Plugin lifecycle / CodeMirror EditorView; honest
      // unit tests would require an Obsidian runtime, not happy-dom.
      // Their behaviour is verified end-to-end in the dev vault smoke
      // test (see README), so excluding them from the C1 gate keeps
      // the unit suite fast and trustworthy.
      exclude: ["src/main.ts", "src/livepreview.ts"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    // Resolve `obsidian` (a runtime-less package whose real impl
    // lives inside Obsidian itself) to the hand-rolled minimal mock.
    // Absolute path so esbuild's resolver doesn't reinterpret the
    // leading `./`.
    alias: {
      obsidian: resolve(projectRoot, "tests/__mocks__/obsidian.ts"),
    },
  },
});
