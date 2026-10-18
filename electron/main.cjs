// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Helder als gewone Windows-app. De gebouwde bestanden uit dist/ worden via een eigen
// app://-adres geserveerd, zodat de pagina zich als normale website gedraagt: localStorage
// blijft werken, absolute paden uit de build kloppen en er is geen server of internet nodig.
const { app, BrowserWindow, Menu, dialog, protocol, shell } = require("electron");
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { startUpdater, stopUpdater, controleer, installeer, huidigeStatus } = require("./updater.cjs");

const SCHEME = "app";
const HOST = "helder";
const ORIGIN = `${SCHEME}://${HOST}`;
const DIST = path.join(__dirname, "..", "dist");

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const consoleFouten = [];

// In de testmodus op een machine zonder beeldschermversnelling werkt capturePage niet.
if (process.env.HELDER_SMOKE) app.disableHardwareAcceleration();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// In de desktop-app is een service worker overbodig: alles staat al op de schijf.
const regelsVanDeServiceWorker = /\s*<script[^>]*registerSW\.js[^>]*><\/script>/;

async function serve(request) {
  const url = new URL(request.url);
  const relatief = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const bestand = path.join(DIST, relatief);
  if (!bestand.startsWith(DIST)) {
    return new Response("Niet gevonden", { status: 404 });
  }
  try {
    let inhoud = await readFile(bestand);
    if (relatief === "index.html") {
      inhoud = Buffer.from(inhoud.toString("utf8").replace(regelsVanDeServiceWorker, ""));
    }
    return new Response(inhoud, {
      headers: { "content-type": MIME[path.extname(bestand).toLowerCase()] || "application/octet-stream" },
    });
  } catch {
    // Een pad zonder bestandsextensie is een pagina-aanvraag: geef de app terug.
    if (path.extname(relatief)) return new Response("Niet gevonden", { status: 404 });
    const inhoud = await readFile(path.join(DIST, "index.html"));
    return new Response(inhoud.toString("utf8").replace(regelsVanDeServiceWorker, ""), {
      headers: { "content-type": MIME[".html"] },
    });
  }
}

function maakMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Bestand",
      submenu: [
        {
          label: "Map met gegevens openen",
          click: () => shell.openPath(app.getPath("userData")),
        },
        { type: "separator" },
        { role: "quit", label: "Afsluiten" },
      ],
    },
    {
      label: "Weergave",
      submenu: [
        { role: "reload", label: "Herladen" },
        { role: "forceReload", label: "Geforceerd herladen" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom terugzetten" },
        { role: "zoomIn", label: "Inzoomen" },
        { role: "zoomOut", label: "Uitzoomen" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Volledig scherm" },
        { role: "toggleDevTools", label: "Ontwikkelaarstools" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Controleren op updates",
          click: async () => {
            const huidig = huidigeStatus();
            if (huidig.toestand === "klaar") {
              const antwoord = await dialog.showMessageBox({
                type: "question",
                title: "Update klaar",
                message: `Versie ${huidig.versie} staat klaar om te installeren.`,
                detail: "Helder sluit af, installeert de update en start opnieuw.",
                buttons: ["Nu installeren", "Later"],
                defaultId: 0,
                cancelId: 1,
              });
              if (antwoord.response === 0) installeer();
              return;
            }
            void controleer();
            await dialog.showMessageBox({
              type: "info",
              title: "Controleren op updates",
              message: `Helder ${app.getVersion()} controleert op een nieuwe versie.`,
              detail:
                "Gevonden updates worden op de achtergrond gedownload en bij het afsluiten geïnstalleerd. In Instellingen → Updates zie je de uitkomst.",
              buttons: ["Oké"],
            });
          },
        },
        { type: "separator" },
        {
          label: "Licentie (AGPL-3.0)",
          click: async () => {
            const licentie = path.join(process.resourcesPath, "LICENSE");
            const antwoord = await dialog.showMessageBox({
              type: "info",
              title: "Licentie",
              message: "Helder is vrije software onder de GNU AGPL-3.0",
              detail:
                "Je mag Helder gebruiken, aanpassen en verspreiden. Verspreid je een aangepaste versie, dan moet de broncode onder dezelfde licentie openbaar zijn. De volledige tekst staat naast het programma in LICENSE.",
              buttons: ["Licentietekst openen", "Sluiten"],
              defaultId: 0,
              cancelId: 1,
            });
            if (antwoord.response === 0) await shell.openPath(licentie);
          },
        },
        { type: "separator" },
        {
          label: "Over Helder",
          click: async () => {
            await dialog.showMessageBox({
              type: "info",
              title: "Over Helder",
              message: `Helder ${app.getVersion()}`,
              detail:
                "Boekhouden zonder ruis: facturen, uitgaven, bankzaken en btw-aangifte.\n\n" +
                "Je administratie staat lokaal op deze computer en gaat nergens heen. " +
                "Maak regelmatig een back-up via Instellingen → Je gegevens.\n\n" +
                `Gegevensmap: ${app.getPath("userData")}`,
              buttons: ["Sluiten"],
            });
          },
        },
      ],
    },
  ]);
}

function maakVenster() {
  const venster = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#f4f6f3",
    title: "Helder",
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Externe links (betaalpagina's, e-mail) horen in de browser van de gebruiker, niet in de app.
  venster.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  venster.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(ORIGIN)) return;
    event.preventDefault();
    if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url);
  });

  // Fouten uit de pagina bewaren, zodat de smoketest ze kan melden.
  venster.webContents.on("console-message", (...argumenten) => {
    const details = argumenten[0] && typeof argumenten[0] === "object" ? argumenten[0] : null;
    const niveau = details && "level" in details ? details.level : argumenten[1];
    const bericht = details && "message" in details ? details.message : argumenten[2];
    if (niveau === "error" || niveau === 3) consoleFouten.push(String(bericht));
  });

  venster.once("ready-to-show", () => venster.show());
  venster.loadURL(`${ORIGIN}/index.html`);
  return venster;
}

async function smoketest(venster) {
  // Testmodus voor de bouwpijplijn: lees de app uit, schrijf eventueel een marker en
  // maak een schermafdruk, zodat we het echte pakket kunnen controleren zonder muis.
  const modus = process.env.HELDER_SMOKE;
  try {
    await new Promise((resolve) => venster.webContents.once("did-finish-load", resolve));
    // Route zonder leidende slash meegeven, bijvoorbeeld HELDER_SMOKE_ROUTE=instellingen.
    const route = process.env.HELDER_SMOKE_ROUTE || "";
    const hash = route ? `#/${route.replace(/^[#/]+/, "")}` : "";
    const rapport = await venster.webContents.executeJavaScript(`(async () => {
      const sleutel = Object.keys(localStorage).find((k) => k.startsWith('helder.state')) || null;
      let staat = null;
      try { staat = JSON.parse(localStorage.getItem(sleutel) || 'null'); } catch (fout) { staat = null; }
      if (${modus === "write" ? "true" : "false"}) localStorage.setItem('helder.smoketest', 'gezet');
      if (${JSON.stringify(route)}) {
        location.hash = ${JSON.stringify(hash)};
        await new Promise((klaar) => setTimeout(klaar, 400));
      }
      const kaarten = [...document.querySelectorAll('.card')];
      const updateKaart = kaarten.find(
        (kaart) => kaart.querySelector('h3') && kaart.querySelector('h3').textContent.trim() === 'Updates'
      );
      return {
        brug: !!window.helder,
        updateKaart: updateKaart
          ? {
              badge: updateKaart.querySelector('.badge') ? updateKaart.querySelector('.badge').textContent : null,
              tekst: updateKaart.innerText.replace(/\s+/g, ' ').trim(),
              knoppen: [...updateKaart.querySelectorAll('button')].map((knop) => knop.innerText.trim()),
            }
          : null,
        titel: document.title,
        kop: document.querySelector('h2') ? document.querySelector('h2').textContent : null,
        adres: location.href,
        opslagSleutel: sleutel,
        staatVersie: staat ? staat.versie : null,
        facturen: staat ? staat.facturen.length : null,
        klanten: staat ? staat.relaties.length : null,
        klantNamen: staat ? staat.relaties.map((relatie) => relatie.naam) : null,
        marker: localStorage.getItem('helder.smoketest'),
        serviceWorkerActief: !!navigator.serviceWorker.controller,
        achtergrond: getComputedStyle(document.body).backgroundColor,
        zijbalkBreedte: document.querySelector('.sidebar')
          ? Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)
          : null,
        navigatieItems: document.querySelectorAll('.nav-item').length,
        tekstLengte: document.body.innerText.length,
      };
    })()`);
    let schermafdruk = null;
    if (process.env.HELDER_SMOKE_SHOT) {
      try {
        const afbeelding = await venster.webContents.capturePage();
        await writeFile(process.env.HELDER_SMOKE_SHOT, afbeelding.toPNG());
        schermafdruk = process.env.HELDER_SMOKE_SHOT;
      } catch (fout) {
        // Geen ramp: de rest van de test is belangrijker dan de afbeelding.
        schermafdruk = `mislukt: ${fout && fout.message ? fout.message : fout}`;
      }
    }
    const verslag = JSON.stringify(
      { versie: app.getVersion(), ...rapport, schermafdruk, consoleFouten },
      null,
      2
    );
    // Een venster-app heeft geen console: in het gebouwde programma schrijven we naar een bestand.
    if (process.env.HELDER_SMOKE_FILE) await writeFile(process.env.HELDER_SMOKE_FILE, verslag);
    console.log(`SMOKE ${verslag}`);
    app.exit(0);
  } catch (fout) {
    const bericht = `SMOKE-FOUT ${fout && fout.stack ? fout.stack : fout}`;
    if (process.env.HELDER_SMOKE_FILE) {
      await writeFile(process.env.HELDER_SMOKE_FILE, bericht).catch(() => {});
    }
    console.error(bericht);
    app.exit(1);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [venster] = BrowserWindow.getAllWindows();
    if (venster) {
      if (venster.isMinimized()) venster.restore();
      venster.focus();
    }
  });

  app.setAppUserModelId("nl.helder.app");

  app.whenReady().then(async () => {
    protocol.handle(SCHEME, serve);
    Menu.setApplicationMenu(maakMenu());
    const venster = maakVenster();
    startUpdater(venster);
    if (process.env.HELDER_SMOKE) await smoketest(venster);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) maakVenster();
  });

  app.on("before-quit", () => stopUpdater());

  app.on("window-all-closed", () => {
    app.quit();
  });
}
