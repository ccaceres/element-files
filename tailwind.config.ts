import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Segoe UI", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        app: {
          bg: "var(--bg-app)",
          sidebar: "var(--bg-sidebar)",
          content: "var(--bg-content)",
          surface: "var(--bg-surface)",
          hover: "var(--bg-surface-hover)",
          selected: "var(--bg-selected)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          link: "var(--text-link)",
        },
        border: {
          default: "var(--border-default)",
          subtle: "var(--border-subtle)",
        },
        accent: {
          primary: "var(--accent-primary)",
          hover: "var(--accent-hover)",
          light: "var(--accent-light)",
        },
        token: {
          valid: "var(--token-valid)",
          warning: "var(--token-warning)",
          expired: "var(--token-expired)",
        },
      },
      boxShadow: {
        panel: "0 12px 30px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
