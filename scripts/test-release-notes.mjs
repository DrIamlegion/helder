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
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import releaseNotes from "./release-notes.cjs";

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

/** De punten uit een sectie, met de uitloopregels aan het punt hierboven geplakt. */
function puntenUitSectie(sectie) {
  const punten = [];
  let huidig = null;
  for (const ruweRegel of sectie.split("\n").slice(1)) {
    const regel = ruweRegel.trim();
    if (!regel) continue;
    const nieuwPunt = regel.match(/^[-*]\s+(.*)$/);
    if (nieuwPunt) {
      if (huidig !== null) punten.push(huidig);
      huidig = nieuwPunt[1].trim();
    } else if (huidig !== null) {
      huidig = `${huidig} ${regel}`.replace(/\s+/g, " ").trim();
    }
  }
  if (huidig !== null) punten.push(huidig);
  return punten;
}

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
const verwacht = puntenUitSectie(sectie);
assert.deepEqual(regels, verwacht, "elk changelog-punt staat volledig op één regel");

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

console.log(`Release-opmerkingen: ${regels.length} volledige punten voor ${versie}.`);
