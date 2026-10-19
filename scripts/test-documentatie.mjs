// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Bewaakt de documentatie die SignPath Foundation van een deelnemer vraagt. Die eisen staan in
// tekst, niet in code: een opruimactie in de README kan de regel van de Foundation of de
// teamrollen laten verdwijnen zonder dat er iets kapotgaat — tot de aanvraag opnieuw wordt
// beoordeeld. Deze controle laat de CI dan rood worden.
//
// Wat er gecontroleerd wordt:
// - de letterlijke regel van de Foundation op de homepage (README) en de downloadpagina;
// - een kop met de term "Code signing policy" op beide;
// - de drie rollen (committers, reviewers, approvers) met een lid erbij, en de MFA-eis;
// - dat de homepage, de downloadpagina en het beleid naar elkaar en naar het privacybeleid
//   linken, en dat al die relatieve links en ankers echt bestaan;
// - dat de vaste voet onder de releasepagina's dezelfde regel en links bevat;
// - dat de CI-workflow deze controle ook echt draait.
//
//   node scripts/test-documentatie.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wortel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lees = (relatief) => readFileSync(path.join(wortel, relatief), "utf8").replace(/\r\n/g, "\n");

/** De regel die de Foundation letterlijk op de homepage en de downloadpagina wil zien. */
const REGEL = "Free code signing provided by SignPath.io, certificate by SignPath Foundation.";

const readme = lees("README.md");
const download = lees("docs/download.md");
const beleid = lees("docs/code-signing-policy.md");
const privacy = lees("docs/privacy.md");

const koppen = (tekst) =>
  tekst
    .split("\n")
    .map((regel) => regel.match(/^#{1,6}\s+(.*)$/))
    .filter(Boolean)
    .map((treffer) => treffer[1].trim().replace(/\*|`/g, ""));

const heeftKop = (tekst, titel) => koppen(tekst).some((kop) => kop.toLowerCase() === titel.toLowerCase());

// 1. De letterlijke regel, als citaat, op de homepage en op de downloadpagina. Los in de tekst is
//    niet genoeg: de Foundation wil hem als statement kunnen aanwijzen.
for (const [naam, tekst] of [
  ["README.md", readme],
  ["docs/download.md", download],
  ["docs/code-signing-policy.md", beleid],
]) {
  assert.ok(
    tekst.split("\n").some((regel) => regel.trim() === `> ${REGEL}`),
    `${naam} noemt de regel van de Foundation als citaat: "${REGEL}"`
  );
}

// 2. De term die de voorwaarden voorschrijven, als kop op de homepage en de downloadpagina.
assert.ok(
  heeftKop(readme, "Code signing policy"),
  "README.md heeft een kop \"Code signing policy\" (die term schrijft de Foundation voor)"
);
assert.ok(
  heeftKop(download, "Code signing policy"),
  "docs/download.md heeft een kop \"Code signing policy\""
);

// 3. De drie rollen met een lid erbij, en de MFA-eis. SignPath wil weten wie committeert,
//    wie pull requests beoordeelt en wie een ondertekeningsaanvraag goedkeurt.
assert.ok(heeftKop(beleid, "Rollen en hun leden"), "docs/code-signing-policy.md heeft een kop \"Rollen en hun leden\"");
for (const rol of ["committers", "reviewers", "approvers"]) {
  assert.match(beleid, new RegExp(`\\*\\*[^*]*${rol}[^*]*\\*\\*`, "i"), `het beleid benoemt de rol ${rol}`);
}
assert.match(
  beleid,
  /\[@[A-Za-z0-9-]+\]\(https:\/\/github\.com\/[A-Za-z0-9-]+\)/,
  "het beleid noemt de leden van die rollen met hun GitHub-profiel"
);
for (const [naam, tekst] of [
  ["README.md", readme],
  ["docs/code-signing-policy.md", beleid],
]) {
  assert.match(tekst, /MFA/, `${naam} noemt de MFA-eis`);
}

// 4. De pagina's moeten naar elkaar verwijzen: homepage → download, privacy en beleid; download →
//    beleid en privacy; beleid → download en privacy. Zonder die links is het beleid er wel,
//    maar niet vindbaar vanaf de plek waar de Foundation kijkt.
const verwijst = (tekst, doel) =>
  new RegExp(`\\]\\(${doel.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(#[^)]*)?\\)`).test(tekst);

for (const doel of ["docs/download.md", "docs/privacy.md", "docs/code-signing-policy.md"]) {
  assert.ok(verwijst(readme, doel), `README.md linkt naar ${doel}`);
}
for (const doel of ["code-signing-policy.md", "privacy.md"]) {
  assert.ok(verwijst(download, doel), `docs/download.md linkt naar ${doel}`);
}
for (const doel of ["download.md", "privacy.md"]) {
  assert.ok(verwijst(beleid, doel), `docs/code-signing-policy.md linkt naar ${doel}`);
}

// 5. Het privacybeleid moet beschrijven wat de app werkelijk doet: lokaal opslaan én de
//    updatecontrole bij GitHub. De formulering "verstuurt nooit iets" zou onwaar zijn.
assert.match(privacy, /localStorage|%APPDATA%/, "het privacybeleid noemt waar de administratie staat");
assert.match(privacy, /GitHub/, "het privacybeleid noemt de updatecontrole bij GitHub");
assert.match(privacy, /telemetrie/i, "het privacybeleid zegt dat er geen telemetrie is");

// 6. De vaste voet onder de releasepagina's (scripts/release-body.mjs) bevat dezelfde regel en de
//   zelfde twee links; de releasepagina's zijn volgens de voorwaarden ook een plek waar dit hoort.
const voet = lees("scripts/release-body.mjs");
assert.ok(voet.includes(REGEL), "scripts/release-body.mjs zet de regel van de Foundation onder de release");
assert.ok(voet.includes("docs/code-signing-policy.md"), "de releasevoet linkt naar het ondertekeningsbeleid");
assert.ok(voet.includes("docs/download.md"), "de releasevoet linkt naar de downloadpagina");

// 7. En de CI-workflow moet deze controle draaien; anders is het een script dat niemand start.
const ciWorkflow = lees(".github/workflows/ci.yml");
assert.match(
  ciWorkflow,
  /run: npm run test:documentatie/,
  "de CI-workflow draait npm run test:documentatie"
);

// 8. Tot slot: elke relatieve link en elk anker in deze documenten moet bestaan. Een dode link
//    naar het beleid is precies het soort detail waar een beoordelaar op afgaat.
const teControleren = [
  "README.md",
  "docs/download.md",
  "docs/privacy.md",
  "docs/signpath-aanvraag.md",
  "docs/code-signing-policy.md",
  "docs/publicatie.md",
];

const slug = (tekst) =>
  tekst
    .toLowerCase()
    .replace(/[`*_>#]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

const ankers = new Map();
const ankersVan = (relatief) => {
  if (!ankers.has(relatief)) ankers.set(relatief, new Set(koppen(lees(relatief)).map(slug)));
  return ankers.get(relatief);
};

const problemen = [];
let gecontroleerd = 0;
for (const relatief of teControleren) {
  const tekst = lees(relatief);
  for (const treffer of tekst.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const doel = treffer[1];
    if (/^(https?:|mailto:)/.test(doel)) continue;
    gecontroleerd++;
    const [pad, anker] = doel.split("#");
    const bestand = pad === "" ? relatief : path.resolve(path.dirname(path.join(wortel, relatief)), pad);
    if (!existsSync(bestand)) {
      problemen.push(`${relatief}: ${doel} bestaat niet`);
      continue;
    }
    if (anker) {
      const kennis = path.relative(wortel, bestand).replace(/\\/g, "/");
      if (!ankersVan(kennis).has(anker)) problemen.push(`${relatief}: anker ${doel} bestaat niet`);
    }
  }
}
assert.deepEqual(problemen, [], `dode links in de documentatie:\n  ${problemen.join("\n  ")}`);

console.log(
  `Documentatie: beleid, rollen en privacy staan op hun plek (${gecontroleerd} links en ankers gecontroleerd).`
);
