// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Zet de AGPL-licentieheader boven elk bronbestand, of controleert of hij er staat.
//
//   node scripts/license-headers.mjs           → header toevoegen waar hij ontbreekt
//   node scripts/license-headers.mjs --check   → exitcode 1 als er een header ontbreekt
//
// De header is idempotent: bestanden die al een SPDX-regel hebben, blijven ongemoeid.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const controle = process.argv.includes("--check");

const REGELS = [
  "Helder — boekhouden zonder ruis",
  "Copyright (C) 2026 Helder-auteurs",
  "SPDX-License-Identifier: AGPL-3.0-only",
  "",
  "Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de",
  "voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.",
];

const SOORTEN = {
  ".ts": "lijn",
  ".tsx": "lijn",
  ".js": "lijn",
  ".mjs": "lijn",
  ".cjs": "lijn",
  ".css": "blok",
};

const MAPPEN = ["src", "electron", "scripts"];
const LOSSE_BESTANDEN = ["vite.config.ts", "electron-builder.cjs"];
const OVERSLAAN = new Set(["node_modules", "dist", "release", ".git", "public", "build"]);

function header(ssoort) {
  if (ssoort === "blok") {
    return `/*\n${REGELS.map((regel) => (regel ? ` * ${regel}` : " *")).join("\n")}\n */\n\n`;
  }
  return `${REGELS.map((regel) => (regel ? `// ${regel}` : "//")).join("\n")}\n\n`;
}

function heeftHeader(inhoud) {
  return inhoud.split("\n", 12).some((regel) => regel.includes("SPDX-License-Identifier"));
}

function bestandenIn(map) {
  const uitkomst = [];
  for (const naam of readdirSync(map)) {
    if (OVERSLAAN.has(naam)) continue;
    const pad = path.join(map, naam);
    const info = statSync(pad);
    if (info.isDirectory()) uitkomst.push(...bestandenIn(pad));
    else if (SOORTEN[path.extname(naam)]) uitkomst.push(pad);
  }
  return uitkomst;
}

const bestanden = [
  ...MAPPEN.flatMap((map) => bestandenIn(map)),
  ...LOSSE_BESTANDEN.filter((bestand) => SOORTEN[path.extname(bestand)]),
];

const ontbreekt = [];
let toegevoegd = 0;

for (const bestand of bestanden) {
  const inhoud = readFileSync(bestand, "utf8");
  if (heeftHeader(inhoud)) continue;
  ontbreekt.push(bestand);
  if (controle) continue;
  // Een shebang moet de eerste regel blijven.
  if (inhoud.startsWith("#!")) {
    const [eerste, ...rest] = inhoud.split("\n");
    writeFileSync(bestand, `${eerste}\n${header(SOORTEN[path.extname(bestand)])}${rest.join("\n")}`);
  } else {
    writeFileSync(bestand, header(SOORTEN[path.extname(bestand)]) + inhoud);
  }
  toegevoegd += 1;
}

if (controle) {
  if (ontbreekt.length > 0) {
    console.error(`Deze bestanden missen de AGPL-header (${ontbreekt.length}):`);
    for (const bestand of ontbreekt) console.error(`- ${bestand}`);
    console.error("\nVoeg ze toe met: npm run license:add");
    process.exit(1);
  }
  console.log(`Alle ${bestanden.length} bronbestanden hebben de AGPL-header.`);
  process.exit(0);
}

console.log(
  toegevoegd === 0
    ? `Niets te doen: alle ${bestanden.length} bronbestanden hadden al een header.`
    : `Header toegevoegd aan ${toegevoegd} van ${bestanden.length} bronbestanden.`
);
