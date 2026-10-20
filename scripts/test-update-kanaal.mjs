// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Controleert dat het updatekanaal echt naar de releases van deze repository wijst.
//
// Zonder deze test kan er per ongeluk weer een placeholder in electron-builder.cjs belanden: de
// app bouwt dan prima, maar geen enkele installatie krijgt ooit een update binnen. De test kijkt
// naar de bron (electron-builder.cjs), naar het bestand dat in de app terechtkomt
// (app-update.yml) en naar de workflow die de updatebestanden op de release moet zetten.
//
//   node scripts/test-update-kanaal.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { regelsVoorAppUpdate } from "./app-update-yml.mjs";

const require = createRequire(import.meta.url);
const config = require("../electron-builder.cjs");

const publicatie = Array.isArray(config.publish) ? config.publish[0] : null;
assert.ok(publicatie, "electron-builder.cjs heeft een publish-configuratie");

// 1. Het kanaal is de GitHub-releases van deze repository; geen eigen host meer.
assert.equal(publicatie.provider, "github", "het updatekanaal gebruikt de github-provider");
assert.equal(publicatie.owner, "DrIamlegion", "de owner van de repository staat in de configuratie");
assert.equal(publicatie.repo, "helder", "de repositorynaam staat in de configuratie");
assert.ok(
  !(publicatie.url || "").includes("example"),
  "geen voorbeeldadres als updatekanaal: daar komt nooit een update vandaan"
);

// 2. Wat in de app belandt, moet hetzelfde kanaal beschrijven.
const regels = regelsVoorAppUpdate(config);
const velden = Object.fromEntries(
  regels
    .filter((regel) => regel.includes(":"))
    .map((regel) => [regel.slice(0, regel.indexOf(":")), regel.slice(regel.indexOf(":") + 1).trim()])
);
assert.equal(velden.provider, "github", "app-update.yml noemt de github-provider");
assert.equal(velden.owner, "DrIamlegion", "app-update.yml noemt de owner");
assert.equal(velden.repo, "helder", "app-update.yml noemt de repository");
assert.ok(
  !(velden.url || "").includes("example"),
  "app-update.yml bevat geen voorbeeldadres"
);

// 3. De release-workflow moet latest.yml meepubliceren; zonder dat bestand kan de app niets
//    vinden, ook al staat de provider goed.
const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
assert.match(
  workflow,
  /release\/latest\.yml/,
  "de release-workflow zet latest.yml als asset op de release"
);

// 4. Ondertekent de pijplijn, dan hoort de uitgever in app-update.yml: electron-updater
//    vergelijkt de naam van de ondertekenaar met dat veld en weigert een update die niet klopt.
const metUitgever = regelsVoorAppUpdate({
  ...config,
  win: { ...config.win, publisherName: "Voorbeeld Certificaat B.V." },
});
assert.ok(
  metUitgever.includes("publisherName: Voorbeeld Certificaat B.V."),
  "app-update.yml noemt de uitgever zodra die in de configuratie staat"
);

// 5. En de workflow moet die naam uit de repository-variabele halen — maar alleen als er echt
//    ondertekend wordt. Staat er ook zonder SignPath-secrets een uitgever in, dan keurt een
//    ongetekende update zichzelf af; staat er een vaste naam in terwijl het certificaat anders
//    heet, dan keurt de ondertekende update zichzelf af. Daarom geen naam in de workflow zelf.
assert.match(
  workflow,
  /if \[\[ -z "\$SIGNPATH_API_TOKEN" \]\][\s\S]*?exit 0[\s\S]*?vars\.HELDER_SIGN_PUBLISHER/,
  "de release-workflow zet de uitgever alleen als de SignPath-secrets er zijn, en leest hem uit de variabele"
);
assert.match(
  workflow,
  /echo "HELDER_SIGN_PUBLISHER=\$uitgever" >> "\$GITHUB_ENV"/,
  "de workflow geeft de uitgever aan de volgende stappen mee"
);
assert.ok(
  !/HELDER_SIGN_PUBLISHER=SignPath Foundation/.test(workflow),
  "de workflow zet geen vaste uitgeversnaam meer: die hangt af van het certificaat"
);

console.log(
  `Updatekanaal: github.com/${velden.owner}/${velden.repo}, latest.yml gaat mee met de release.`
);
console.log(
  "Ondertekening: de uitgever komt uit HELDER_SIGN_PUBLISHER, alleen als er echt ondertekend wordt."
);
