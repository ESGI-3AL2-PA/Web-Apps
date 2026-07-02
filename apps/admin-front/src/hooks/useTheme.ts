import { useCallback, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "adminTheme";

function current(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// Toggles the flyonui/daisyUI theme on <html> and persists it. Initial value is applied pre-paint
// by an inline script in index.html to avoid a flash.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage failures — theme just won't persist
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
