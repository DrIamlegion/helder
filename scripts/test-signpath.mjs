// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Bewaakt de ondertekeningsstappen in de release-workflow. Die stappen zijn nooit te testen zonder
// een SignPath-account, dus de fouten die je anders pas bij de eerste echte release ziet, worden
// hier op structuur afgevangen:
//
// - geen eigen zip: upload-artifact maakt de zip, en het root-element van de artifact
//   configuration is <zip-file>. Een eigen zip eromheen levert een zip in een zip op, waar de
//   configuratie niet meer op past;
// - de SignPath-actie pakt het ondertekende archief zelf uit; een Expand-Archive op een zip die
//   er niet meer is, laat de hele release klappen;
// - de ondertekende bestanden worden teruggekopieerd, met een controle dat Helder.exe en de
//   installer er echt zijn, zodat er nooit stil een ongetekende versie wordt gepubliceerd;
// - de blockmap van de ongetekende installer gaat niet mee de release in;
// - de CI draait deze controle ook echt.
//
//   node scripts/test-signpath.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wortel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lees = (relatief) => readFileSync(path.join(wortel, relatief), "utf8").replace(/\r\n/g, "\n");
const workflow = lees(".github/workflows/release.yml");

// 1. Geen eigen zip: dat zou de artifact configuration breken.
assert.ok(
  !/Compress-Archive/.test(workflow),
  "de release-workflow maakt zelf geen zip meer; upload-artifact doet dat (anders zip in zip)"
);

// 2. De uploads bevatten de bestanden onverpakt, met een pad dat de inhoud van de map op de root
//    van het artefact zet.
assert.match(
  workflow,
  /path: release\/win-unpacked\//,
  "de app-map gaat onverpakt de upload in (de map release/win-unpacked)"
);
assert.match(
  workflow,
  /path: release\/Helder-Setup-\*\.exe/,
  "de installer gaat onverpakt de upload in (release/Helder-Setup-*.exe)"
);

// 3. Beide ondertekeningsaanvragen hebben de verplichte invoer van de actie. Ontbreekt er één,
//    dan faalt de stap pas in de release.
const aanvragen = [...workflow.matchAll(/uses: signpath\/github-action-submit-signing-request@v3([\s\S]*?)(?=\n      - name:|\n      #|$)/g)];
assert.equal(aanvragen.length, 2, "de workflow vraagt twee keer een handtekening aan (app en installer)");
for (const [verzoek] of aanvragen) {
  for (const invoer of [
    "api-token:",
    "organization-id:",
    "project-slug:",
    "signing-policy-slug:",
    "artifact-configuration-slug:",
    "github-artifact-id:",
    "wait-for-completion:",
    "output-artifact-directory:",
  ]) {
    assert.ok(verzoek.includes(invoer), `de ondertekeningsstap heeft ${invoer}`);
  }
}
assert.match(workflow, /artifact-configuration-slug: helder-app/, "de app gebruikt configuratie helder-app");
assert.match(
  workflow,
  /artifact-configuration-slug: helder-installer/,
  "de installer gebruikt configuratie helder-installer"
);
assert.match(workflow, /output-artifact-directory: signed-app/, "de app komt in signed-app terecht");
assert.match(
  workflow,
  /output-artifact-directory: signed-installer/,
  "de installer komt in signed-installer terecht"
);

// 4. De actie pakt zelf uit; een Expand-Archive zou op een lege map stuklopen.
assert.ok(
  !/Expand-Archive/.test(workflow),
  "de workflow pakt het ondertekende archief niet zelf uit; de SignPath-actie doet dat"
);

// 5. Terugkopiëren met een harde controle op het resultaat.
assert.match(
  workflow,
  /Get-ChildItem "signed-app" -Recurse -File -Filter "Helder\.exe"/,
  "de workflow zoekt de ondertekende Helder.exe (recursief) en controleert dat hij bestaat"
);
assert.match(
  workflow,
  /Join-Path \$exe\.Directory\.FullName "\*"\) -Destination "release\/win-unpacked"/,
  "de map met de ondertekende Helder.exe wordt teruggezet"
);
assert.match(
  workflow,
  /Get-ChildItem "signed-installer" -Recurse -File -Filter "Helder-Setup-\*\.exe"/,
  "de workflow zoekt de ondertekende installer op"
);
assert.match(
  workflow,
  /Copy-Item -Path \$ondertekend\.FullName -Destination "release"/,
  "de ondertekende installer vervangt de ongetekende"
);

// 6. De blockmap van de ongetekende installer hoort niet bij de ondertekende bytes.
assert.match(
  workflow,
  /rm -f release\/Helder-Setup-\*\.exe\.blockmap/,
  "de verouderde blockmap wordt verwijderd vóór latest.yml opnieuw wordt gemaakt"
);
const publicatie = workflow.split("- name: Publiceren")[1] || "";
assert.ok(publicatie.length > 0, "de workflow heeft een publicatiestap");
assert.ok(
  !/\.blockmap/.test(publicatie),
  "de blockmap staat niet in de lijst met release-assets"
);

// 7. En de CI moet deze controle draaien, anders is het een script dat niemand start.
const ciWorkflow = lees(".github/workflows/ci.yml");
assert.match(ciWorkflow, /run: npm run test:signpath/, "de CI-workflow draait npm run test:signpath");

console.log(
  "Ondertekening: upload zonder eigen zip, twee aanvragen compleet, terugzetten met controle, geen blockmap."
);
