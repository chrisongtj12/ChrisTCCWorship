export type Theme = "light" | "dark" | "stage";

const KEY = "tcc.theme";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "light" || t === "dark" || t === "stage") return t;
  } catch {
    /* ignore */
  }
  // Default: follow the OS preference.
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(t: Theme): void {
  const el = document.documentElement;
  el.classList.toggle("dark", t === "dark" || t === "stage");
  el.classList.toggle("stage", t === "stage");
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
}
