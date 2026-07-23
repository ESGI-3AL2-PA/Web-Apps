// Hook : bascule et persiste le thème clair/sombre de l'admin.
import { useCallback, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "adminTheme";

// Lit le thème courant depuis l'attribut data-theme de <html> (défaut : clair).
function current(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Bascule le thème FlyonUI/daisyUI sur <html> et le persiste dans localStorage. La valeur initiale
 * est appliquée avant le premier paint par un script inline dans index.html, pour éviter un flash.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // On ignore les échecs de stockage — le thème ne sera simplement pas persisté.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
