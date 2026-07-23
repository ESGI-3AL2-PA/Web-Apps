/**
 * Helpers (lib) de gestion du thème clair/sombre.
 *
 * Le thème est porté par l'attribut `<html data-theme>` (un script inline dans
 * index.html le pose avant le premier paint pour éviter le flash). Ces fonctions
 * lisent l'attribut courant et le mettent à jour en persistant le choix.
 */
export type Theme = "light" | "dark";

/** Lit le thème actif depuis `<html data-theme>` ; « light » par défaut. */
export function getTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

/** Applique un thème sur `<html>` et le mémorise en localStorage pour les rechargements. */
export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // le stockage peut être indisponible (mode privé) ; l'attribut reste appliqué
  }
}
