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

function notitiesVoor(versie) {
  if (!versie) return null;
  const blokken = leesChangelog()
    .split(/^## /m)
    .slice(1);
  const blok = blokken.find((tekst) => tekst.startsWith(`${versie} `) || tekst.startsWith(`${versie}\n`));
  if (!blok) return null;
  const regels = blok
    .split("\n")
    .slice(1)
    .map((regel) => regel.trim())
    .filter((regel) => /^[-*]\s+/.test(regel))
    .map((regel) => regel.replace(/^[-*]\s+/, ""));
  return regels.length > 0 ? regels.join("\n") : null;
}

module.exports = { notitiesVoor, leesChangelog };
