// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Draait de btw-test uit electron/smoke-btw.cjs: start de echte app in testmodus, leest het
// verslag uit en geeft de exitcode van die run door aan de bouwpijplijn.
//
//   npm run test:btw        (of npm test, dat bouwt eerst)
//
// Gecontroleerd wordt dat een vereniging of stichting standaard geen btw-nummer heeft en dat het
// vinkje "Wel btw-plichtig" het nummer terugzet — in de wizard, in Instellingen, op de factuur en
// de offerte, in de aanmaningsbrief en op het btw-overzicht, plus de lege start ("Administratie
// wissen" terug naar de wizard, en annuleren dat niets wist). Een foutmelding in de app laat de
// test ook zakken — in de pagina én in het hoofdproces (uitzonderingen, afgewezen beloften,
// console.error) — want die zou anders stil langs alle controles glippen. Tot slot worden er met
// opzet fouten veroorzaakt: die horen in fouten.log in de gegevensmap te belanden, zodat een
// gebruiker kan meesturen wat er misging. Ook een tweede fout en een vol logboek komen langs, en
// daarna de kaart Instellingen → Foutenlogboek met de kopieerknop die het hele logboek plus
// versie en systeem op het klembord zet. Tot slot het venster: het past op het scherm, de
// zijbalk scrolt in een kort venster, en de maat en plek worden bewaard. Dat laatste wordt pas echt
// gecontroleerd door de app daarna drie keer te starten in dezelfde gegevensmap: eerst
// gemaximaliseerd met de normale maat bewaard, dan verkleind naar die maat, en dan weer
// ongemaximaliseerd op precies die plek en maat. Een laatste start met een oude venster-tip.json
// controleert dat de markering van vóór het tipsysteem wordt overgenomen en opgeruimd.
//
// De app krijgt een eigen, tijdelijke profielmap mee. Daardoor blijft de administratie van de
// gebruiker buiten schot, kan de test naast een draaiende Helder staan (de app staat maar één
// instantie per profiel toe) en begint elk geval met een schone opslag. Die map blijft tot na de
// tweede start staan en wordt daarna opgeruimd.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import electron from "electron";

const DIST = path.join(process.cwd(), "dist", "index.html");
if (!existsSync(DIST)) {
  console.error("Er is nog geen dist/: draai eerst npm run build (npm run test:btw doet dat zelf).");
  process.exit(1);
}

const profiel = mkdtempSync(path.join(tmpdir(), "helder-test-"));
const verslagPad = path.join(profiel, "btw-verslag.json");

console.log("Btw-test: wizard, Instellingen, factuur en offerte, aanmaningsbrief en btw-overzicht.");
console.log(`Profiel: ${profiel}`);

const run = spawnSync(electron, [".", `--user-data-dir=${profiel}`], {
  env: {
    ...process.env,
    HELDER_SMOKE: "btw",
    HELDER_SMOKE_FILE: verslagPad,
  },
  encoding: "utf8",
  stdio: ["ignore", "inherit", "inherit"],
  timeout: 300000,
});

const verslag = existsSync(verslagPad) ? readFileSync(verslagPad, "utf8") : "";

// De tijdelijke gegevensmap pas opruimen als ook de tweede start geweest is; die heeft de
// bewaarde vensterstand nodig.
function stop(code) {
  rmSync(profiel, { recursive: true, force: true });
  process.exit(code);
}

if (run.error) {
  console.error(`De app starten mislukte: ${run.error.message}`);
  stop(1);
}

// Het verslag is de bron van waarheid: zonder verslag is er niets gecontroleerd, en dan mag
// deze test niet groen zijn — ook niet als de app zelf 0 teruggeeft. Datzelfde geldt voor een
// verslag van een andere testmodus (bijvoorbeeld de gewone smoketest): dat zou anders stil een
// lege uitslag goedkeuren, en dan lijkt de test geslaagd zonder dat er iets is nagekeken.
let rapport = null;
try {
  rapport = JSON.parse(verslag);
} catch {
  rapport = null;
}

const isBtwVerslag =
  rapport !== null &&
  typeof rapport === "object" &&
  typeof rapport.controles === "number" &&
  Array.isArray(rapport.gevallen);
const gezakt = isBtwVerslag && Array.isArray(rapport.gezakt) ? rapport.gezakt : [];

if (run.status === null) {
  console.error("De app stopte niet binnen de tijd (300 s).");
  stop(1);
}
if (!rapport) {
  console.error("De app gaf geen leesbaar verslag; zie de regels hierboven.");
  console.error(verslag ? verslag.slice(0, 4000) : "(leeg)");
  stop(1);
}
if (!isBtwVerslag) {
  console.error("Dit verslag komt niet van de btw-test; de app draaide een andere testmodus.");
  console.error(JSON.stringify(rapport).slice(0, 400));
  stop(1);
}
if (run.status !== 0 || gezakt.length > 0) {
  console.error(`Btw-test gezakt: ${gezakt.length} van ${rapport.controles} controles.`);
  for (const regel of gezakt) console.error(`- ${regel}`);
  if (gezakt.length === 0) console.error("De app stopte met een fout; zie de regels hierboven.");
  stop(1);
}
console.log(`Btw-test geslaagd: ${rapport.controles} controles goed.`);

// De btw-test eindigde met een eigen maat en plek, en gemaximaliseerd. Daarna starten we de app
// nog drie keer in dezelfde gegevensmap: eerst moet hij gemaximaliseerd opengaan met de normale
// maat bewaard, dan verkleinen (en die stand bewaren), en dan gewoon op die maat en plek
// opengaan. Alleen zo blijkt dat de app de stand echt terugleest en niet alleen wegschrijft.
const bewaardPad = path.join(profiel, "venster.json");
let bewaard = null;
try {
  bewaard = JSON.parse(readFileSync(bewaardPad, "utf8"));
} catch {
  bewaard = null;
}
if (!bewaard) {
  console.error(`De app heeft geen vensterstand bewaard (${bewaardPad}).`);
  stop(1);
}
if (bewaard.gemaximaliseerd !== true) {
  console.error(
    `De btw-test eindigde niet met een gemaximaliseerd venster: ${JSON.stringify(bewaard)}.`
  );
  stop(1);
}

// Elke start schrijft zijn eigen verslag; de uitvoer zelf is een volledig smoketestverslag dat we
// alleen tonen als er iets misgaat, zodat de pijplijnlog leesbaar blijft.
function startApp(naam, extra = {}, map = profiel) {
  const pad = path.join(map, `raam-${naam}.json`);
  const uitkomst = spawnSync(electron, [".", `--user-data-dir=${map}`], {
    env: { ...process.env, HELDER_SMOKE: "raam", HELDER_SMOKE_FILE: pad, ...extra },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: 120000,
  });
  let verslag = null;
  try {
    verslag = JSON.parse(readFileSync(pad, "utf8"));
  } catch {
    verslag = null;
  }
  if (uitkomst.error || uitkomst.status !== 0 || !verslag || !verslag.venster) {
    console.error(`Start ${naam} gaf geen leesbaar verslag; zie de regels hierboven.`);
    if (uitkomst.stdout) console.error(uitkomst.stdout.slice(-4000));
    stop(1);
  }
  return verslag;
}

// Een paar pixels verschil is het vensterkader; de plek en maat moeten verder kloppen.
const wijktAf = (a, b) => Math.abs(a - b) > 4;
const gelijkAan = (kader, stand) =>
  !wijktAf(kader.width, stand.breedte) &&
  !wijktAf(kader.height, stand.hoogte) &&
  !wijktAf(kader.x, stand.x) &&
  !wijktAf(kader.y, stand.y);
const omschrijf = (kader) => `${kader.x},${kader.y} van ${kader.width}×${kader.height}`;

// Start 2: gemaximaliseerd, met de normale maat erachter bewaard.
const tweede = startApp("max");
if (!tweede.gemaximaliseerd) {
  console.error(`De tweede start opende niet gemaximaliseerd: ${omschrijf(tweede.venster)}.`);
  stop(1);
}
if (
  tweede.venster.width < tweede.werkvlak.width - 8 ||
  tweede.venster.height < tweede.werkvlak.height - 8
) {
  console.error(
    `De tweede start opende gemaximaliseerd maar niet over het werkvlak: ${omschrijf(tweede.venster)} ` +
      `in ${tweede.werkvlak.width}×${tweede.werkvlak.height}.`
  );
  stop(1);
}
if (!tweede.normaal || !gelijkAan(tweede.normaal, bewaard)) {
  console.error(
    `De normale maat achter het gemaximaliseerde venster is niet bewaard gebleven: ` +
      `${tweede.normaal ? omschrijf(tweede.normaal) : "onbekend"}; bewaard was ` +
      `${bewaard.x},${bewaard.y} van ${bewaard.breedte}×${bewaard.hoogte}.`
  );
  stop(1);
}
console.log(`Tweede start: gemaximaliseerd, met ${omschrijf(tweede.normaal)} bewaard.`);

// Start 3: verkleinen na een gemaximaliseerde start. Dat is hét moment voor de tip met de
// sneltoets; de app hoort hem in "helder.tips" te bewaren, en de normale stand wordt weer bewaard.
const derde = startApp("verklein", { HELDER_RAAM: "verklein" });
if (derde.gemaximaliseerd) {
  console.error("De derde start bleef gemaximaliseerd na het verkleinen.");
  stop(1);
}
if (!gelijkAan(derde.venster, bewaard)) {
  console.error(
    `Na het verkleinen stond het venster op ${omschrijf(derde.venster)}; bewaard was ` +
      `${bewaard.x},${bewaard.y} van ${bewaard.breedte}×${bewaard.hoogte}.`
  );
  stop(1);
}
const tip = derde.tip || "";
if (!tip.includes("standaardmaat") || !/Shift\+0/.test(tip) || tip.includes("CmdOrCtrl")) {
  console.error(
    `De tip met de sneltoets ontbrak na het verkleinen: ${JSON.stringify(derde.tip)}.`
  );
  stop(1);
}
const tips = Array.isArray(derde.tips) ? derde.tips : [];
if (!tips.includes("venster-terugzetten")) {
  console.error(
    `De app heeft de getoonde tip niet als gezien bewaard (helder.tips: ${JSON.stringify(derde.tips)}).`
  );
  stop(1);
}
console.log(`Derde start: verkleind naar ${omschrijf(derde.venster)} met de tip "${tip}".`);

// Start 4: weer maximaliseren, zodat de volgende start opnieuw gemaximaliseerd begint.
const vierde = startApp("maximaliseer", { HELDER_RAAM: "maximaliseer" });
if (!vierde.gemaximaliseerd) {
  console.error(`De vierde start maximaliseerde niet: ${omschrijf(vierde.venster)}.`);
  stop(1);
}
console.log(`Vierde start: opnieuw gemaximaliseerd, met ${omschrijf(vierde.normaal)} bewaard.`);

// Start 5: opnieuw gemaximaliseerd openen en verkleinen; de tip hoort nu niet meer te komen.
const vijfde = startApp("verklein-tweede", { HELDER_RAAM: "verklein" });
if (vijfde.gemaximaliseerd) {
  console.error("De vijfde start bleef gemaximaliseerd na het verkleinen.");
  stop(1);
}
if (vijfde.tip && vijfde.tip.includes("standaardmaat")) {
  console.error(`De tip kwam een tweede keer: ${JSON.stringify(vijfde.tip)}.`);
  stop(1);
}
if (Array.isArray(vijfde.tips) && vijfde.tips.filter((id) => id === "venster-terugzetten").length !== 1) {
  console.error(`De tip is niet precies één keer bewaard: ${JSON.stringify(vijfde.tips)}.`);
  stop(1);
}
if (!gelijkAan(vijfde.venster, bewaard)) {
  console.error(
    `De vijfde start stond na het verkleinen op ${omschrijf(vijfde.venster)}; bewaard was ` +
      `${bewaard.x},${bewaard.y} van ${bewaard.breedte}×${bewaard.hoogte}.`
  );
  stop(1);
}
console.log(`Vijfde start: verkleind naar ${omschrijf(vijfde.venster)}, zonder de tip opnieuw.`);

// Start 6: de normale maat en plek komen terug, zonder maximaliseren.
const zesde = startApp("normaal");
if (zesde.gemaximaliseerd) {
  console.error("De zesde start opende gemaximaliseerd terwijl de bewaarde stand normaal was.");
  stop(1);
}
if (!gelijkAan(zesde.venster, bewaard)) {
  console.error(
    `De zesde start opende op ${omschrijf(zesde.venster)}; bewaard was ` +
      `${bewaard.x},${bewaard.y} van ${bewaard.breedte}×${bewaard.hoogte}.`
  );
  stop(1);
}
if (zesde.venster.width > zesde.werkvlak.width || zesde.venster.height > zesde.werkvlak.height) {
  console.error(
    `De zesde start opende groter dan het werkvlak: ${omschrijf(zesde.venster)} in ` +
      `${zesde.werkvlak.width}×${zesde.werkvlak.height}.`
  );
  stop(1);
}
console.log(`Zesde start: venster op ${omschrijf(zesde.venster)} — de bewaarde normale stand.`);

// Start 7: een bestaande installatie die de tip al had gezien vóór het tipsysteem. De oude
// markering (venster-tip.json) hoort één keer overgenomen te worden: de tip blijft weg, staat
// daarna in helder.tips en het oude bestand is opgeruimd. Het eigen profiel is nodig omdat de
// eerdere starts de tip al in helder.tips hebben staan.
const oudProfiel = path.join(profiel, "oud");
mkdirSync(oudProfiel, { recursive: true });
writeFileSync(
  path.join(oudProfiel, "venster.json"),
  `${JSON.stringify({ ...bewaard, gemaximaliseerd: true }, null, 2)}\n`
);
writeFileSync(path.join(oudProfiel, "venster-tip.json"), `${JSON.stringify({ gezien: true })}\n`);
const oud = startApp("oud", { HELDER_RAAM: "verklein" }, oudProfiel);
if (oud.tip && oud.tip.includes("standaardmaat")) {
  console.error(`De oude markering werd niet overgenomen: ${JSON.stringify(oud.tip)}.`);
  stop(1);
}
if (!Array.isArray(oud.tips) || !oud.tips.includes("venster-terugzetten")) {
  console.error(`De oude tip staat niet in helder.tips: ${JSON.stringify(oud.tips)}.`);
  stop(1);
}
if (existsSync(path.join(oudProfiel, "venster-tip.json"))) {
  console.error("Het oude venster-tip.json is niet opgeruimd.");
  stop(1);
}
if (oud.gemaximaliseerd) {
  console.error("De zevende start bleef gemaximaliseerd na het verkleinen.");
  stop(1);
}
console.log("Zevende start: oude tipmarkering overgenomen en opgeruimd, zonder de tip opnieuw.");
stop(0);
