import { useEffect, useState } from "react";
import { DarkThemeRegular, WeatherSunnyRegular } from "@fluentui/react-icons";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const fallback = (import.meta.env.VITE_DEFAULT_THEME as Theme | undefined) ?? "dark";
  if (typeof window === "undefined") {
    return fallback;
  }

  const persisted = window.sessionStorage.getItem("ui_theme") as Theme | null;
  return persisted ?? fallback;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.sessionStorage.setItem("ui_theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      className="rounded border border-border-default bg-app-surface px-2 py-1 text-text-secondary transition hover:bg-app-hover"
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
    >
      {theme === "dark" ? <WeatherSunnyRegular fontSize={16} /> : <DarkThemeRegular fontSize={16} />}
    </button>
  );
}

