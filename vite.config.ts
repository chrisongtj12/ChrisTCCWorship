import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. base "./" keeps asset paths relative so it works on Vercel
// and from any sub-path. Share links use the URL hash (HashRouter-style).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
