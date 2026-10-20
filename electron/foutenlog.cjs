// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Het foutenlogboek: een onverwachte fout in het hoofdproces komt in fouten.log te staan, in de
// gegevensmap naast de administratie. Zonder dat spoor kan een gebruiker alleen zeggen "hij deed
// raar"; met dit bestand kan hij meesturen wat er misging, wanneer, en in welke versie. De
// administratie zelf staat er niet in — alleen de fout, het tijdstip en de versie.
const { app, clipboard } = require("electron");
const { appendFileSync, existsSync, readFileSync, renameSync, rmSync, statSync } = require("node:fs");
const path = require("node:path");

const BESTAND = "fouten.log";
const OUD = "fouten.log.oud";
// Ruim een jaar aan gewone fouten. Daarna begint het bestand opnieuw; de vorige inhoud blijft
// staan als fouten.log.oud, zodat er nooit meer dan twee bestanden liggen.
const MAX_BYTES = 1024 * 1024;
// Voor het scherm is een megabyte tekst te veel: de pagina zou erop vastlopen. De nieuwste fouten
// staan onderaan, dus dat is wat Instellingen laat zien; kopiëren doet altijd het hele bestand.
const TOON_MAX = 16 * 1024;

const UITLEG = [
  "Helder schrijft hier onverwachte fouten op die in het programma zelf optraden.",
  "Je administratie staat hier niet in. Stuur dit bestand mee als je een fout meldt:",
  "het laat zien wat er misging en wanneer. Je mag het ook gewoon weggooien.",
];

function logPad() {
  return path.join(app.getPath("userData"), BESTAND);
}

// Leesbaar tijdstip in plaats van 2026-10-18T09:12:03.123Z; de gebruiker leest dit bestand zelf.
function tijdstip(datum) {
  const twee = (getal) => String(getal).padStart(2, "0");
  return (
    `${datum.getFullYear()}-${twee(datum.getMonth() + 1)}-${twee(datum.getDate())} ` +
    `${twee(datum.getHours())}:${twee(datum.getMinutes())}:${twee(datum.getSeconds())}`
  );
}

// Een fout is meestal een Error, maar een afgewezen belofte mag van alles zijn.
function beschrijf(fout) {
  if (fout instanceof Error) return fout.stack || `${fout.name}: ${fout.message}`;
  if (fout && typeof fout === "object" && typeof fout.stack === "string") return fout.stack;
  return String(fout);
}

// Dit gebeurt vóór het schrijven, niet erna: anders belandt de fout die de grens overschrijdt in
// het oude bestand en lijkt het logboek daarna leeg, precies op het moment dat je het nodig hebt.
function begrens() {
  const pad = logPad();
  if (!existsSync(pad) || statSync(pad).size <= MAX_BYTES) return;
  const oud = path.join(app.getPath("userData"), OUD);
  rmSync(oud, { force: true });
  renameSync(pad, oud);
}

// Schrijven gebeurt synchroon: na een fatale fout is er geen gelegenheid meer voor iets anders,
// en een half weggeschreven logboek is erger dan geen.
function schrijfFout(soort, fout, nu = new Date()) {
  try {
    begrens();
    const pad = logPad();
    const eersteKeer = !existsSync(pad);
    const regel = [
      `${tijdstip(nu)} — ${soort}`,
      `Helder ${app.getVersion()} · Electron ${process.versions.electron} · ${process.platform} ${process.arch}`,
      beschrijf(fout),
    ].join("\n");
    const kop = eersteKeer ? `${UITLEG.join("\n")}\n\n` : "";
    appendFileSync(pad, `${kop}${regel}\n\n`, "utf8");
  } catch {
    // Loggen is een hulpmiddel, geen functionaliteit: als het niet lukt — geen schijfruimte, een
    // map die niet bestaat — mag de app daar niet op stuklopen. Het foutvenster blijft komen.
  }
}

let geinstalleerd = false;

// De monitor ziet een onverwachte fout vóórdat de gewone afhandeling aan de beurt is, en verandert
// die niet: de gebruiker houdt het venster van Electron met de melding, maar er staat nu ook een
// spoor op schijf. Een afgewezen belofte komt hier ook langs, want Node maakt daar in de
// standaardinstelling (throw) een uitzondering van.
function installeerFoutenlog() {
  if (geinstalleerd) return;
  geinstalleerd = true;
  process.on("uncaughtExceptionMonitor", (fout) =>
    schrijfFout("Onverwachte fout in het hoofdproces", fout)
  );
}

// Het hele bestand, of niets als het er (nog) niet is. Nooit een uitzondering: een ontbrekend
// logboek is de normale begintoestand, geen fout.
function leesBestand() {
  try {
    return readFileSync(logPad(), "utf8");
  } catch {
    return "";
  }
}

// Elke melding begint met een leesbaar tijdstip, dus zo tellen we de fouten zonder het formaat op
// een tweede plek te herhalen.
function telFouten(tekst) {
  return (tekst.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} — /gm) || []).length;
}

// Wat Instellingen laat zien: de stand van het logboek plus de nieuwste regels.
function leesFoutenlog() {
  const pad = logPad();
  const alles = leesBestand();
  const afgekapt = alles.length > TOON_MAX;
  return {
    pad,
    bestaat: existsSync(pad),
    aantal: telFouten(alles),
    afgekapt,
    inhoud: afgekapt ? alles.slice(-TOON_MAX) : alles,
  };
}

// Eén blok dat een gebruiker zo in een foutmelding kan plakken: welke versie, op welk systeem,
// waar het bestand staat en wat er misging. Zonder die kop moet de melder dat zelf uitzoeken.
function meldtekst(log) {
  const kop = [
    "Foutenlogboek van Helder",
    `Helder ${app.getVersion()} · Electron ${process.versions.electron} · ${process.platform} ${process.arch}`,
    `Gekopieerd op ${tijdstip(new Date())}`,
    `${log.aantal} ${log.aantal === 1 ? "fout" : "fouten"} vastgelegd in ${log.pad}`,
  ];
  // Na een vol logboek staan de oudere fouten ernaast; wie een melding doet, wil die er ook bij.
  const oud = path.join(app.getPath("userData"), OUD);
  if (existsSync(oud)) kop.push(`Oudere fouten staan in ${oud}`);
  return `${kop.join("\n")}\n\n${leesBestand()}`;
}

// Kopiëren gebeurt hier in het hoofdproces: de pagina zelf heeft geen klembordrechten en hoeft
// die ook niet te krijgen. In deze Electron-versie geeft de klembord-API een belofte terug, dus
// wachten we op de schrijfactie: anders meldt de app "gekopieerd" voordat het echt zo is, en
// verdwijnt een mislukte schrijfpoging als afgewezen belofte in het logboek zelf.
async function kopieerFoutenlog() {
  const log = leesFoutenlog();
  const tekst = meldtekst(log);
  try {
    await clipboard.writeText(tekst);
    return { gekopieerd: true, aantal: log.aantal, pad: log.pad, tekens: tekst.length };
  } catch {
    return { gekopieerd: false, aantal: log.aantal, pad: log.pad, tekens: 0 };
  }
}

module.exports = {
  installeerFoutenlog,
  schrijfFout,
  logPad,
  leesFoutenlog,
  kopieerFoutenlog,
};
