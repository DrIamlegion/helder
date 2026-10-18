// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Controleert dat de release-opmerkingen in latest.yml de volledige punten uit CHANGELOG.md
// bevatten, inclusief de uitloopregels. Zonder deze test zou de update-kaart alleen de eerste
// regel van elk punt laten zien.
//
// De test kijkt naar de versie in package.json, zodat hij na elke versieophoging automatisch de
// sectie controleert die op het punt staat uit te komen.
//
//   node scripts/test-release-notes.mjs
//
// De app leest CHANGELOG.md met src/changelog-parse.ts. Die functie wordt hier ook gedraaid,
// zodat de versiegeschiedenis in de app en de opmerkingen in latest.yml niet uit elkaar kunnen
// lopen. Node leest zo'n TypeScript-bestand sinds 22.18 zonder omweg.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import releaseNotes from "./release-notes.cjs";
import { bodyVoor } from "./release-body.mjs";
import { leesVersies } from "../src/changelog-parse.ts";

const { leesChangelog, notitiesUitChangelog, notitiesVoor } = releaseNotes;

// Een punt mag over meerdere regels doorlopen; die regels horen bij hetzelfde punt.
const voorbeeld = `# Wat is er nieuw

## 0.2.0 — 1 januari 2027

- Eerste punt met een langere uitleg
  die op de volgende regel doorloopt.
- Tweede punt met **nadruk**
  en nog een uitloopregel.

## 0.1.0 — 1 januari 2026

- Oud punt
`;

assert.equal(
  notitiesUitChangelog(voorbeeld, "0.2.0"),
  "Eerste punt met een langere uitleg die op de volgende regel doorloopt.\n" +
    "Tweede punt met **nadruk** en nog een uitloopregel.",
  "uitloopregels horen bij het punt hierboven"
);
assert.equal(notitiesUitChangelog(voorbeeld, "0.1.0"), "Oud punt");
assert.equal(notitiesUitChangelog(voorbeeld, ""), null);
assert.equal(notitiesUitChangelog(voorbeeld, "0.9.9"), null);
assert.equal(notitiesVoor("0.9.9"), null);

// De app en de release-opmerkingen gebruiken dezelfde regel: elk punt is één regel, met de
// uitloopregels eraan geplakt. Wijkt een van beide af, dan faalt de test hieronder.
const appVersies = leesVersies(voorbeeld);
assert.deepEqual(
  appVersies.map((regel) => regel.punten),
  [
    [
      "Eerste punt met een langere uitleg die op de volgende regel doorloopt.",
      "Tweede punt met **nadruk** en nog een uitloopregel.",
    ],
    ["Oud punt"],
  ],
  "de versiegeschiedenis in de app plakt uitloopregels aan het punt"
);
assert.deepEqual(
  appVersies.map((regel) => `${regel.versie} · ${regel.datum}`),
  ["0.2.0 · 1 januari 2027", "0.1.0 · 1 januari 2026"],
  "versie en datum komen uit de kop"
);

// De echte changelog: elk punt is één regel, en juist de lange punten zijn compleet.
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const versie = pkg.version;
assert.ok(versie, "package.json heeft een versie");

const sectie = leesChangelog()
  .split(/^## /m)
  .slice(1)
  .find((deel) => deel.startsWith(`${versie} `) || deel.startsWith(`${versie}\n`));
assert.ok(sectie, `de sectie van ${versie} staat in CHANGELOG.md`);

const notities = notitiesVoor(versie);
assert.ok(notities, `${versie} heeft release-opmerkingen`);
const regels = notities.split("\n");
// Dezelfde sectie door de app-parser: de versiegeschiedenis moet dezelfde punten tonen als de
// update-kaart, anders leest de gebruiker twee verschillende versies van hetzelfde verhaal.
const appSectie = leesVersies(leesChangelog()).find((regel) => regel.versie === versie);
assert.ok(appSectie, `de app vindt de sectie van ${versie}`);
assert.deepEqual(
  appSectie.punten,
  regels,
  "de versiegeschiedenis in de app toont dezelfde volledige punten als latest.yml"
);

// Een uitloopregel mag nooit als zelfstandig punt in de opmerkingen terechtkomen.
const vervolgRegels = sectie
  .split("\n")
  .slice(1)
  .map((regel) => regel.trim())
  .filter((regel) => regel && !/^[-*]\s+/.test(regel));
assert.ok(
  !regels.some((regel) => vervolgRegels.includes(regel)),
  "een uitloopregel staat niet als los punt in de opmerkingen"
);

// Ook de oudere versies in de geschiedenis: de app toont ze allemaal, en juist de lange
// punten uit 0.1.7 mogen daar niet afgekapt staan.
for (const appRegel of leesVersies(leesChangelog())) {
  assert.deepEqual(
    appRegel.punten,
    (notitiesUitChangelog(leesChangelog(), appRegel.versie) || "").split("\n"),
    `de app toont ${appRegel.versie} precies zoals latest.yml hem zou melden`
  );
}

// De GitHub-releasepagina krijgt dezelfde punten. Eén lijstitem per punt, in dezelfde volgorde en
// met de opmaak intact, zodat bezoekers zonder de app hetzelfde lezen als de update-kaart.
const body = bodyVoor(versie);
assert.ok(body, `${versie} heeft een beschrijving voor de releasepagina`);
assert.match(body, new RegExp(`^## Wat is er nieuw in Helder ${versie.replace(/\./g, "\\.")}$`, "m"));
const bodyPunten = body
  .split("\n")
  .filter((regel) => regel.startsWith("- "))
  .map((regel) => regel.slice(2));
assert.deepEqual(bodyPunten, regels, "de releasepagina somt dezelfde punten op als de update-kaart");
assert.match(
  body,
  /\[CHANGELOG\.md\]\(https:\/\/github\.com\/DrIamlegion\/helder\/blob\/main\/CHANGELOG\.md\)/,
  "de releasepagina linkt naar de volledige geschiedenis"
);
assert.equal(bodyVoor("0.9.9"), null, "een versie zonder sectie levert geen lege pagina op");

// En de workflow moet die beschrijving ook echt meesturen; anders blijft de pagina leeg.
const releaseWorkflow = readFileSync(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8"
);
assert.match(
  releaseWorkflow,
  /body_path:\s*release\/release-body\.md/,
  "de release-workflow zet de beschrijving op de release"
);
assert.match(
  releaseWorkflow,
  /node scripts\/release-body\.mjs/,
  "de release-workflow maakt de beschrijving vóór het publiceren"
);

console.log(
  `Release-opmerkingen: ${regels.length} volledige punten voor ${versie}, ook op de releasepagina.`
);
