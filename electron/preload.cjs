// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Brug tussen het hoofdproces en de app. Alleen deze functies komen in de pagina
// beschikbaar; de pagina zelf krijgt geen toegang tot Node of het besturingssysteem.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("helder", {
  desktop: true,
  updateStatus: () => ipcRenderer.invoke("helder:update-status"),
  checkForUpdates: () => ipcRenderer.invoke("helder:update-check"),
  installUpdate: () => ipcRenderer.invoke("helder:update-install"),
  onUpdateStatus: (callback) => {
    const luisteraar = (_gebeurtenis, status) => callback(status);
    ipcRenderer.on("helder:update", luisteraar);
    return () => ipcRenderer.removeListener("helder:update", luisteraar);
  },
});
