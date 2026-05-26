import { defineConfig, loadEnv } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const { publicVars } = loadEnv({ prefixes: ["PUBLIC_"], cwd: "../.." });

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: { index: "./src/index.tsx" },
    define: publicVars,
  },
  server: {
    port: 3031,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
    },
  },
  html: {
    title: "Seat Reservation",
  },
  tools: {
    postcss: {
      postcssOptions: {
        plugins: [require("tailwindcss"), require("autoprefixer")],
      },
    },
  },
});
