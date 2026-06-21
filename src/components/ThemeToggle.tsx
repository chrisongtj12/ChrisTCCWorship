import { useState } from "react";
import { type Theme, getTheme, setTheme } from "../lib/theme.ts";
import { Segmented } from "./ui.tsx";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const change = (t: string) => {
    setThemeState(t as Theme);
    setTheme(t as Theme);
  };
  return (
    <Segmented
      size="sm"
      value={theme}
      onChange={change}
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}
