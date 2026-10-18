// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Haalt de release-opmerkingen voor één versie uit CHANGELOG.md. De bouw zet ze in
// latest.yml, zodat de app kan laten zien wat er in een update verandert.
const { readFileSync } = require("node:fs");
const path = require("node:path");

const BESTAND = path.join(__dirname, "..", "CHANGELOG.md");

function leesChangelog() {
  return readFileSync(BESTAND, "utf8").replace(/\r\n/g, "\n");
}

/**
 * De opmerkingen uit één versiesectie, als één regel per punt. Een punt in CHANGELOG.md mag over
 * meerdere regels doorlopen; die regels horen bij hetzelfde punt en worden met een spatie aan
 * elkaar geplakt. Anders zou de update-kaart alleen de eerste regel van elk punt laten zien.
 */
function notitiesUitChangelog(tekst, versie) {
  if (!versie) return null;
  const blokken = String(tekst || "")
    .replace(/\r\n/g, "\n")
    .split(/^## /m)
    .slice(1);
  const blok = blokken.find((deel) => deel.startsWith(`${versie} `) || deel.startsWith(`${versie}\n`));
  if (!blok) return null;

  const punten = [];
  let huidig = null;
  for (const ruweRegel of blok.split("\n").slice(1)) {
    const regel = ruweRegel.trim();
    if (!regel) continue;
    const nieuwPunt = regel.match(/^[-*]\s+(.*)$/);
    if (nieuwPunt) {
      if (huidig !== null) punten.push(huidig);
      huidig = nieuwPunt[1].trim();
    } else if (huidig !== null) {
      // Een uitloopregel hoort bij het punt hierboven, ook als hij is ingesprongen.
      huidig = `${huidig} ${regel}`.replace(/\s+/g, " ").trim();
    }
  }
  if (huidig !== null) punten.push(huidig);
  return punten.length > 0 ? punten.join("\n") : null;
}

function notitiesVoor(versie) {
  return notitiesUitChangelog(leesChangelog(), versie);
}

module.exports = { notitiesVoor, notitiesUitChangelog, leesChangelog };
