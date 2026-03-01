import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const matrixServerUrl =
    (env.MATRIX_SERVER_URL || env.VITE_MATRIX_SERVER_URL || "https://matrix.bsdu.eu").trim();
  const matrixProxyTarget = (env.VITE_MATRIX_PROXY_TARGET || matrixServerUrl).trim();
  const elementToken = (env.ELEMENT_TOKEN || env.VITE_ELEMENT_TOKEN || "").trim();

  return {
    define: {
      __ELEMENT_TOKEN__: JSON.stringify(elementToken),
      __MATRIX_SERVER_URL__: JSON.stringify(matrixServerUrl),
    },
    server: {
      proxy: {
        "/graph-proxy": {
          target: "https://graph.microsoft.com",
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/graph-proxy/, ""),
        },
        "/matrix-proxy": {
          target: matrixProxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/matrix-proxy/, ""),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "./src"),
      },
    },
    plugins: [react()],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  };
});
