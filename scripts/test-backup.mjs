// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Test de automatische back-up op een echte map in de tijdelijke ruimte: schrijven, te snel
// opnieuw schrijven overslaan, na een uur wél verversen, en opruimen volgens het bewaarschema.
//
//   node scripts/test-backup.mjs
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  schrijfBackupIn,
  leesStatusIn,
  kiesTeBewaren,
  naamVoor,
  datumUitNaam,
  MAX_BYTES,
  MIN_INTERVAL_MS,
  BEWAAR_DAGEN,
} = require("../electron/back-up.cjs");

const NU = new Date(2026, 9, 18, 12, 0, 0); // 18 oktober 2026, 12:00 plaatselijke tijd
const map = mkdtempSync(path.join(os.tmpdir(), "helder-backup-test-"));

try {
  // 1. Namen: één bestand per dag, en alleen onze eigen namen worden herkend.
  assert.equal(naamVoor(NU), "helder-backup-2026-10-18.json");
  assert.equal(datumUitNaam("helder-backup-2026-10-18.json"), "2026-10-18");
  assert.equal(datumUitNaam("mijn-eigen-kopie.json"), null);
  assert.equal(datumUitNaam("helder-backup-2026-10-18.json.bak"), null);

  // 2. De eerste back-up van de dag wordt geschreven en is geldige JSON.
  const eerste = schrijfBackupIn(map, JSON.stringify({ versie: 1 }), NU);
  assert.equal(eerste.geschreven, true, "de eerste back-up wordt geschreven");
  assert.equal(eerste.overgeslagen, false);
  assert.deepEqual(JSON.parse(readFileSync(eerste.pad, "utf8")), { versie: 1 });

  // 3. Binnen het uur nog een keer: niets te doen, de inhoud blijft staan.
  const tweede = schrijfBackupIn(map, JSON.stringify({ versie: 2 }), new Date(NU.getTime() + 60_000));
  assert.equal(tweede.overgeslagen, true, "binnen een uur wordt niet opnieuw geschreven");
  assert.deepEqual(JSON.parse(readFileSync(eerste.pad, "utf8")), { versie: 1 });

  // 4. Precies dezelfde inhoud later op de dag: ook overslaan, want er is niets veranderd.
  const ouder = new Date(NU.getTime() - MIN_INTERVAL_MS - 1000);
  utimesSync(eerste.pad, ouder, ouder);
  const zelfde = schrijfBackupIn(map, JSON.stringify({ versie: 1 }), NU);
  assert.equal(zelfde.overgeslagen, true, "dezelfde inhoud levert geen nieuw bestand op");

  // 5. Na het uur met nieuwe inhoud: wél verversen, en het bestand van vandaag blijft één bestand.
  utimesSync(eerste.pad, ouder, ouder);
  const derde = schrijfBackupIn(map, JSON.stringify({ versie: 3 }), NU);
  assert.equal(derde.geschreven, true);
  assert.deepEqual(JSON.parse(readFileSync(derde.pad, "utf8")), { versie: 3 });
  assert.equal(readdirSync(map).filter((naam) => naam.startsWith("helder-backup-")).length, 1);

  // 6. Onzin wordt geweigerd in plaats van als back-up bewaard.
  assert.throws(() => schrijfBackupIn(map, "", NU), /Lege back-up/);
  assert.throws(() => schrijfBackupIn(map, "{half", NU), /geen geldige JSON/);
  assert.throws(
    () => schrijfBackupIn(map, JSON.stringify({ groot: "x".repeat(MAX_BYTES) }), NU),
    /groter dan een back-up mag zijn/
  );

  // 7. Rotatie: veertien dagen plus de nieuwste van elke maand, en niets van een ander.
  const oudeMap = path.join(map, "historie");
  mkdirSync(oudeMap, { recursive: true });
  const dagen = [];
  for (let dag = 1; dag <= 18; dag++) dagen.push(`2026-10-${String(dag).padStart(2, "0")}`);
  for (let dag = 1; dag <= 30; dag++) dagen.push(`2026-09-${String(dag).padStart(2, "0")}`);
  for (const naam of [...dagen, "2026-01-10", "2025-06-01"].map(
    (dag) => `helder-backup-${dag}.json`
  )) {
    writeFileSync(path.join(oudeMap, naam), "{}");
  }
  mkdirSync(path.join(oudeMap, "eigen-map"), { recursive: true });
  writeFileSync(path.join(oudeMap, "mijn-kopie.json"), "{}");
  schrijfBackupIn(oudeMap, JSON.stringify({ versie: 9 }), NU);

  const over = readdirSync(oudeMap).filter((naam) => naam.startsWith("helder-backup-"));
  const bewaard = kiesTeBewaren(over);
  assert.equal(
    over.length,
    BEWAAR_DAGEN + 3,
    "veertien dagen plus de nieuwste van september, januari en juni blijven over"
  );
  assert.ok(over.includes("helder-backup-2026-10-18.json"), "vandaag blijft");
  assert.ok(over.includes("helder-backup-2026-10-05.json"), "de veertiende dag blijft");
  assert.ok(!over.includes("helder-backup-2026-10-04.json"), "de vijftiende dag verdwijnt");
  assert.ok(over.includes("helder-backup-2026-09-30.json"), "de nieuwste van september blijft");
  assert.ok(!over.includes("helder-backup-2026-09-29.json"), "de rest van september verdwijnt");
  assert.ok(over.includes("helder-backup-2026-01-10.json"), "januari blijft als maandbewijs");
  assert.ok(over.includes("helder-backup-2025-06-01.json"), "juni vorig jaar blijft");
  assert.equal(bewaard.length, over.length, "precies de gekozen bestanden staan er nog");
  assert.ok(readdirSync(oudeMap).includes("mijn-kopie.json"), "vreemde bestanden blijven staan");
  assert.ok(readdirSync(oudeMap).includes("eigen-map"), "eigen mappen blijven staan");

  // 8. De status voor Instellingen wijst het nieuwste bestand aan.
  const status = leesStatusIn(oudeMap);
  assert.equal(status.laatste.naam, "helder-backup-2026-10-18.json");
  assert.equal(status.laatste.datum, "2026-10-18");
  assert.ok(status.laatste.bytes > 0);
  assert.ok(status.aantal >= BEWAAR_DAGEN);
  assert.equal(leesStatusIn(path.join(map, "bestaat-niet")).laatste, null);

  console.log(
    `Back-ups: schrijven, overslaan binnen het uur en rotatie naar ${BEWAAR_DAGEN} dagen + 12 maanden goed.`
  );
} finally {
  rmSync(map, { recursive: true, force: true });
}
