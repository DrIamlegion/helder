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
import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/**
 * De regels voor app-update.yml, afgeleid van de buildconfiguratie. electron-updater leest dit
 * bestand in de geïnstalleerde app: `provider` plus `owner`/`repo` bepalen waar hij `latest.yml`
 * zoekt, en `publisherName` welke ondertekenaar hij accepteert.
 */
export function regelsVoorAppUpdate(config) {
  const publicatie = Array.isArray(config.publish) ? config.publish[0] : null;
  if (!publicatie || !publicatie.provider) {
    throw new Error("Geen publish-configuratie gevonden; app-update.yml kan niet gemaakt worden.");
  }

  const regels = [`provider: ${publicatie.provider}`];
  if (publicatie.url) regels.push(`url: ${publicatie.url}`);
  if (publicatie.owner) regels.push(`owner: ${publicatie.owner}`);
  if (publicatie.repo) regels.push(`repo: ${publicatie.repo}`);
  const uitgever = (config.win && config.win.publisherName) ?? publicatie.publisherName;
  if (uitgever) regels.push(`publisherName: ${Array.isArray(uitgever) ? uitgever[0] : uitgever}`);
  regels.push("updaterCacheDirName: helder-updater");
  return regels;
}

export function schrijfAppUpdateYml(appMap, config) {
  const resources = path.join(appMap, "resources");
  if (!existsSync(appMap)) {
    throw new Error(`Geen app-map gevonden op ${appMap}. Bouw eerst met --dir.`);
  }
  const regels = regelsVoorAppUpdate(config);
  const doel = path.join(resources, "app-update.yml");
  writeFileSync(doel, `${regels.join("\n")}\n`);
  return { doel, regels };
}

// Alleen uitvoeren als dit bestand direct wordt gestart, niet bij een import vanuit de test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = require("../electron-builder.cjs");
  const appMap = path.resolve(process.argv[2] || path.join("release", "win-unpacked"));
  try {
    const { doel, regels } = schrijfAppUpdateYml(appMap, config);
    console.log(`app-update.yml geschreven naar ${doel}`);
    console.log(regels.map((regel) => `  ${regel}`).join("\n"));
  } catch (fout) {
    console.error(fout.message);
    process.exit(1);
  }
}
