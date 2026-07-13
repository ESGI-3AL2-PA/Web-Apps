export type Theme = "light" | "dark";

// The theme is applied to <html data-theme> (an inline script in index.html sets
// it before paint). Persist the choice so it survives reloads.
export function getTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // storage may be unavailable (private mode); the attribute is still applied
  }
}
