// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Helder als gewone Windows-app. De gebouwde bestanden uit dist/ worden via een eigen
// app://-adres geserveerd, zodat de pagina zich als normale website gedraagt: localStorage
// blijft werken, absolute paden uit de build kloppen en er is geen server of internet nodig.
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, screen, shell } = require("electron");
const { existsSync } = require("node:fs");
const { readFile, unlink, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { startUpdater, stopUpdater, controleer, installeer, huidigeStatus } = require("./updater.cjs");
const {
  installeerFoutenlog,
  schrijfFout,
  logPad,
  leesFoutenlog,
  kopieerFoutenlog,
} = require("./foutenlog.cjs");
const { btwTest } = require("./smoke-btw.cjs");
const { schrijfBriefPdf } = require("./brief-pdf.cjs");
const {
  vensterMaat,
  standaardStand,
  pasAanOpScherm,
  leesVensterstand,
  bewaarVensterstand,
} = require("./venster.cjs");

const SCHEME = "app";
const HOST = "helder";
const ORIGIN = `${SCHEME}://${HOST}`;
const DIST = path.join(__dirname, "..", "dist");

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Een onverwachte fout in het hoofdproces laat een spoor achter in de gegevensmap, zodat een
// gebruiker kan melden wat er misging. Dit staat er altijd, ook in de gewone app; zie
// electron/foutenlog.cjs. De melding zelf blijft gewoon in beeld.
installeerFoutenlog();

// Instellingen leest het logboek en kopieert het via deze twee kanalen. De pagina krijgt daarmee
// geen toegang tot het besturingssysteem: alleen deze twee handelingen, met vaste vorm.
ipcMain.handle("helder:fouten-lees", () => leesFoutenlog());
ipcMain.handle("helder:fouten-kopieer", () => kopieerFoutenlog());

// Vóór het tipsysteem stond de enige tip in venster-tip.json. Lees die markering één keer over
// naar de tips van de app en ruim het oude bestand op, zodat een bestaande installatie de tip
// niet opnieuw te zien krijgt. De app vraagt er bij het starten om; zie src/tips.ts.
async function neemOudeTipsOver() {
  const bestand = path.join(app.getPath("userData"), "venster-tip.json");
  let gezien;
  try {
    const inhoud = JSON.parse(await readFile(bestand, "utf8"));
    gezien = !!inhoud && inhoud.gezien === true;
  } catch {
    // Geen leesbaar oud bestand: er is niets over te nemen.
    return [];
  }
  try {
    await unlink(bestand);
  } catch {
    // Lukt opruimen niet, dan komt dezelfde markering de volgende keer weer langs; samenvoegen
    // is idempotent, dus kwaad kan dat niet.
  }
  return gezien ? ["venster-terugzetten"] : [];
}

ipcMain.handle("helder:tips-overnemen", neemOudeTipsOver);

// De stand van het venster zoals Instellingen hem toont: de huidige maat naast de standaardmaat
// die bij het scherm hoort waarop het venster staat.
function vensterStand(venster) {
  const werkvlak = screen.getDisplayMatching(venster.getBounds()).workArea;
  const standaard = standaardStand(werkvlak);
  const huidig = venster.getNormalBounds();
  return {
    breedte: huidig.width,
    hoogte: huidig.height,
    standaard: { breedte: standaard.breedte, hoogte: standaard.hoogte },
    aangepast:
      Math.abs(huidig.width - standaard.breedte) > 2 ||
      Math.abs(huidig.height - standaard.hoogte) > 2,
  };
}

function bewaarStand(venster) {
  const normaal = venster.getNormalBounds();
  bewaarVensterstand(app.getPath("userData"), {
    x: normaal.x,
    y: normaal.y,
    breedte: normaal.width,
    hoogte: normaal.height,
    gemaximaliseerd: venster.isMaximized(),
  });
}

// Terug naar de standaardmaat: weer midden op het scherm waar het venster staat, op de maat die
// daarbij past, en die stand meteen bewaren zodat de volgende start hetzelfde is. Dit doen zowel
// de knop in Instellingen als het menu-item met zijn sneltoets.
function zetVensterTerug(venster) {
  if (!venster || venster.isDestroyed()) return null;
  const werkvlak = screen.getDisplayMatching(venster.getBounds()).workArea;
  const standaard = standaardStand(werkvlak);
  // Uit volledig scherm en uit gemaximaliseerd, anders heeft een nieuwe maat geen zichtbaar effect.
  if (venster.isFullScreen()) venster.setFullScreen(false);
  if (venster.isMaximized()) venster.unmaximize();
  venster.setBounds({
    x: standaard.x,
    y: standaard.y,
    width: standaard.breedte,
    height: standaard.hoogte,
  });
  bewaarVensterstand(app.getPath("userData"), standaard);
  return vensterStand(venster);
}

ipcMain.handle("helder:venster-stand", (gebeurtenis) => {
  const venster = BrowserWindow.fromWebContents(gebeurtenis.sender);
  return venster ? vensterStand(venster) : null;
});

ipcMain.handle("helder:venster-terugzetten", (gebeurtenis) =>
  zetVensterTerug(BrowserWindow.fromWebContents(gebeurtenis.sender))
);

// De laatste aanmaning als PDF opslaan. De pagina levert alleen een voorgestelde bestandsnaam;
// het pad komt uit de systeemopslag en het schrijven gebeurt hier. Dezelfde printstijl en
// A4-paginamaat als Print / PDF, maar zonder de printdialoog van het systeem.
ipcMain.handle("helder:brief-pdf", async (gebeurtenis, naam) => {
  const venster = BrowserWindow.fromWebContents(gebeurtenis.sender);
  if (!venster || venster.isDestroyed()) {
    return { opgeslagen: false, pad: null, fout: "Geen venster om de brief uit te printen." };
  }
  const veilig = String(naam || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const voorgesteld = `${veilig || "brief"}.pdf`;
  let keuze;
  try {
    keuze = await dialog.showSaveDialog(venster, {
      title: "Brief als PDF opslaan",
      defaultPath: path.join(app.getPath("documents"), voorgesteld),
      buttonLabel: "Opslaan",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
  } catch (fout) {
    return {
      opgeslagen: false,
      pad: null,
      fout: fout instanceof Error ? fout.message : String(fout),
    };
  }
  if (keuze.canceled || !keuze.filePath) return { opgeslagen: false, pad: null, fout: "" };

  try {
    const doel = await schrijfBriefPdf(venster, keuze.filePath);
    return { opgeslagen: true, pad: doel, fout: "" };
  } catch (fout) {
    return {
      opgeslagen: false,
      pad: null,
      fout: fout instanceof Error ? fout.message : String(fout),
    };
  }
});

const consoleFouten = [];
// Fouten buiten de pagina om — het hoofdproces zelf — bewaren we ook, zodat de btw-test ze kan
// melden in plaats van er niets van te merken. Alleen in testmodus: bij gewoon gebruik hoort een
// onverwachte fout zichtbaar te blijven in plaats van te worden opgeslokt.
const hoofdprocesFouten = [];

function verzamelHoofdprocesFouten() {
  const origineleConsoleError = console.error.bind(console);
  console.error = (...argumenten) => {
    hoofdprocesFouten.push(
      argumenten
        .map((deel) => (deel instanceof Error && deel.stack ? deel.stack : String(deel)))
        .join(" ")
    );
    origineleConsoleError(...argumenten);
  };
  // Een eigen afhandeling voorkomt ook het foutvenster van Electron, dat in een test zou blijven
  // wachten op iemand die op Oké klikt.
  process.on("uncaughtException", (fout) => {
    hoofdprocesFouten.push(`uncaughtException: ${fout && fout.stack ? fout.stack : fout}`);
  });
  process.on("unhandledRejection", (reden) => {
    hoofdprocesFouten.push(`unhandledRejection: ${reden && reden.stack ? reden.stack : reden}`);
    // Alleen in testmodus vangen we de belofte zelf af; in de gewone app loopt hij door naar de
    // monitor hierboven. Het logboek hoort ook hier gevuld te worden, anders zou juist deze
    // afhandeling het spoor op schijf tegenhouden.
    schrijfFout("Afgewezen belofte in het hoofdproces", reden);
  });
}

// In de testmodus op een machine zonder beeldschermversnelling werkt capturePage niet.
if (process.env.HELDER_SMOKE) {
  app.disableHardwareAcceleration();
  verzamelHoofdprocesFouten();
}

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
        {
          id: "venster-terugzetten",
          label: "Venstermaat terugzetten",
          accelerator: "CmdOrCtrl+Shift+0",
          click: (_item, venster) =>
            zetVensterTerug(
              venster ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            ),
        },
        { type: "separator" },
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
          label: "Logboek met fouten",
          click: async () => {
            const pad = logPad();
            if (!existsSync(pad)) {
              await dialog.showMessageBox({
                type: "info",
                title: "Logboek met fouten",
                message: "Er zijn geen fouten vastgelegd.",
                detail: `Helder schrijft onverwachte fouten op in:\n${pad}\n\nDat bestand bestaat nog niet, dus er ging in het programma zelf niets mis.`,
                buttons: ["Ok\u00e9"],
              });
              return;
            }
            const antwoord = await dialog.showMessageBox({
              type: "info",
              title: "Logboek met fouten",
              message: "Helder heeft onverwachte fouten opgeschreven.",
              detail: `Het bestand staat in je gegevensmap:\n${pad}\n\nMeld je een fout, stuur dit bestand dan mee. Je administratie staat er niet in.`,
              buttons: ["Bestand openen", "Sluiten"],
              defaultId: 0,
              cancelId: 1,
            });
            if (antwoord.response === 0) await shell.openPath(pad);
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

// De sneltoets zoals hij in het menu staat, voor de tip bij het verkleinen. Zo kan de tekst niet
// uit de pas lopen met het menu-item.
function sneltoetsVanHetMenu() {
  const menu = Menu.getApplicationMenu();
  const item = menu ? menu.getMenuItemById("venster-terugzetten") : null;
  const ruw = (item && (item.userAccelerator || item.accelerator)) || "CmdOrCtrl+Shift+0";
  // "CmdOrCtrl" is de schrijfwijze van het menu-item; in een zin leest de echte toets beter.
  return ruw.replace("CmdOrCtrl", process.platform === "darwin" ? "Cmd" : "Ctrl");
}

// Een eenmalige tip aan de pagina. Het hoofdproces kent alleen het onderwerp en de gegevens; de
// tekst en de boekhouding van wat al gezien is, staan in src/tips.ts. Zo is een nieuwe tip één
// regel daar plus deze aanroep, zonder eigen bestand of kanaal.
function stuurTip(venster, id, gegevens = {}) {
  if (!venster || venster.isDestroyed()) return;
  venster.webContents.send("helder:tip", { id, gegevens });
}

function maakVenster() {
  // De vorige maat en plek, maar alleen als ze nog op een aangesloten scherm passen; anders de
  // standaardmaat die bij dit scherm hoort. Zie electron/venster.cjs.
  const werkvlak = screen.getPrimaryDisplay().workArea;
  const standaard = standaardStand(werkvlak);
  const bewaard = pasAanOpScherm(
    leesVensterstand(app.getPath("userData")),
    screen.getAllDisplays().map((beeldscherm) => beeldscherm.workArea)
  );
  const stand = bewaard ?? standaard;
  const maat = vensterMaat(werkvlak);
  const venster = new BrowserWindow({
    width: stand.breedte,
    height: stand.hoogte,
    // Een bewaarde plek hoort bij het scherm waarop het venster stond; anders centreren.
    ...(bewaard ? { x: stand.x, y: stand.y } : { center: true }),
    minWidth: maat.minBreedte,
    minHeight: maat.minHoogte,
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

  if (stand.gemaximaliseerd) venster.maximize();

  // Als de app gemaximaliseerd opende en je verkleint hem, is dat precies het moment waarop
  // terugzetten naar de standaardmaat nuttig is. De app toont de tip maar één keer; of dat al
  // gebeurd is, houdt src/tips.ts bij.
  if (stand.gemaximaliseerd) {
    venster.webContents.once("did-finish-load", () => {
      venster.once("unmaximize", () => {
        stuurTip(venster, "venster-terugzetten", { sneltoets: sneltoetsVanHetMenu() });
      });
    });
  }

  // Elke wijziging bewaren, maar niet bij elke pixel: pas als slepen of schalen even stil ligt.
  // Bij het sluiten gebeurt het meteen, zodat de laatste stand nooit verloren gaat.
  let bewaarTimer = null;
  const planBewaren = () => {
    clearTimeout(bewaarTimer);
    bewaarTimer = setTimeout(() => bewaarStand(venster), 400);
  };
  venster.on("resize", planBewaren);
  venster.on("move", planBewaren);
  venster.on("maximize", planBewaren);
  venster.on("unmaximize", planBewaren);
  venster.on("close", () => {
    clearTimeout(bewaarTimer);
    bewaarStand(venster);
  });

  venster.once("ready-to-show", () => venster.show());
  venster.loadURL(`${ORIGIN}/index.html`);
  return venster;
}

async function smoketest(venster) {
  // Testmodus voor de bouwpijplijn: lees de app uit, schrijf eventueel een marker en
  // maak een schermafdruk, zodat we het echte pakket kunnen controleren zonder muis.
  const modus = process.env.HELDER_SMOKE;
  // De btw-test loopt de wizard, Instellingen, de documenten, de brief en het overzicht door en
  // heeft zijn eigen verslag en exitcode; zie electron/smoke-btw.cjs. Draaien gaat via
  // scripts/test-btw.mjs.
  if (modus === "btw") return btwTest(venster, consoleFouten, hoofdprocesFouten);
  try {
    await new Promise((resolve) => venster.webContents.once("did-finish-load", resolve));
    // Voor de venstertest: eerst verkleinen en die stand bewaren, zodat de volgende start kan
    // controleren dat de bewaarde normale maat terugkomt na een gemaximaliseerd venster.
    const raamActie = process.env.HELDER_RAAM;
    if (raamActie === "verklein" || raamActie === "maximaliseer") {
      // Eerst even de tijd geven aan de pagina om op te bouwen: de meldingen luisteren pas na de
      // eerste render, en een gebruiker klikt ook niet binnen een paar milliseconden.
      await new Promise((klaar) => setTimeout(klaar, 500));
      if (raamActie === "verklein") venster.unmaximize();
      else venster.maximize();
      await new Promise((klaar) => setTimeout(klaar, 700));
    }
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
        // Wat er op dit moment in de meldingen staat; de tip bij het verkleinen komt hier langs.
        tip: (() => {
          const root = document.querySelector('#toast-root');
          return root ? (root.innerText || '').trim() || null : null;
        })(),
        // Welke eenmalige tips de app al heeft laten zien; de venstertest controleert dat de
        // venstertip er na de eerste keer in staat en er bij een tweede keer niet bijkomt.
        tips: (() => {
          try {
            const waarde = JSON.parse(localStorage.getItem('helder.tips') || '[]');
            return Array.isArray(waarde) ? waarde : null;
          } catch (fout) {
            return null;
          }
        })(),
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
    // De venstermaat gaat mee in het verslag, zodat een tweede start kan controleren of de app
    // op de bewaarde plek en maat is opengegaan.
    const verslag = JSON.stringify(
      {
        versie: app.getVersion(),
        ...rapport,
        venster: venster.getBounds(),
        normaal: venster.getNormalBounds(),
        gemaximaliseerd: venster.isMaximized(),
        werkvlak: screen.getPrimaryDisplay().workArea,
        schermafdruk,
        consoleFouten,
      },
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
