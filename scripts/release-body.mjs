// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Schrijft de beschrijving voor de GitHub-releasepagina, uit dezelfde punten als de
// update-kaart in de app, met onderaan de vaste voet over het ondertekeningsbeleid. Zonder dit
// bestand heeft een release een lege beschrijving: wie de repository bezoekt ziet dan wel de
// installer, maar niet wat er veranderd is.
//
//   node scripts/release-body.mjs [versie] [doelbestand]
//
// Zonder argumenten: de versie uit package.json en release/release-body.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/** De repository waar de releases staan; dezelfde als in electron-builder.cjs (`publish`). */
export const REPOSITORY = "DrIamlegion/helder";

/**
 * De vaste voet onder elke releasepagina. SignPath Foundation vraagt dat de releasepagina's de
 * regel van de Foundation noemen en naar het ondertekeningsbeleid wijzen; de downloadpagina staat
 * erbij zodat een bezoeker meteen bij de installatie-instructies is.
 *
 * De statusregel komt uit `ondertekend`. De workflow zet `HELDER_SIGN_PUBLISHER` alleen als er
 * echt ondertekend wordt, dus zonder SignPath-secrets staat er eerlijk "nog niet ondertekend"
 * in plaats van een claim die niet klopt.
 */
export function beleidsvoet({
  repository = REPOSITORY,
  ondertekend = Boolean(process.env.HELDER_SIGN_PUBLISHER),
} = {}) {
  return [
    "---",
    "",
    "**Code signing policy** — Free code signing provided by SignPath.io, certificate by SignPath Foundation.",
    `[Ondertekeningsbeleid](https://github.com/${repository}/blob/main/docs/code-signing-policy.md) · ` +
      `[Download en installatie](https://github.com/${repository}/blob/main/docs/download.md)`,
    "",
    ondertekend
      ? "Deze versie is ondertekend met het certificaat van SignPath Foundation."
      : "Deze versie is nog niet ondertekend; Windows kan bij de eerste start waarschuwen.",
    "",
  ].join("\n");
}

/**
 * De tekst onder de release, opgebouwd uit de losse punten. GitHub toont dit als Markdown,
 * dus de punten worden een lijst en de opmaak uit CHANGELOG.md (`**vet**`, backticks) blijft werken.
 */
export function releaseBody(versie, punten, { repository = REPOSITORY, ondertekend } = {}) {
  const lijst = punten.map((punt) => `- ${punt}`).join("\n");
  return [
    `## Wat is er nieuw in Helder ${versie}`,
    "",
    lijst,
    "",
    `Volledige geschiedenis: [CHANGELOG.md](https://github.com/${repository}/blob/main/CHANGELOG.md) · ` +
      `[alle releases](https://github.com/${repository}/releases)`,
    "",
    beleidsvoet({ repository, ...(ondertekend === undefined ? {} : { ondertekend }) }),
  ].join("\n");
}

/** De beschrijving voor één versie, of null als die versie geen sectie in CHANGELOG.md heeft. */
export function bodyVoor(versie, { repository = REPOSITORY, ondertekend } = {}) {
  const { notitiesVoor } = require("./release-notes.cjs");
  const notities = notitiesVoor(versie);
  if (!notities) return null;
  return releaseBody(versie, notities.split("\n"), { repository, ondertekend });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = require("../package.json");
  const versie = process.argv[2] || pkg.version;
  const body = bodyVoor(versie);
  if (!body) {
    console.error(
      `Geen sectie voor ${versie} in CHANGELOG.md. Schrijf die eerst; een release zonder ` +
        `beschrijving is voor bezoekers een lege pagina.`
    );
    process.exit(1);
  }
  const doel = path.resolve(process.argv[3] || path.join("release", "release-body.md"));
  mkdirSync(path.dirname(doel), { recursive: true });
  writeFileSync(doel, body);
  console.log(`Releasepagina voor ${versie} geschreven naar ${doel} (${body.split("\n").length} regels).`);
}
