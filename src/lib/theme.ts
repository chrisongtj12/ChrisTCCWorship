export type Theme = "light" | "dark";

const KEY = "tcc.theme";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "light" || t === "dark") return t;
    if (t === "stage") return "dark"; // legacy: Stage was retired → fall back to Dark
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
  el.classList.toggle("dark", t === "dark");
  el.classList.remove("stage"); // retired
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
}
