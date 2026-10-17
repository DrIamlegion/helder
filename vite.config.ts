// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// De versie uit package.json, zodat de app hem kan tonen zonder hem twee keer bij te houden.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    // Helder is na de build te installeren als gewone app (eigen venster, offline).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon-180.png"],
      manifest: {
        name: "Helder — boekhouden zonder ruis",
        short_name: "Helder",
        description:
          "Facturen, uitgaven, bankzaken en btw-aangifte voor zzp en mkb. Alles lokaal op je eigen computer.",
        lang: "nl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: "#10201b",
        background_color: "#f4f6f3",
        categories: ["business", "finance", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // De hele app in de cache: eenmaal geopend werkt Helder ook zonder internet.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
