// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Schrijft (of controleert) latest.yml voor het updatekanaal op basis van de installer die
// je opgeeft. Nodig in de release-pijplijn: ondertekenen verandert het bestand, en daarmee de
// sha512 — de metadata moet dus ná het ondertekenen opnieuw gemaakt worden.
//
//   node scripts/latest-yml.mjs [pad/naar/installer.exe]   → schrijft release/latest.yml
//   node scripts/latest-yml.mjs --check [pad]              → faalt als latest.yml niet klopt
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { notitiesVoor } from "./release-notes.cjs";

const argumenten = process.argv.slice(2);
const controleren = argumenten.includes("--check");
const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
const release = path.resolve("release");
const meegegeven = argumenten.find((arg) => !arg.startsWith("--"));
const installer = path.resolve(
  meegegeven || path.join(release, `Helder-Setup-${pkg.version}.exe`)
);
const ymlPad = path.join(release, "latest.yml");

if (!existsSync(installer)) {
  console.error(`Geen installer gevonden op ${installer}. Draai eerst npm run installer.`);
  process.exit(1);
}

const bytes = readFileSync(installer);
const sha512 = createHash("sha512").update(bytes).digest("base64");
const bestand = path.basename(installer);
const notities = notitiesVoor(pkg.version);

// YAML met de hand: deze structuur is klein en zo blijven we onafhankelijk van een library.
const regels = [
  `version: ${pkg.version}`,
  "files:",
  `  - url: ${bestand}`,
  `    sha512: ${sha512}`,
  `    size: ${bytes.length}`,
  `path: ${bestand}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
];

if (notities) {
  regels.push(`releaseName: Helder ${pkg.version}`, "releaseNotes: |-");
  for (const regel of notities.split("\n")) regels.push(`  ${regel}`);
}
const inhoud = `${regels.join("\n")}\n`;

if (!controleren) {
  writeFileSync(ymlPad, inhoud);
  console.log(`latest.yml geschreven voor ${pkg.version} (${bestand}, ${bytes.length} bytes)`);
  console.log(`sha512: ${sha512}`);
  process.exit(0);
}

if (!existsSync(ymlPad)) {
  console.error("latest.yml ontbreekt; draai dit script zonder --check om hem te maken.");
  process.exit(1);
}
const huidig = readFileSync(ymlPad, "utf8");
const shaInYml = (huidig.match(/^sha512: (.+)$/m) || [])[1];
const versieInYml = (huidig.match(/^version: (.+)$/m) || [])[1];
const problemen = [];
if (versieInYml !== pkg.version) problemen.push(`versie in latest.yml is ${versieInYml}, package.json zegt ${pkg.version}`);
if (shaInYml !== sha512) problemen.push("sha512 in latest.yml hoort niet bij deze installer (opnieuw ondertekend?)");
if (!huidig.includes(bestand)) problemen.push(`latest.yml verwijst niet naar ${bestand}`);
if (problemen.length > 0) {
  console.error(`latest.yml is niet in orde:\n- ${problemen.join("\n- ")}`);
  process.exit(1);
}
console.log(`latest.yml klopt: ${pkg.version}, sha512 en bestandsnaam komen overeen (${statSync(installer).size} bytes).`);
