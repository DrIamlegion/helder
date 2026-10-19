// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Draait dezelfde controles als de CI-workflow (.github/workflows/ci.yml), in dezelfde volgorde:
// licentieheaders, release-opmerkingen, updatekanaal, types en frontend, de btw-test in de echte
// app, de app-map, het update-kanaal in de app-map en de hashcontrole. Stopt bij de eerste fout,
// zodat een gebroken btw-regel, een afgekapte release-opmerking of een kanaal waar nooit een
// update vandaan komt niet pas na het inpakken opvalt.
//
//   npm run ci
//
// `npm ci` zit er bewust niet in: dat verwijdert node_modules en installeert alles opnieuw.
// Draai het zelf (of `npm install`) als package.json of package-lock.json is veranderd. De
// tagcontrole van verify-build.mjs slaat lokaal over; die hoort bij een release-tag.
import { spawnSync } from "node:child_process";
import path from "node:path";

// npm run ci zet npm_execpath. Zo draaien de npm-stappen met dezelfde npm als waarmee dit script
// is gestart, ook op Windows, zonder een .cmd-schil en zonder zelf een shell te openen.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Draai dit script via: npm run ci");
  process.exit(1);
}
const bouwCli = path.join("node_modules", "electron-builder", "cli.js");

const stappen = [
  {
    naam: "Licentieheaders",
    commando: process.execPath,
    argumenten: [npmCli, "run", "license:check"],
  },
  {
    naam: "Release-opmerkingen",
    commando: process.execPath,
    argumenten: ["scripts/test-release-notes.mjs"],
  },
  {
    naam: "Updatekanaal",
    commando: process.execPath,
    argumenten: ["scripts/test-update-kanaal.mjs"],
  },
  {
    naam: "Documentatie (SignPath)",
    commando: process.execPath,
    argumenten: ["scripts/test-documentatie.mjs"],
  },
  {
    naam: "Ondertekeningspijplijn (SignPath)",
    commando: process.execPath,
    argumenten: ["scripts/test-signpath.mjs"],
  },
  {
    naam: "Configuraties (SignPath)",
    commando: process.execPath,
    argumenten: ["scripts/test-signpath-configuraties.mjs"],
  },
  {
    naam: "Signalen (SignPath)",
    commando: process.execPath,
    argumenten: ["scripts/test-signpath-signalen.mjs"],
  },
  {
    naam: "Automatische back-up",
    commando: process.execPath,
    argumenten: ["scripts/test-backup.mjs"],
  },
  {
    naam: "Types en frontend bouwen",
    commando: process.execPath,
    argumenten: [npmCli, "run", "build"],
  },
  {
    naam: "Btw-test (stichting en vereniging)",
    commando: process.execPath,
    argumenten: ["scripts/test-btw.mjs"],
    omgeving: { ELECTRON_ENABLE_LOGGING: "true" },
  },
  {
    naam: "App-map bouwen",
    commando: process.execPath,
    argumenten: [bouwCli, "--win", "--dir", "--x64"],
  },
  {
    naam: "Update-kanaal in de app-map zetten",
    commando: process.execPath,
    argumenten: ["scripts/app-update-yml.mjs", "release/win-unpacked"],
  },
  {
    naam: "App hoort bij deze commit?",
    commando: process.execPath,
    argumenten: ["scripts/verify-build.mjs"],
  },
];

for (let i = 0; i < stappen.length; i++) {
  const stap = stappen[i];
  console.log(`\n=== ${i + 1}/${stappen.length} ${stap.naam} ===`);
  const uitkomst = spawnSync(stap.commando, stap.argumenten, {
    stdio: "inherit",
    env: { ...process.env, ...(stap.omgeving || {}) },
  });
  if (uitkomst.error) {
    console.error(`\nCI gestopt: ${stap.naam} kon niet starten (${uitkomst.error.message}).`);
    process.exit(1);
  }
  if (uitkomst.status !== 0) {
    const reden =
      uitkomst.status === null ? `signaal ${uitkomst.signal}` : `exitcode ${uitkomst.status}`;
    console.error(`\nCI gestopt bij "${stap.naam}" (${reden}).`);
    process.exit(uitkomst.status || 1);
  }
}

console.log(`\nCI geslaagd: ${stappen.length} controles uit de workflow zijn goed.`);
