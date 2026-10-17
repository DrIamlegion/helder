// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Automatische updates. De app controleert bij het starten (en daarna elke paar uur)
// of er een nieuwere versie op het updatekanaal staat, downloadt die op de achtergrond
// en installeert hem bij het afsluiten. Werkt alleen in de geïnstalleerde app: een
// update vervangt de bestanden in de installatiemap.
const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { appendFile } = require("node:fs/promises");

const ELKE_KEER = 6 * 60 * 60 * 1000; // elke zes uur opnieuw kijken

let status = null;
let venster = null;
let timer = null;

function maakStatus() {
  return {
    toestand: "onbekend",
    huidigeVersie: app.getVersion(),
    versie: null,
    percentage: 0,
    bericht: "",
    gecontroleerdOp: null,
    notities: null,
    uitgebrachtOp: null,
  };
}

// electron-updater levert de notities uit latest.yml: een string, of een lijst per versie.
// HTML strippen we, zodat de app altijd platte tekst toont.
function leesNotities(info) {
  const ruw = info && info.releaseNotes;
  if (!ruw) return null;
  const tekst = Array.isArray(ruw)
    ? ruw
        .map((deel) => (deel && typeof deel === "object" ? deel.note : deel))
        .filter(Boolean)
        .join("\n")
    : String(ruw);
  const plat = tekst
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/[^>]+>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((regel) => regel.trim())
    .filter(Boolean)
    .join("\n");
  return plat || null;
}

async function schrijfLog(regel) {
  if (!process.env.HELDER_UPDATE_LOG) return;
  try {
    await appendFile(process.env.HELDER_UPDATE_LOG, `${JSON.stringify(regel)}\n`);
  } catch {
    // Loggen is hulpmiddel, geen functionaliteit.
  }
}

function meld(patch) {
  status = { ...status, ...patch };
  schrijfLog({ tijd: new Date().toISOString(), ...status });
  if (venster && !venster.isDestroyed()) venster.webContents.send("helder:update", status);
  return status;
}

function huidigeStatus() {
  return status ?? maakStatus();
}

// Een onbereikbaar kanaal is geen storing in de app: zonder internet of met een nog niet
// ingesteld adres hoort de gebruiker een geruststellende regel te zien, geen stacktrace.
function vriendelijkeFout(fout) {
  const bericht = String((fout && fout.message) || fout || "");
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_/i.test(bericht)) {
    return "Geen verbinding met het updatekanaal — Helder werkt gewoon door.";
  }
  return bericht;
}

async function controleer() {
  if (!app.isPackaged) {
    return meld({ toestand: "fout", bericht: "Bijwerken werkt alleen in de geïnstalleerde app." });
  }
  try {
    meld({ toestand: "controleren", bericht: "" });
    await autoUpdater.checkForUpdates();
  } catch (fout) {
    meld({ toestand: "fout", bericht: vriendelijkeFout(fout) });
  }
  return huidigeStatus();
}

function installeer() {
  if (huidigeStatus().toestand !== "klaar") {
    return { ...huidigeStatus(), bericht: "Er is nog geen update gedownload." };
  }
  // Stil installeren: geen wizard, geen vragen. De app sluit af, de update zet zichzelf
  // neer en Helder start meteen in de nieuwe versie op.
  autoUpdater.quitAndInstall(true, true);
  return huidigeStatus();
}

function startUpdater(hoofdvenster) {
  venster = hoofdvenster;
  status = maakStatus();

  // Voor testen en voor hosting zonder app-update.yml: zelf een kanaal opgeven.
  if (process.env.HELDER_UPDATE_URL) {
    autoUpdater.setFeedURL({ provider: "generic", url: process.env.HELDER_UPDATE_URL });
  }
  ipcMain.handle("helder:update-status", () => huidigeStatus());
  ipcMain.handle("helder:update-check", () => controleer());
  ipcMain.handle("helder:update-install", () => installeer());

  // Zonder installatie is er niets om bij te werken; de app vertelt dat netjes.
  if (!app.isPackaged) {
    meld({ toestand: "fout", bericht: "Bijwerken kan alleen in de geïnstalleerde app." });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (bericht) => schrijfLog({ tijd: new Date().toISOString(), niveau: "info", bericht: String(bericht) }),
    warn: (bericht) => schrijfLog({ tijd: new Date().toISOString(), niveau: "warn", bericht: String(bericht) }),
    error: (bericht) => schrijfLog({ tijd: new Date().toISOString(), niveau: "error", bericht: String(bericht) }),
    debug: () => {},
  };

  autoUpdater.on("checking-for-update", () => meld({ toestand: "controleren" }));
  autoUpdater.on("update-available", (info) =>
    meld({
      toestand: "beschikbaar",
      versie: info.version,
      notities: leesNotities(info),
      uitgebrachtOp: info.releaseDate || null,
      bericht: "Update wordt gedownload.",
    })
  );
  autoUpdater.on("update-not-available", (info) =>
    meld({
      toestand: "actueel",
      versie: info.version,
      bericht: "Je hebt de nieuwste versie.",
      gecontroleerdOp: new Date().toISOString(),
    })
  );
  autoUpdater.on("download-progress", (voortgang) =>
    meld({ toestand: "downloaden", percentage: Math.round(voortgang.percent) })
  );
  autoUpdater.on("update-downloaded", async (info) => {
    meld({
      toestand: "klaar",
      versie: info.version,
      percentage: 100,
      notities: leesNotities(info),
      uitgebrachtOp: info.releaseDate || null,
      bericht: "Update klaar — bij het afsluiten wordt hij geïnstalleerd.",
    });
    // Testhaak: meteen installeren en herstarten, zodat de update aantoonbaar werkt.
    if (process.env.HELDER_UPDATE_TEST === "install") {
      await schrijfLog({ tijd: new Date().toISOString(), actie: "quitAndInstall", versie: info.version });
      setImmediate(() => autoUpdater.quitAndInstall(true, true));
    }
  });
  autoUpdater.on("error", (fout) =>
    meld({
      toestand: "fout",
      bericht: vriendelijkeFout(fout),
      gecontroleerdOp: new Date().toISOString(),
    })
  );

  // Niet meteen bij het opstarten: eerst de app zelf laten laden.
  setTimeout(() => void controleer(), 8000);
  timer = setInterval(() => void controleer(), ELKE_KEER);
}

function stopUpdater() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startUpdater, stopUpdater, controleer, installeer, huidigeStatus };
