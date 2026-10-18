// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Automatische back-ups van de administratie. De app bewaart zijn gegevens in localStorage;
// dit bestand schrijft daar één keer per uur een kopie van naar de gegevensmap, met één bestand
// per dag. Zo staat er naast de administratie altijd een leesbare JSON waar je op terug kunt
// vallen, ook als de opslag van de app zelf beschadigd raakt.
//
// De map `back-ups` bevat alleen bestanden die dit bestand zelf maakt. Wat er niet in past
// (een handmatige kopie, een map van de gebruiker) blijft staan: opruimen raakt uitsluitend
// bestanden met de naam `helder-backup-JJJJ-MM-DD.json`.
const {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");

const VOORVOEGSEL = "helder-backup-";
const PATROON = /^helder-backup-(\d{4})-(\d{2})-(\d{2})\.json$/;
// De administratie met logo's blijft ruim onder dit formaat; alles daarboven is geen back-up.
const MAX_BYTES = 8 * 1024 * 1024;
// Twee weken per dag, en daarnaast de nieuwste van elke maand: samen ruim een jaar historie.
const BEWAAR_DAGEN = 14;
const BEWAAR_MAANDEN = 12;
// Vaker dan één keer per uur schrijven levert alleen schijfwerk op: de inhoud verandert niet
// sneller dan een gebruiker facturen typt.
const MIN_INTERVAL_MS = 60 * 60 * 1000;

function tweeCijfers(getal) {
  return String(getal).padStart(2, "0");
}

/** De datum in de bestandsnaam: de plaatselijke dag, niet UTC. */
function dagVoor(nu) {
  return `${nu.getFullYear()}-${tweeCijfers(nu.getMonth() + 1)}-${tweeCijfers(nu.getDate())}`;
}

function naamVoor(nu) {
  return `${VOORVOEGSEL}${dagVoor(nu)}.json`;
}

/** De datum uit een back-upnaam, of null als het bestand niet van ons is. */
function datumUitNaam(naam) {
  const treffer = PATROON.exec(naam);
  return treffer ? `${treffer[1]}-${treffer[2]}-${treffer[3]}` : null;
}

/**
 * Welke bestanden blijven staan: de nieuwste veertien dagen, plus de nieuwste van elke maand
 * (maximaal twaalf maanden). Een oude dag verdwijnt dus pas als hij ook niet meer de jongste van
 * zijn maand is, zodat je na een half jaar nog steeds per maand iets hebt.
 */
function kiesTeBewaren(namen) {
  const datums = namen
    .map((naam) => ({ naam, datum: datumUitNaam(naam) }))
    .filter((item) => item.datum)
    .sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));

  const bewaren = new Set(datums.slice(0, BEWAAR_DAGEN).map((item) => item.naam));
  const perMaand = new Map();
  for (const item of datums) {
    const maand = item.datum.slice(0, 7);
    if (!perMaand.has(maand)) perMaand.set(maand, item.naam);
  }
  for (const naam of [...perMaand.values()].slice(0, BEWAAR_MAANDEN)) bewaren.add(naam);
  return [...bewaren];
}

/** Verwijdert back-ups die buiten het bewaarschema vallen; geeft de verwijderde namen terug. */
function ruimOp(map) {
  if (!existsSync(map)) return [];
  const namen = readdirSync(map).filter((naam) => PATROON.test(naam));
  const bewaren = new Set(kiesTeBewaren(namen));
  const verwijderd = [];
  for (const naam of namen) {
    if (bewaren.has(naam)) continue;
    try {
      unlinkSync(path.join(map, naam));
      verwijderd.push(naam);
    } catch {
      // Een bestand dat niet weg wil (open in een editor) laten we staan; volgende keer opnieuw.
    }
  }
  return verwijderd;
}

/**
 * Schrijft één back-up voor vandaag. Bestaat het bestand van vandaag al en is het jonger dan een
 * uur (of precies dezelfde inhoud), dan gebeurt er niets. De inhoud moet geldige JSON zijn: een
 * half geschreven of leeg bestand zou bij het terugzetten alleen maar verwarren.
 */
function schrijfBackupIn(map, inhoud, nu = new Date()) {
  if (typeof inhoud !== "string" || inhoud.trim() === "") {
    throw new Error("Lege back-up: er valt niets te bewaren.");
  }
  if (Buffer.byteLength(inhoud, "utf8") > MAX_BYTES) {
    throw new Error("Deze administratie is groter dan een back-up mag zijn.");
  }
  try {
    JSON.parse(inhoud);
  } catch {
    throw new Error("De back-up is geen geldige JSON.");
  }

  mkdirSync(map, { recursive: true });
  const pad = path.join(map, naamVoor(nu));
  let overgeslagen = false;
  if (existsSync(pad)) {
    const stat = statSync(pad);
    const teRecent = nu.getTime() - stat.mtimeMs < MIN_INTERVAL_MS;
    const zelfde = readFileSync(pad, "utf8") === inhoud;
    overgeslagen = teRecent || zelfde;
  }

  if (!overgeslagen) {
    // Eerst naar een tijdelijk bestand en dan hernoemen: valt de app midden in het schrijven weg,
    // dan blijft de vorige back-up van vandaag intact in plaats van half beschreven.
    const tijdelijk = `${pad}.tmp`;
    writeFileSync(tijdelijk, inhoud);
    renameSync(tijdelijk, pad);
  }

  return { geschreven: !overgeslagen, overgeslagen, pad, opgeruimd: ruimOp(map) };
}

/** Wat er in de back-upmap staat, voor Instellingen. */
function leesStatusIn(map) {
  if (!existsSync(map)) return { map, aantal: 0, laatste: null };
  const namen = readdirSync(map)
    .filter((naam) => PATROON.test(naam))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  if (namen.length === 0) return { map, aantal: 0, laatste: null };
  const pad = path.join(map, namen[0]);
  const stat = statSync(pad);
  return {
    map,
    aantal: namen.length,
    laatste: {
      naam: namen[0],
      pad,
      datum: datumUitNaam(namen[0]),
      bytes: stat.size,
      geschrevenOp: new Date(stat.mtimeMs).toISOString(),
    },
  };
}

// De drie functies hieronder praten met Electron en worden vanuit main.cjs aangeroepen. Het
// bestand erboven blijft daardoor gewone Node, zodat de test het zonder venster kan draaien.
function backUpMap() {
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "back-ups");
}

function schrijfBackup(inhoud) {
  return schrijfBackupIn(backUpMap(), inhoud);
}

function backupStatus() {
  return leesStatusIn(backUpMap());
}

async function openBackUpMap() {
  const { shell } = require("electron");
  const map = backUpMap();
  mkdirSync(map, { recursive: true });
  const fout = await shell.openPath(map);
  return { geopend: !fout, pad: map, fout };
}

module.exports = {
  schrijfBackup,
  backupStatus,
  openBackUpMap,
  schrijfBackupIn,
  leesStatusIn,
  kiesTeBewaren,
  naamVoor,
  datumUitNaam,
  MAX_BYTES,
  BEWAAR_DAGEN,
  BEWAAR_MAANDEN,
  MIN_INTERVAL_MS,
};
