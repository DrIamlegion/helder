// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Schrijft resources/app-update.yml in een al gebouwde app-map.
//
// Nodig bij de release-flow die eerst de app-bestanden ondertekent en daarna met
// `electron-builder --prepackaged` de installer bouwt: in dat pad slaat electron-builder het
// schrijven van app-update.yml over, en zonder dat bestand weet de app niet waar het
// updatekanaal staat. Het kanaal en de uitgever komen uit electron-builder.cjs, zodat er één
// bron blijft.
//
//   node scripts/app-update-yml.mjs [release/win-unpacked]
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const config = require("../electron-builder.cjs");

const appMap = path.resolve(process.argv[2] || path.join("release", "win-unpacked"));
const resources = path.join(appMap, "resources");
if (!existsSync(appMap)) {
  console.error(`Geen app-map gevonden op ${appMap}. Bouw eerst met --dir.`);
  process.exit(1);
}

const publicatie = Array.isArray(config.publish) ? config.publish[0] : null;
if (!publicatie || !publicatie.provider) {
  console.error("Geen publish-configuratie in electron-builder.cjs gevonden.");
  process.exit(1);
}

const regels = [`provider: ${publicatie.provider}`];
if (publicatie.url) regels.push(`url: ${publicatie.url}`);
if (publicatie.owner) regels.push(`owner: ${publicatie.owner}`);
if (publicatie.repo) regels.push(`repo: ${publicatie.repo}`);
const uitgever = Array.isArray(publicatie.publisherName)
  ? publicatie.publisherName[0]
  : publicatie.publisherName;
if (uitgever) regels.push(`publisherName: ${uitgever}`);
regels.push("updaterCacheDirName: helder-updater");

const doel = path.join(resources, "app-update.yml");
writeFileSync(doel, `${regels.join("\n")}\n`);
console.log(`app-update.yml geschreven naar ${doel}`);
console.log(regels.map((regel) => `  ${regel}`).join("\n"));
