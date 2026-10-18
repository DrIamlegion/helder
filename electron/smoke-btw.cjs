// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// De btw-test: controleert in de echte app dat een vereniging of stichting standaard geen
// btw-nummer heeft en dat het vinkje "Wel btw-plichtig" het nummer terugzet. Dat gebeurt op de
// vijf plekken waar het telt:
//   - de wizard, bij een nieuwe administratie;
//   - Instellingen, bij een bestaande administratie;
//   - de factuur- en offerteweergave: geen losse "BTW"-regel van jezelf zonder nummer;
//   - de aanmaningsbrief: het afzenderblok toont IBAN, e-mail en telefoon, geen btw-nummer;
//   - het btw-overzicht: cijfers per rubriek, nergens je eigen btw-nummer.
//
// Daarnaast de lege start: "Administratie wissen" moet terug naar de wizard leiden met een lege
// administratie — geen btw-nummer, geen facturen, geen klanten — terwijl annuleren juist niets
// mag wissen. Zo begint ook de btw-regel weer bij nul.
//
// Naast die controles telt deze test ook de fouten van de app zelf mee: een React-fout of mislukte
// laadactie in de pagina (die vangt main.cjs via console-message af) en alles wat in het
// hoofdproces misgaat — console.error, een uitzondering, een afgewezen belofte. Dat laat de test
// zakken, ook als alle tekst- en opslagcontroles verder goed zijn. Die meldingen worden gelezen
// vóórdat de test zelf iets meldt, zodat onze eigen GEZAKT-regels niet als fout van de app
// meetellen. De app schrijft niets naar de console en haalt niets van internet, dus dit oordeel
// hangt niet af van de machine waarop de test draait.
//
// En het foutenlogboek: een onverwachte fout in het hoofdproces hoort in fouten.log in de
// gegevensmap te staan, zodat een gebruiker kan melden wat er misging. Die fout wordt hier echt
// veroorzaakt — een uitzondering in een timer, buiten onze eigen afhandeling — en daarna gelezen:
// tijdstip, versie, platform, stapel, een tweede fout die erbij komt in plaats van het bestand te
// overschrijven, een vol logboek dat opzij wordt gezet in plaats van weggegooid, een venster dat
// blijft draaien en een menu Help dat de weg wijst. Daarna leest de test het logboek zoals een
// gebruiker dat doet: de kaart Foutenlogboek in Instellingen, de knop "Kopiëren voor een
// foutmelding" met het hele logboek plus versie en systeem op het klembord, een ingekort scherm
// bij een groot logboek en een eerlijke lege stand als er nooit iets misging.
//
// Bij elk onderdeel hoort een tegenproef: een eenmanszaak moet het veld juist wél meteen tonen,
// en mét een eigen btw-nummer moet die regel op het document wél staan. Zonder tegenproef zou
// een test die alleen "geen veld" of "geen regel" eist ook groen zijn als het veld of de regel
// voor iedereen verdwenen was. De brief en het overzicht hebben geen eigen tegenproef in de
// test: die twee zijn een wachter, en hun controles falen zodra daar een BTW-regel met een nummer
// opduikt (met een proefmutatie nagegaan, zie de commit/het verslag).
//
// Aanroepen gaat via scripts/test-btw.mjs, dat Electron met HELDER_SMOKE=btw start en een eigen
// profielmap meegeeft, zodat de administratie van de gebruiker buiten schot blijft. De
// verwachtingen hieronder staan bewust los van src/rechtsvormen.ts: een test hoort de regel te
// controleren, niet over te schrijven.

const { app, clipboard, dialog, Menu, screen } = require("electron");
const { appendFileSync, existsSync, readFileSync, rmSync, statSync } = require("node:fs");
const { writeFile } = require("node:fs/promises");
const path = require("node:path");
const { logPad } = require("./foutenlog.cjs");
const { schrijfBriefPdf } = require("./brief-pdf.cjs");
const { vensterMaat, standaardStand, pasAanOpScherm } = require("./venster.cjs");

const BTW_NUMMER = "NL123456789B01";
const BTW_VAN_DE_KLANT = "NL999999999B01";
// Zelfde sleutel als STORAGE_KEY in src/data.ts.
const OPSLAGSLEUTEL = "helder.state.v2";

// Wat in de pagina zelf loopt. Elke stap is één geheel, want alleen daar is de DOM te zien.
const HULP = `
  const uitslagen = [];
  const wacht = (ms) => new Promise((klaar) => setTimeout(klaar, ms || 150));
  const wachtTot = async (voorwaarde, ms) => {
    const einde = Date.now() + (ms || 5000);
    while (Date.now() < einde) {
      if (voorwaarde()) return true;
      await new Promise((klaar) => setTimeout(klaar, 25));
    }
    return voorwaarde();
  };
  const check = (naam, ok, detail) =>
    uitslagen.push({ naam: naam, ok: !!ok, detail: detail === undefined ? "" : String(detail) });
  // Zet de printregels even op het scherm om de printopmaak te kunnen meten.
  const printMedia = (aan) => {
    let aantal = 0;
    for (const sheet of document.styleSheets) {
      try {
        for (const regel of sheet.cssRules) {
          if (regel.media && regel.conditionText === "print") {
            regel.media.mediaText = aan ? "all" : "print";
            aantal++;
          }
        }
      } catch {
        // Een stylesheet dat niet leesbaar is, telt niet mee.
      }
    }
    return aantal;
  };
  const veld = (id) => document.querySelector("#" + id);
  const waarde = (id) => {
    const element = veld(id);
    return element ? element.value : null;
  };
  // React houdt zelf de waarde van een veld bij; daarom via de native setter plus een echt event.
  const zet = (element, nieuweWaarde) => {
    if (!element) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set;
    setter.call(element, nieuweWaarde);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  const knop = (tekst) =>
    [...document.querySelectorAll("button")].find((k) => (k.textContent || "").includes(tekst)) || null;
  const vinkje = (tekst) => {
    const label = [...document.querySelectorAll("label.check")].find((l) =>
      (l.textContent || "").includes(tekst)
    );
    return label ? label.querySelector("input[type=checkbox]") : null;
  };
  const klik = (element) => {
    if (!element) return false;
    element.click();
    return true;
  };
  // Knoppen in een bevestigingsvenster: "Wissen" zou anders de knop "Administratie wissen" op de
  // pagina zelf aanwijzen, want die staat eerder in de documentorde.
  const bevestig = (tekst) => {
    const voet = document.querySelector(".modal-foot");
    return voet
      ? [...voet.querySelectorAll("button")].find((k) => (k.textContent || "").includes(tekst)) || null
      : null;
  };
  const sleutelVanDeOpslag = () =>
    Object.keys(localStorage).find((k) => k.startsWith("helder.state")) || null;
  const leesStaat = () => {
    try {
      return JSON.parse(localStorage.getItem(sleutelVanDeOpslag()) || "null");
    } catch (fout) {
      return null;
    }
  };
  const bedrijfUitOpslag = () => {
    const staat = leesStaat();
    return staat && staat.bedrijf ? staat.bedrijf : {};
  };
  const gaNaar = async (route, wachtOp) => {
    location.hash = route;
    await wachtTot(wachtOp);
  };
  const adresBlokken = () =>
    [...document.querySelectorAll(".paper-addresses > div")].map((blok) =>
      (blok.innerText || "").replace(/\\s+/g, " ").trim()
    );
  // Een losse "BTW <nummer>"-regel is precies wat hier niet hoort. Let op: een tabelkop "Btw"
  // wordt door de opmaak als BTW weergegeven en staat dus echt in innerText; daarom zoeken we op
  // BTW gevolgd door een nummer, en niet op het woord alleen.
  const btwRegelMetNummer = () => {
    const treffer = (document.body.innerText || "").match(/BTW\\s+[A-Za-z]{2}[0-9]{9}B[0-9]{2}/);
    return treffer ? treffer[0] : "";
  };
  const kopTekst = () => {
    const kop = document.querySelector(".page-head");
    return kop ? (kop.innerText || "").replace(/\\s+/g, " ").trim() : "";
  };
  // Het documentnummer uit de briefkop. Daarmee weet je zeker dat je naar het juiste document
  // kijkt: twee schermen hebben allebei adresblokken, en daarop wachten zegt dus niets.
  const documentnummer = () => {
    const kop = document.querySelector(".paper-head");
    return kop ? (kop.innerText || "").replace(/\\s+/g, " ").trim() : "";
  };
`;

function wizardBron(testgeval) {
  return `(async () => {
  const vorm = ${JSON.stringify(testgeval.vorm)};
  const bedrijfsnaam = ${JSON.stringify(testgeval.bedrijfsnaam)};
  const zonderBtw = ${JSON.stringify(testgeval.zonderBtw)};
  const btwNummer = ${JSON.stringify(BTW_NUMMER)};
${HULP}
  // Stap 1: wie ben je, en welke rechtsvorm?
  check("stap 1 van de wizard zichtbaar", !!veld("onboarding-naam"), location.hash);
  zet(veld("onboarding-naam"), bedrijfsnaam);
  zet(veld("onboarding-eigenaar"), "Sanne de Vries");
  zet(veld("onboarding-email"), "sanne@lichtpunt.nl");
  await wacht();
  check("bedrijfsnaam ingevuld", waarde("onboarding-naam") === bedrijfsnaam, waarde("onboarding-naam"));
  zet(veld("onboarding-rechtsvorm"), vorm);
  await wacht();
  check("rechtsvorm " + vorm + " gekozen", waarde("onboarding-rechtsvorm") === vorm, waarde("onboarding-rechtsvorm"));
  klik(knop("Volgende"));
  await wachtTot(() => !!veld("onboarding-kvk"));
  check("stap 2 bereikt", !!veld("onboarding-kvk"));

  if (zonderBtw) {
    check("geen btw-invoerveld bij " + vorm, !veld("onboarding-btw"));
    check("alleen een vinkje om btw-plicht aan te zetten", !!vinkje("Wel btw-plichtig"));
    check(
      "uitleg dat " + vorm + " meestal niet btw-plichtig is",
      document.body.innerText.includes("meestal niet btw-plichtig")
    );

    klik(vinkje("Wel btw-plichtig"));
    await wachtTot(() => !!veld("onboarding-btw"));
    check("aanvinken toont het btw-veld", !!veld("onboarding-btw"));
    check("vinkje heet dan 'Toch btw-plichtig'", !!vinkje("Toch btw-plichtig"));

    zet(veld("onboarding-btw"), btwNummer);
    await wacht();
    check("nummer komt in het veld", waarde("onboarding-btw") === btwNummer, waarde("onboarding-btw"));

    klik(vinkje("Toch btw-plichtig"));
    await wachtTot(() => !veld("onboarding-btw"));
    check("uitzetten verbergt het btw-veld weer", !veld("onboarding-btw"));
    check("vinkje heet weer 'Wel btw-plichtig'", !!vinkje("Wel btw-plichtig"));

    klik(vinkje("Wel btw-plichtig"));
    await wachtTot(() => !!veld("onboarding-btw"));
    check("uitzetten wist het ingevulde nummer", waarde("onboarding-btw") === "", waarde("onboarding-btw"));

    zet(veld("onboarding-btw"), btwNummer);
    await wacht();
  } else {
    check("btw-veld staat er meteen bij " + vorm, !!veld("onboarding-btw"));
    check("geen 'Wel btw-plichtig'-vinkje bij " + vorm, !vinkje("Wel btw-plichtig"));
    zet(veld("onboarding-btw"), btwNummer);
    await wacht();
  }

  // Afronden en kijken wat er bewaard is.
  const opslaan = knop("Aan de slag");
  check("knop 'Aan de slag' aanwezig", !!opslaan);
  klik(opslaan);
  await wachtTot(() => bedrijfUitOpslag().naam === bedrijfsnaam);
  const bedrijf = bedrijfUitOpslag();
  check("opslagsleutel gevonden", !!sleutelVanDeOpslag(), sleutelVanDeOpslag());
  check("wizard afgesloten na opslaan", !veld("onboarding-naam"));
  check("rechtsvorm bewaard als " + vorm, bedrijf.rechtsvorm === vorm, bedrijf.rechtsvorm);
  check("bedrijfsnaam bewaard", bedrijf.naam === bedrijfsnaam, bedrijf.naam);
  check("btw-nummer bewaard als " + btwNummer, bedrijf.btw === btwNummer, JSON.stringify(bedrijf.btw));

  return { geval: vorm, uitslagen: uitslagen };
})()`;
}

function instellingenZonderBron() {
  return `(async () => {
  const btwNummer = ${JSON.stringify(BTW_NUMMER)};
${HULP}
  await gaNaar("#/instellingen", () => !!veld("rechtsvorm"));
  check("instellingen geopend", !!veld("rechtsvorm"));
  check("administratie uit de opslag geladen", waarde("rechtsvorm") === "Stichting", waarde("rechtsvorm"));
  check("geen btw-veld bij Stichting", !veld("btw"));
  check("vinkje 'Wel btw-plichtig' bij Stichting", !!vinkje("Wel btw-plichtig"));
  check(
    "uitleg dat Stichting meestal niet btw-plichtig is",
    document.body.innerText.includes("meestal niet btw-plichtig")
  );

  klik(vinkje("Wel btw-plichtig"));
  await wachtTot(() => !!veld("btw"));
  check("aanvinken toont het veld", !!veld("btw"));
  check("vinkje heet dan 'Toch btw-plichtig'", !!vinkje("Toch btw-plichtig"));

  zet(veld("btw"), btwNummer);
  await wacht();
  klik(knop("Opslaan"));
  await wachtTot(() => bedrijfUitOpslag().btw === btwNummer);
  check(
    "met het vinkje aan bewaart Instellingen het nummer",
    bedrijfUitOpslag().btw === btwNummer,
    JSON.stringify(bedrijfUitOpslag().btw)
  );

  klik(vinkje("Toch btw-plichtig"));
  await wachtTot(() => !veld("btw"));
  check("uitzetten verbergt het veld weer", !veld("btw"));
  klik(knop("Opslaan"));
  await wachtTot(() => bedrijfUitOpslag().btw === "");
  check("met het vinkje uit wist opslaan het nummer", bedrijfUitOpslag().btw === "", JSON.stringify(bedrijfUitOpslag().btw));
  check("rechtsvorm blijft Stichting", bedrijfUitOpslag().rechtsvorm === "Stichting", bedrijfUitOpslag().rechtsvorm);

  return { geval: "Instellingen: Stichting", uitslagen: uitslagen };
})()`;
}

function instellingenWisselBron() {
  return `(async () => {
  const btwNummer = ${JSON.stringify(BTW_NUMMER)};
${HULP}
  await gaNaar("#/instellingen", () => !!veld("rechtsvorm"));
  check("administratie uit de opslag geladen", waarde("rechtsvorm") === "Eenmanszaak", waarde("rechtsvorm"));
  check("btw-veld staat er meteen bij Eenmanszaak", !!veld("btw"));
  check("nummer van de administratie staat in het veld", waarde("btw") === btwNummer, waarde("btw"));
  check("geen 'Wel btw-plichtig'-vinkje bij Eenmanszaak", !vinkje("Wel btw-plichtig"));

  zet(veld("rechtsvorm"), "Vereniging");
  await wachtTot(() => !veld("btw"));
  check("wisselen naar Vereniging haalt het btw-veld weg", !veld("btw"));
  check("vinkje 'Wel btw-plichtig' verschijnt dan", !!vinkje("Wel btw-plichtig"));

  klik(knop("Opslaan"));
  await wachtTot(() => bedrijfUitOpslag().rechtsvorm === "Vereniging");
  check("rechtsvorm bewaard als Vereniging", bedrijfUitOpslag().rechtsvorm === "Vereniging", bedrijfUitOpslag().rechtsvorm);
  check("btw-nummer is leeg bewaard", bedrijfUitOpslag().btw === "", JSON.stringify(bedrijfUitOpslag().btw));

  return { geval: "Instellingen: Eenmanszaak wordt Vereniging", uitslagen: uitslagen };
})()`;
}

function documentenBron(testgeval) {
  return `(async () => {
  const metEigenBtw = ${JSON.stringify(testgeval.metBedrijfsBtw)};
  const eigenBtw = ${JSON.stringify(BTW_NUMMER)};
  const klantBtw = ${JSON.stringify(BTW_VAN_DE_KLANT)};
${HULP}
  const controleerDocument = (soort, blokken) => {
    const van = blokken[0] || "";
    const aan = blokken[1] || "";
    check(soort + " geopend met twee adresblokken", blokken.length >= 2, JSON.stringify(blokken.length));
    check(soort + ": ons KvK-nummer staat er", van.includes("KVK 12345678"), van);
    check(
      soort + ": " + (metEigenBtw ? "onze eigen BTW-regel staat er" : "geen losse BTW-regel van onszelf"),
      metEigenBtw ? van.includes("BTW " + eigenBtw) : !van.includes("BTW"),
      van
    );
    check(soort + ": het btw-nummer van de klant blijft staan", aan.includes("BTW " + klantBtw), aan);
  };

  await gaNaar("#/facturen/inv-test", () => documentnummer().includes("2026-0042"));
  check("de factuur 2026-0042 staat op het scherm", documentnummer().includes("2026-0042"), documentnummer());
  controleerDocument("factuur", adresBlokken());

  await gaNaar("#/offertes/off-test", () => documentnummer().includes("OFF-2026-0099"));
  check(
    "de offerte OFF-2026-0099 staat op het scherm",
    documentnummer().includes("OFF-2026-0099"),
    documentnummer()
  );
  controleerDocument("offerte", adresBlokken());

  return {
    geval: metEigenBtw ? "Documenten met eigen btw-nummer" : "Documenten zonder eigen btw-nummer",
    uitslagen: uitslagen,
  };
})()`;
}

function briefBron() {
  return `(async () => {
  const eigenBtw = ${JSON.stringify(BTW_NUMMER)};
${HULP}
  // De brief hoort bij een factuur, niet bij een brief-id: de route is /herinneringen/<factuur>.
  // Wachten op .letter-body, want adresblokken staan ook op de factuur en de offerte.
  await gaNaar("#/herinneringen/inv-test?niveau=2", () => !!document.querySelector(".letter-body"));
  const tekst = document.body.innerText || "";
  const van = adresBlokken()[0] || "";
  check("de aanmaningsbrief is geopend", !!document.querySelector(".letter-body"));
  check("de brief hoort bij factuur 2026-0042", kopTekst().includes("2026-0042"), kopTekst());
  check("het afzenderblok is echt gelezen", van.includes("IBAN NL91ABNA0417164300"), van);
  check("geen losse BTW-regel in het afzenderblok", !van.includes("BTW"), van);
  check("ons btw-nummer staat nergens in de brief", !tekst.includes(eigenBtw));
  check("geen BTW-regel met een nummer in de brief", btwRegelMetNummer() === "", btwRegelMetNummer());

  // Op papier hoort de brief ook zelf marge te houden, niet alleen via @page, en de gewone
  // aanmaning gebruikt dezelfde compacte leesmaat als de laatste brief.
  const papier = document.querySelector(".paper");
  check("de gewone aanmaning gebruikt de compacte briefopmaak", !!document.querySelector(".paper-brief"));
  printMedia(true);
  const papierPadding = papier ? parseFloat(getComputedStyle(papier).paddingTop) : 0;
  const briefFont = papier && papier.querySelector(".letter-body")
    ? getComputedStyle(papier.querySelector(".letter-body")).fontSize
    : "geen brief";
  printMedia(false);
  check("de printstijl houdt marge op de brief", papierPadding > 0, papierPadding + " px padding");
  check("de gewone aanmaning heeft dezelfde compacte leesmaat", briefFont === "11.6px", briefFont);
  check("alleen de laatste aanmaning heeft een knop PDF opslaan", !knop("PDF opslaan"));
  check("de gewone aanmaning heeft ook een A4-voorbeeld", !!knop("A4-voorbeeld"));

  return { geval: "Aanmaningsbrief", uitslagen: uitslagen };
})()`;
}

function laatsteBriefBron() {
  return `(async () => {
${HULP}
  await gaNaar("#/herinneringen/inv-test", () => !!document.querySelector(".letter-body"));
  const laatsteKnop = [...document.querySelectorAll(".seg button")].find(
    (knop) => (knop.textContent || "").trim() === "Laatste aanmaning"
  );
  if (laatsteKnop) laatsteKnop.click();
  await wachtTot(() => !!document.querySelector(".paper-laatste .letter-plan-qr img"));
  const papier = document.querySelector(".paper");
  check(
    "de laatste aanmaning heeft de compacte printopmaak",
    !!document.querySelector(".paper-brief.paper-laatste"),
    (papier ? papier.className : "geen papier") + " @ " + location.hash
  );
  check(
    "het betaalschema en de QR staan naast elkaar",
    !!document.querySelector(".letter-plan-body .letter-plan-schema") &&
      !!document.querySelector(".letter-plan-body .letter-plan-qr"),
    document.querySelector(".letter-plan-body") ? "plan-body gevonden" : "geen plan-body"
  );
  check(
    "de handtekening en de totalen staan naast elkaar",
    !!document.querySelector(".letter-end .letter-signature") &&
      !!document.querySelector(".letter-end .letter-summary"),
    document.querySelector(".letter-end") ? "letter-end gevonden" : "geen letter-end"
  );
  const pdfKnop = knop("PDF opslaan");
  check("de laatste aanmaning heeft een knop PDF opslaan", !!pdfKnop && !pdfKnop.disabled);
  check(
    "de PDF-knop praat met het hoofdproces",
    typeof window.helder?.opslaanBriefPdf === "function"
  );
  // De knoprij groeit met elke actie; hij moet binnen het venster blijven in plaats van
  // onder de rand te verdwijnen. Bij een smal venster wikkelen de knoppen naar een tweede regel.
  const acties = document.querySelector(".page-head .actions");
  const kader = acties ? acties.getBoundingClientRect() : null;
  check(
    "de acties van de brief passen binnen het venster",
    !!acties &&
      !!kader &&
      kader.right <= document.documentElement.clientWidth + 1 &&
      acties.scrollWidth <= acties.clientWidth + 1,
    acties && kader
      ? Math.round(kader.right) +
        " / " +
        document.documentElement.clientWidth +
        " · " +
        acties.scrollWidth +
        "/" +
        acties.clientWidth
      : "geen acties"
  );

  // Het A4-voorbeeld zet de printopmaak op het scherm. Zo zie je vóór het printen dezelfde
  // marges, leesmaat en paginamaat als op papier.
  const voorbeeldKnop = knop("A4-voorbeeld");
  check("de briefpagina heeft een knop A4-voorbeeld", !!voorbeeldKnop);
  klik(voorbeeldKnop);
  await wachtTot(
    () =>
      !!document.querySelector(".brief-preview-bar") &&
      document.body.classList.contains("brief-preview-open")
  );
  const vel = document.querySelector(".paper");
  await wachtTot(() => (vel ? vel.getBoundingClientRect().width : 0) > 700);
  const velKader = vel ? vel.getBoundingClientRect() : null;
  const leesmaat = document.querySelector(".letter-body")
    ? getComputedStyle(document.querySelector(".letter-body")).fontSize
    : "geen brief";
  const kop = document.querySelector(".page-head");
  const kopVerborgen = kop ? getComputedStyle(kop).display === "none" : false;
  check(
    "het A4-voorbeeld gebruikt de printopmaak",
    kopVerborgen && leesmaat === "11.6px",
    "kop " + (kopVerborgen ? "verborgen" : "zichtbaar") + " · leesmaat " + leesmaat
  );
  check(
    "het A4-voorbeeld toont een vel van 210 × 297 mm",
    !!velKader &&
      Math.abs(velKader.width - 793.7) < 2.5 &&
      Math.abs(velKader.height - 1122.5) < 12,
    velKader ? Math.round(velKader.width) + "×" + Math.round(velKader.height) + " px" : "geen vel"
  );
  // De balk hoort alleen op het scherm. De verbergregel zit in een aparte stylesheet met
  // media="print"; zetten we die tijdelijk op "all", dan moet de balk echt verdwijnen.
  const verbergBlad = [...document.styleSheets].find((blad) => {
    const node = blad.ownerNode;
    return (
      node instanceof HTMLStyleElement &&
      node.getAttribute("media") === "print" &&
      [...blad.cssRules].some((regel) => (regel.cssText || "").includes(".brief-preview-bar"))
    );
  });
  const balk = document.querySelector(".brief-preview-bar");
  let balkWegOpPapier = false;
  if (verbergBlad && balk) {
    verbergBlad.media.mediaText = "all";
    balkWegOpPapier = getComputedStyle(balk).display === "none";
    verbergBlad.media.mediaText = "print";
  }
  check("de voorbeeldbalk verdwijnt op papier", balkWegOpPapier);
  klik(knop("Sluiten"));
  await wachtTot(() => {
    const kop = document.querySelector(".page-head");
    return (
      !document.querySelector(".brief-preview-bar") &&
      !!kop &&
      getComputedStyle(kop).display !== "none"
    );
  });
  check(
    "na sluiten staat de gewone briefpagina er weer",
    !document.body.classList.contains("brief-preview-open"),
    document.body.classList.contains("brief-preview-open") ? "voorbeeld nog open" : "voorbeeld gesloten"
  );

  return { geval: "Laatste aanmaning", uitslagen: uitslagen };
})()`;
}

function logoBron() {
  return `(async () => {
${HULP}
  await gaNaar("#/instellingen", () => !!document.querySelector("#logo"));
  check("Instellingen heeft een logo-veld", !!document.querySelector(".logo-field"));

  const invoer = document.querySelector("#logo");
  const keuze = (bestand) => {
    const dt = new DataTransfer();
    dt.items.add(bestand);
    invoer.files = dt.files;
    invoer.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const meldingen = () => (document.querySelector("#toast-root") || {}).innerText || "";

  keuze(new File(["geen afbeelding"], "logo.txt", { type: "text/plain" }));
  await wacht(300);
  check("een ander bestandstype wordt geweigerd", meldingen().includes("PNG-, JPG- of WebP"), meldingen());
  check("een geweigerd bestand krijgt geen voorbeeld", !document.querySelector(".logo-preview img"));

  keuze(new File([new Uint8Array(600 * 1024)], "groot.png", { type: "image/png" }));
  await wacht(300);
  check("een te groot logo wordt geweigerd", meldingen().includes("maximaal 500 kB"), meldingen());
  check("een te groot bestand krijgt geen voorbeeld", !document.querySelector(".logo-preview img"));

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 48;
  const teken = canvas.getContext("2d");
  teken.fillStyle = "#0e8f68";
  teken.fillRect(0, 0, 160, 48);
  teken.fillStyle = "#ffffff";
  teken.font = "bold 26px sans-serif";
  teken.textBaseline = "middle";
  teken.fillText("SL", 57, 25);
  const blob = await new Promise((klaar) => canvas.toBlob(klaar, "image/png"));
  keuze(new File([blob], "logo.png", { type: "image/png" }));

  const geladen = await wachtTot(() => {
    const img = document.querySelector(".logo-preview img");
    return !!img && img.complete && img.naturalWidth > 0;
  }, 8000);
  const voorbeeld = document.querySelector(".logo-preview img");
  check(
    "het gekozen logo verschijnt in het voorbeeld",
    geladen && !!voorbeeld,
    voorbeeld ? voorbeeld.src.slice(0, 32) : "geen voorbeeld"
  );
  check(
    "de voorbeeldafbeelding is echt geladen",
    !!voorbeeld && voorbeeld.naturalWidth === 160 && voorbeeld.naturalHeight === 48,
    voorbeeld ? voorbeeld.naturalWidth + "×" + voorbeeld.naturalHeight : "geen afbeelding"
  );

  klik(knop("Opslaan"));
  const bewaard = await wachtTot(
    () => /^data:image\\/png;base64,/.test((bedrijfUitOpslag().logo || "")),
    5000
  );
  check("het logo staat in de opslag", bewaard, (bedrijfUitOpslag().logo || "").slice(0, 32));

  const klein = bedrijfUitOpslag().logoKlein || "";
  check(
    "de compacte logovariant staat in de opslag",
    /^data:image\\/(webp|png);base64,/.test(klein),
    klein.slice(0, 32)
  );
  check("de compacte logovariant blijft onder de linkgrens", klein.length > 0 && klein.length <= 1400, klein.length);
  const kleinBeeld = await new Promise((klaar) => {
    const img = new Image();
    img.onload = () => klaar(img);
    img.onerror = () => klaar(null);
    img.src = klein;
  });
  check(
    "de compacte variant past in de kop van de publieke pagina",
    !!kleinBeeld &&
      kleinBeeld.naturalWidth > 0 &&
      kleinBeeld.naturalWidth <= 132 &&
      kleinBeeld.naturalHeight <= 72,
    kleinBeeld ? kleinBeeld.naturalWidth + "×" + kleinBeeld.naturalHeight : "geen afbeelding"
  );

  // De openbare betaalpagina haalt alles uit de link; het logo moet daarin meekomen zonder
  // dat de link onbruikbaar lang wordt. Niveau 3 toont de deellink al vóór het versturen.
  await gaNaar("#/herinneringen/inv-test?niveau=3", () => !!document.querySelector(".share-row input"));
  const deellink = document.querySelector(".share-row input")
    ? document.querySelector(".share-row input").value
    : "";
  check("de deellink is gemaakt", deellink.includes("#/regeling/"), deellink.slice(0, 60));
  check("de deellink blijft compact", deellink.length <= 2600, deellink.length);
  const hash = deellink.indexOf("#");
  await gaNaar(hash >= 0 ? deellink.slice(hash) : "", () => !!document.querySelector(".public-page"));
  const publiekLogo = await wachtTot(() => {
    const img = document.querySelector(".public-top .public-logo");
    return !!img && img.complete && img.naturalWidth > 0;
  }, 5000);
  check(
    "het logo staat op de publieke betaalpagina",
    publiekLogo && !!document.querySelector(".public-top .public-logo"),
    (document.querySelector(".public-top") || {}).innerText || "geen kop"
  );
  check(
    "de publieke pagina gebruikt geen initialen meer",
    !document.querySelector(".public-top .mark")
  );

  // De klant geeft akkoord; daarna print hij de bevestiging. De printstijl hoort de logo-kop
  // te laten staan, terwijl de knoppen verdwijnen.
  const akkoordVak = document.querySelector(".accept-check input");
  if (akkoordVak) akkoordVak.click();
  await wacht(50);
  const akkoordKnop = knop("Akkoord geven");
  if (akkoordKnop) akkoordKnop.click();
  const bevestiging = await wachtTot(() => !!document.querySelector(".accept-done"));
  check("de bevestiging verschijnt na het akkoord", bevestiging);

  // Zet de printregels heel even op het scherm om te controleren dat ze de kop niet verbergen
  // en dat de pagina zelf marge houdt.
  const printAantal = printMedia(true);
  const kopInPrint = document.querySelector(".public-top")
    ? getComputedStyle(document.querySelector(".public-top")).display
    : "geen kop";
  const logoInPrint = document.querySelector(".public-top .public-logo");
  const logoZichtbaar = !!logoInPrint && logoInPrint.getBoundingClientRect().width > 0;
  const publiekePadding = document.querySelector(".public-page")
    ? parseFloat(getComputedStyle(document.querySelector(".public-page")).paddingTop)
    : 0;
  const kopieerKnop = document.querySelector(".code-box .btn");
  const kopieerPrint = kopieerKnop ? getComputedStyle(kopieerKnop).display : "geen knop";
  printMedia(false);
  check(
    "de printstijl houdt de logo-kop zichtbaar",
    printAantal > 0 && kopInPrint !== "none" && logoZichtbaar,
    printAantal + " printblokken, display " + kopInPrint
  );
  check(
    "de printstijl houdt marge op de publieke pagina",
    publiekePadding > 0,
    publiekePadding + " px padding"
  );
  check("de kopieerknop valt weg op papier", !!kopieerKnop && kopieerPrint === "none", kopieerPrint);

  await gaNaar("#/facturen/inv-test", () => documentnummer().includes("2026-0042"));
  await wachtTot(() => {
    const img = document.querySelector(".paper-brand .paper-logo");
    return !!img && img.complete && img.naturalWidth > 0;
  });
  check(
    "het logo staat op de factuur",
    !!document.querySelector(".paper-brand .paper-logo"),
    document.querySelector(".paper-brand") ? document.querySelector(".paper-brand").innerText : "geen kop"
  );
  check("de initialen zijn op de factuur vervangen", !document.querySelector(".paper-brand .mark"));

  await gaNaar("#/offertes/off-test", () => documentnummer().includes("OFF-2026-0099"));
  await wachtTot(() => {
    const img = document.querySelector(".paper-brand .paper-logo");
    return !!img && img.complete && img.naturalWidth > 0;
  });
  check("het logo staat op de offerte", !!document.querySelector(".paper-brand .paper-logo"));

  await gaNaar("#/herinneringen/inv-test?niveau=1", () => !!document.querySelector(".letter-body"));
  await wachtTot(() => {
    const img = document.querySelector(".paper-brand .paper-logo");
    return !!img && img.complete && img.naturalWidth > 0;
  });
  check("het logo staat op de aanmaningsbrief", !!document.querySelector(".paper-brand .paper-logo"));

  // De laatste aanmaning bevat de betaalregeling. De lange deellink hoort daar niet meer
  // voluit op te staan: de klant scant de QR-code. Via de niveauknop, zoals een gebruiker
  // doet; een losse hashwijziging binnen dezelfde brief houdt het gekozen niveau namelijk.
  const laatsteKnop = [...document.querySelectorAll(".seg button")].find(
    (knop) => (knop.textContent || "").trim() === "Laatste aanmaning"
  );
  check("de knop Laatste aanmaning staat op de brief", !!laatsteKnop);
  if (laatsteKnop) laatsteKnop.click();
  const qrGeladen = await wachtTot(() => {
    const img = document.querySelector(".letter-plan-qr img");
    return !!img && img.complete && img.naturalWidth > 0;
  }, 8000);
  const qr = document.querySelector(".letter-plan-qr img");
  check(
    "de laatste aanmaning toont een QR-code",
    qrGeladen && !!qr && /^data:image\\/png;base64,/.test(qr.src),
    qr ? qr.src.slice(0, 30) : "geen QR-code"
  );
  check(
    "de QR-code is groot genoeg voor print",
    !!qr && qr.naturalWidth >= 600,
    qr ? qr.naturalWidth + "×" + qr.naturalHeight : "geen QR-code"
  );
  check(
    "de lange deellink staat niet meer op de brief",
    !(document.querySelector(".letter-plan")?.innerText || "").includes("#/regeling/")
  );

  await gaNaar("#/instellingen", () => !!document.querySelector("#logo"));
  await wachtTot(() => !!document.querySelector(".logo-preview img"));
  klik(knop("Verwijderen"));
  await wachtTot(() => !document.querySelector(".logo-preview img"));
  klik(knop("Opslaan"));
  const verwijderd = await wachtTot(
    () => bedrijfUitOpslag().logo === "" && bedrijfUitOpslag().logoKlein === "",
    5000
  );
  check(
    "het logo kan weer weg, samen met de compacte variant",
    verwijderd,
    JSON.stringify(bedrijfUitOpslag().logo) + " / " + JSON.stringify(bedrijfUitOpslag().logoKlein)
  );

  // Een nieuwe deellink zonder logo hoort gewoon te werken en valt terug op de initialen.
  await gaNaar("#/herinneringen/inv-test?niveau=3", () => !!document.querySelector(".share-row input"));
  const zonderLink = document.querySelector(".share-row input")
    ? document.querySelector(".share-row input").value
    : "";
  const zonderHash = zonderLink.indexOf("#");
  await gaNaar(zonderHash >= 0 ? zonderLink.slice(zonderHash) : "", () => !!document.querySelector(".public-page"));
  await wachtTot(() => !!document.querySelector(".public-top .mark"));
  check("zonder logo gebruikt de publieke pagina weer de initialen", !!document.querySelector(".public-top .mark"));
  check("zonder logo staat er geen afbeelding in de publieke kop", !document.querySelector(".public-top .public-logo"));

  await gaNaar("#/facturen/inv-test", () => documentnummer().includes("2026-0042"));
  await wachtTot(() => !!document.querySelector(".paper-brand .mark"));
  check("zonder logo staan de initialen terug", !!document.querySelector(".paper-brand .mark"));
  check("zonder logo is er geen afbeelding meer", !document.querySelector(".paper-brand .paper-logo"));

  return { geval: "Logo", uitslagen: uitslagen };
})()`;
}

function overzichtBron() {
  return `(async () => {
  const eigenBtw = ${JSON.stringify(BTW_NUMMER)};
${HULP}
  await gaNaar("#/btw", () => (document.body.innerText || "").includes("Verschuldigde omzetbelasting"));
  const tekst = document.body.innerText || "";
  check("het btw-overzicht is geopend", tekst.includes("Verschuldigde omzetbelasting"));
  check("de berekening staat er", tekst.includes("5c") && tekst.includes("Voorbelasting over inkopen"));
  check("ons btw-nummer staat nergens op het overzicht", !tekst.includes(eigenBtw));
  check("geen BTW-regel met een nummer op het overzicht", btwRegelMetNummer() === "", btwRegelMetNummer());
  check("geen losse BTW-regel in de paginakop", !kopTekst().includes("BTW"), kopTekst());

  return { geval: "Btw-overzicht", uitslagen: uitslagen };
})()`;
}

function legeStartBron() {
  return `(async () => {
  const btwNummer = ${JSON.stringify(BTW_NUMMER)};
${HULP}
  await gaNaar("#/instellingen", () => !!veld("rechtsvorm"));
  const voor = leesStaat() || {};
  const voorBedrijf = voor.bedrijf || {};
  check("instellingen geopend met de administratie", waarde("rechtsvorm") === "Stichting", waarde("rechtsvorm"));
  check(
    "er valt iets te wissen",
    (voor.facturen || []).length === 1 && (voor.relaties || []).length === 1 && voorBedrijf.btw === btwNummer,
    JSON.stringify({ facturen: (voor.facturen || []).length, relaties: (voor.relaties || []).length, btw: voorBedrijf.btw })
  );

  klik(knop("Administratie wissen"));
  await wachtTot(() => !!document.querySelector(".modal"));
  const dialoog = document.querySelector(".modal");
  check("er wordt om bevestiging gevraagd", !!dialoog && (dialoog.innerText || "").includes("Alles wissen"));
  const wissen = bevestig("Wissen");
  check("bevestigingsknop 'Wissen' aanwezig", !!wissen);

  klik(wissen);
  // Wachten tot de opslag echt leeg is, niet alleen tot de wizard in beeld komt.
  await wachtTot(() => {
    const staat = leesStaat();
    return (
      document.querySelector("#onboarding-naam") !== null &&
      !!staat &&
      !!staat.bedrijf &&
      staat.bedrijf.naam === "" &&
      (staat.facturen || []).length === 0
    );
  });

  const na = leesStaat() || {};
  const bedrijf = na.bedrijf || {};
  const leeg = [waarde("onboarding-naam"), waarde("onboarding-eigenaar"), waarde("onboarding-email")];
  check("de wizard staat er weer", !!veld("onboarding-naam"));
  check("de wizard begint met lege velden", leeg.every((waarde) => waarde === ""), JSON.stringify(leeg));
  check(
    "de administratie is gewist",
    (na.facturen || []).length === 0 && (na.relaties || []).length === 0 && bedrijf.naam === "",
    JSON.stringify({ facturen: (na.facturen || []).length, relaties: (na.relaties || []).length, naam: bedrijf.naam })
  );
  check("het btw-nummer is weg", bedrijf.btw === "", JSON.stringify(bedrijf.btw));
  check("de rechtsvorm staat weer op de lege start", bedrijf.rechtsvorm === "Eenmanszaak", bedrijf.rechtsvorm);

  return { geval: "Lege start: administratie wissen", uitslagen: uitslagen };
})()`;
}

function wissenGeannuleerdBron() {
  return `(async () => {
  const btwNummer = ${JSON.stringify(BTW_NUMMER)};
${HULP}
  await gaNaar("#/instellingen", () => !!veld("rechtsvorm"));
  const voor = leesStaat() || {};

  klik(knop("Administratie wissen"));
  await wachtTot(() => !!document.querySelector(".modal"));
  klik(bevestig("Annuleren"));
  await wachtTot(() => !document.querySelector(".modal"));

  const na = leesStaat() || {};
  const bedrijf = na.bedrijf || {};
  check("het venster is weer dicht", !document.querySelector(".modal"));
  check("de instellingen staan er nog", waarde("rechtsvorm") === "Stichting", waarde("rechtsvorm"));
  check(
    "annuleren bewaart de facturen en klanten",
    JSON.stringify(na.facturen) === JSON.stringify(voor.facturen) &&
      JSON.stringify(na.relaties) === JSON.stringify(voor.relaties),
    JSON.stringify({ facturen: (na.facturen || []).length, relaties: (na.relaties || []).length })
  );
  check("het btw-nummer staat er nog", bedrijf.btw === btwNummer, JSON.stringify(bedrijf.btw));

  return { geval: "Lege start: wissen geannuleerd", uitslagen: uitslagen };
})()`;
}

const KLANT = {
  id: "rel-test",
  naam: "Buurtcentrum De Vlier",
  contact: "Iris Bakker",
  email: "iris@vlier.nl",
  telefoon: "030 123 45 67",
  adres: "Vlierstraat 12",
  postcode: "3512 AB",
  plaats: "Utrecht",
  btw: BTW_VAN_DE_KLANT,
  kvk: "87654321",
};

const REGEL = { id: "regel-1", omschrijving: "Advies en begeleiding", aantal: 1, prijs: 750, btw: 21 };

function bedrijf(rechtsvorm, btw) {
  return {
    naam: "Stichting Lichtpunt",
    rechtsvorm,
    eigenaar: "Sanne de Vries",
    kvk: "12345678",
    btw,
    iban: "NL91ABNA0417164300",
    email: "sanne@lichtpunt.nl",
    telefoon: "030 123 45 67",
    website: "lichtpunt.nl",
    adres: "Lichtstraat 1",
    postcode: "3511 AB",
    plaats: "Utrecht",
    land: "Nederland",
    betaaltermijn: 14,
  };
}

// Fouten uit de app zelf (console, uitzonderingen) worden één controle: dezelfde melding komt
// vaak bij elke herlaadbeurt terug, dus we tellen unieke meldingen en korten lange stapels in.
function foutGeval(naam, controlevraag, fouten) {
  const uniek = [
    ...new Set(
      (fouten || [])
        .map((fout) => String(fout).trim())
        .filter(Boolean)
        .map((fout) => (fout.length > 200 ? `${fout.slice(0, 200)}…` : fout))
    ),
  ];
  return {
    naam,
    uitslagen: [
      {
        naam: controlevraag,
        ok: uniek.length === 0,
        detail: uniek.length === 0 ? "" : `${uniek.length}× : ${uniek.join(" | ")}`.slice(0, 600),
      },
    ],
  };
}

// Een administratie zoals hij in de opslag staat; normalizeState in src/data.ts accepteert dit.
function staat(rechtsvorm, btw, metDocumenten) {
  return {
    versie: 10,
    bedrijf: bedrijf(rechtsvorm, btw),
    relaties: metDocumenten ? [KLANT] : [],
    facturen: metDocumenten
      ? [
          {
            id: "inv-test",
            nummer: "2026-0042",
            klantId: KLANT.id,
            datum: "2026-01-05",
            vervaldatum: "2026-01-19",
            status: "verzonden",
            regels: [REGEL],
            notitie: "",
          },
        ]
      : [],
    offertes: metDocumenten
      ? [
          {
            id: "off-test",
            nummer: "OFF-2026-0099",
            klantId: KLANT.id,
            datum: "2026-01-05",
            geldigTot: "2026-02-04",
            status: "verzonden",
            regels: [REGEL],
            notitie: "",
          },
        ]
      : [],
    producten: [],
    herhalingen: [],
    banktransacties: [],
    herinneringen: [],
    betaalregelingen: [],
    autoAanmaningen: true,
    uitgaven: [],
    aangiftes: {},
    aangemaakt: "2026-01-05",
  };
}

const GEVALLEN = [
  {
    naam: "Wizard: Stichting",
    start: null,
    bron: wizardBron,
    testgeval: { vorm: "Stichting", bedrijfsnaam: "Stichting Lichtpunt", zonderBtw: true },
  },
  {
    naam: "Wizard: Vereniging",
    start: null,
    bron: wizardBron,
    testgeval: { vorm: "Vereniging", bedrijfsnaam: "Vereniging Lichtpunt", zonderBtw: true },
  },
  {
    naam: "Wizard: Eenmanszaak (tegenproef)",
    start: null,
    bron: wizardBron,
    testgeval: { vorm: "Eenmanszaak", bedrijfsnaam: "Studio Lichtpunt", zonderBtw: false },
  },
  {
    naam: "Instellingen: Stichting",
    start: staat("Stichting", "", false),
    bron: instellingenZonderBron,
    testgeval: {},
  },
  {
    naam: "Instellingen: Eenmanszaak wordt Vereniging",
    start: staat("Eenmanszaak", BTW_NUMMER, false),
    bron: instellingenWisselBron,
    testgeval: {},
  },
  {
    naam: "Documenten zonder eigen btw-nummer",
    start: staat("Stichting", "", true),
    bron: documentenBron,
    testgeval: { metBedrijfsBtw: false },
  },
  {
    naam: "Documenten met eigen btw-nummer (tegenproef)",
    start: staat("Stichting", BTW_NUMMER, true),
    bron: documentenBron,
    testgeval: { metBedrijfsBtw: true },
  },
  {
    naam: "Aanmaningsbrief",
    start: staat("Stichting", BTW_NUMMER, true),
    bron: briefBron,
    testgeval: {},
  },
  {
    naam: "Laatste aanmaning",
    start: staat("Stichting", BTW_NUMMER, true),
    bron: laatsteBriefBron,
    testgeval: {},
    print: true,
  },
  {
    naam: "Btw-overzicht",
    start: staat("Stichting", BTW_NUMMER, true),
    bron: overzichtBron,
    testgeval: {},
  },
  {
    naam: "Logo",
    start: staat("Eenmanszaak", BTW_NUMMER, true),
    bron: logoBron,
    testgeval: {},
  },
  {
    naam: "Lege start: administratie wissen",
    start: staat("Stichting", BTW_NUMMER, true),
    bron: legeStartBron,
    testgeval: {},
  },
  {
    naam: "Lege start: wissen geannuleerd",
    start: staat("Stichting", BTW_NUMMER, true),
    bron: wissenGeannuleerdBron,
    testgeval: {},
  },
];

// Het foutenlogboek: een onverwachte fout in het hoofdproces hoort een spoor achter te laten in de
// gegevensmap, zodat een gebruiker kan melden wat er misging. De fout wordt hier echt veroorzaakt —
// een uitzondering in een timer, buiten onze eigen afhandeling — en niet nagespeeld. De test leest
// daarna het bestand en controleert wat een gebruiker erin zou zien staan.
async function foutenlogGeval(venster) {
  const uitslagen = [];
  const meld = (naam, ok, detail) =>
    uitslagen.push({ naam: naam, ok: !!ok, detail: detail === undefined ? "" : String(detail) });
  const pad = logPad();
  const lees = () => {
    try {
      return readFileSync(pad, "utf8");
    } catch (fout) {
      return "";
    }
  };
  const wachtTot = async (voorwaarde, ms) => {
    const einde = Date.now() + (ms || 5000);
    while (Date.now() < einde) {
      if (voorwaarde()) return true;
      await new Promise((klaar) => setTimeout(klaar, 25));
    }
    return voorwaarde();
  };
  // Het klembord is in deze Electron-versie asynchroon: lezen en schrijven geven een belofte
  // terug. Wie dat negeert, leest altijd niets en denkt ten onrechte dat kopiëren stuk is.
  const wachtOpKlembord = async (ms) => {
    const einde = Date.now() + (ms || 5000);
    while (Date.now() < einde) {
      const tekst = await clipboard.readText();
      if (typeof tekst === "string" && tekst.length > 0) return tekst;
      await new Promise((klaar) => setTimeout(klaar, 25));
    }
    const laatste = await clipboard.readText();
    return typeof laatste === "string" ? laatste : "";
  };

  meld("de gegevensmap begint zonder foutenlog", !existsSync(pad), pad);
  meld(
    "het logboek hoort in de gegevensmap, niet naast het programma",
    path.dirname(pad) === app.getPath("userData"),
    path.dirname(pad)
  );

  const eerste = "Proef: onverwachte fout in het hoofdproces";
  setTimeout(() => {
    throw new Error(eerste);
  }, 0);
  const geschreven = await wachtTot(() => lees().includes(eerste));
  const na = lees();
  meld("een onverwachte fout komt in het logboek", geschreven, geschreven ? pad : `niets in ${pad}`);
  meld(
    "de melding noemt tijdstip, versie en platform",
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} — Onverwachte fout in het hoofdproces/.test(na) &&
      na.includes(`Helder ${app.getVersion()} · Electron `) &&
      na.includes(process.platform),
    na.slice(0, 200)
  );
  meld(
    "de melding bevat de stapel van de fout",
    na.includes(`Error: ${eerste}`) && /\n\s+at /.test(na),
    na.slice(0, 300)
  );
  meld(
    "bovenaan staat wat het bestand is en dat de administratie er niet in staat",
    na.startsWith("Helder schrijft hier onverwachte fouten") && na.includes("Je administratie staat hier niet in"),
    na.slice(0, 160)
  );

  // Een tweede fout hoort erbij te komen; een logboek dat elke keer overschreven wordt, mist
  // precies de geschiedenis die je bij het melden nodig hebt.
  const tweede = "Proef: tweede fout in het hoofdproces";
  setTimeout(() => {
    throw new Error(tweede);
  }, 0);
  await wachtTot(() => lees().includes(tweede));
  const beide = lees();
  meld(
    "een tweede fout wordt toegevoegd, niet overschreven",
    beide.includes(eerste) && beide.includes(tweede),
    `${beide.includes(eerste) ? "eerste" : "eerste kwijt"} / ${beide.includes(tweede) ? "tweede" : "tweede kwijt"}`
  );
  meld(
    "de uitleg staat één keer boven het bestand",
    (beide.match(/Helder schrijft hier onverwachte fouten/g) || []).length === 1,
    JSON.stringify((beide.match(/Helder schrijft hier onverwachte fouten/g) || []).length)
  );

  // Een logboek dat eindeloos groeit helpt ook niet. Boven een megabyte begint het opnieuw en
  // blijft de oude inhoud ernaast staan; de fout die de grens passeert hoort nog in het nieuwe
  // bestand te staan, anders lijkt het logboek op dat moment leeg.
  const oud = path.join(path.dirname(pad), "fouten.log.oud");
  appendFileSync(pad, "x".repeat(1024 * 1024 + 24 * 1024), "utf8");
  const derde = "Proef: derde fout na een vol logboek";
  setTimeout(() => {
    throw new Error(derde);
  }, 0);
  await wachtTot(() => lees().includes(derde));
  meld(
    "een vol logboek wordt opzij gezet, niet weggegooid",
    existsSync(oud) && statSync(oud).size > 1024 * 1024,
    existsSync(oud) ? `${statSync(oud).size} bytes in fouten.log.oud` : "geen fouten.log.oud"
  );
  const nieuw = lees();
  meld(
    "de nieuwe fout staat meteen in het nieuwe, kleine logboek",
    nieuw.includes(derde) && statSync(pad).size < 64 * 1024,
    `${nieuw.includes(derde) ? "fout erin" : "fout ontbreekt"} · ${statSync(pad).size} bytes`
  );
  meld(
    "het nieuwe logboek begint weer met de uitleg",
    lees().startsWith("Helder schrijft hier onverwachte fouten"),
    lees().slice(0, 80)
  );

  // Een fout mag de app niet meeslepen: het venster hoort er daarna nog te staan.
  let tekst = 0;
  try {
    tekst = await venster.webContents.executeJavaScript("document.body.innerText.length");
  } catch (fout) {
    tekst = 0;
  }
  meld("de app draait na de fout gewoon door", tekst > 0, `paginatekst: ${tekst} tekens`);

  // En de gebruiker moet het bestand kunnen vinden zonder in mappen te zoeken.
  const hoofdmenu = Menu.getApplicationMenu();
  const help = hoofdmenu ? hoofdmenu.items.find((item) => item.label === "Help") : null;
  const etiketten = help && help.submenu ? help.submenu.items.map((item) => item.label) : [];
  meld(
    "het menu Help wijst de weg naar het logboek",
    etiketten.includes("Logboek met fouten"),
    etiketten.join(" | ")
  );

  // Het logboek leesbaar maken is de helft; de andere helft is dat een gebruiker het in één keer
  // kan meesturen. Daarvoor haalt Instellingen het logboek op bij het hoofdproces. Eerst twee
  // echte fouten erbij, zodat er iets te tellen en te lezen valt na de rotatie hierboven.
  const vierde = "Proef: vierde fout in het hoofdproces";
  const vijfde = "Proef: vijfde fout in het hoofdproces";
  for (const bericht of [vierde, vijfde]) {
    setTimeout(() => {
      throw new Error(bericht);
    }, 0);
    await wachtTot(() => lees().includes(bericht));
  }

  const toonInstellingen = async () => {
    await herlaadMet(venster, staat("Stichting", BTW_NUMMER, true));
    return venster.webContents.executeJavaScript(`new Promise((klaar) => {
      location.hash = "#/instellingen";
      const begin = Date.now();
      const kijk = () => {
        const kaart = [...document.querySelectorAll(".card")].find((k) =>
          k.querySelector("h3") && k.querySelector("h3").textContent.trim() === "Foutenlogboek"
        );
        if (kaart && kaart.querySelector("pre.foutenlog")) return klaar(true);
        if (Date.now() - begin > 5000) return klaar(false);
        setTimeout(kijk, 25);
      };
      kijk();
    })`);
  };

  // De kaart zoals hij op het scherm staat: titel, badge, de leesbare tekst, de knoppen en of het
  // pad van het bestand erbij staat.
  const kaartStand = () =>
    venster.webContents.executeJavaScript(`(() => {
      const kaart = [...document.querySelectorAll(".card")].find((k) =>
        k.querySelector("h3") && k.querySelector("h3").textContent.trim() === "Foutenlogboek"
      );
      if (!kaart) return null;
      const uitleg = kaart.querySelector("pre.foutenlog");
      return {
        badge: kaart.querySelector(".badge") ? kaart.querySelector(".badge").textContent.trim() : null,
        uitleg: uitleg ? uitleg.textContent : null,
        vak: uitleg
          ? {
              maxHoogte: getComputedStyle(uitleg).maxHeight,
              zichtbaar: uitleg.clientHeight,
              totaal: uitleg.scrollHeight,
            }
          : null,
        knoppen: [...kaart.querySelectorAll("button")].map((k) => (k.textContent || "").trim()),
        pad: (kaart.innerText || "").includes(${JSON.stringify(pad)}),
        tekst: (kaart.innerText || "").replace(/\\s+/g, " ").trim(),
      };
    })()`);

  meld("Instellingen opent met de kaart Foutenlogboek", (await toonInstellingen()) === true);
  const stand = await kaartStand();
  meld(
    "de kaart toont de opgeschreven fouten",
    !!stand &&
      !!stand.uitleg &&
      [derde, vierde, vijfde].every((bericht) => stand.uitleg.includes(bericht)) &&
      stand.uitleg.includes("Onverwachte fout in het hoofdproces"),
    stand && stand.uitleg ? stand.uitleg.slice(0, 140) : "geen logboek op het scherm"
  );
  meld(
    "de kaart telt de vastgelegde fouten",
    !!stand && stand.badge === "3 fouten",
    stand ? String(stand.badge) : "geen kaart"
  );
  meld(
    "de kaart noemt het pad van het bestand",
    !!stand && stand.pad === true,
    stand ? stand.tekst.slice(0, 200) : "geen kaart"
  );
  meld(
    "de kaart biedt de knop om alles in één keer te kopiëren",
    !!stand && stand.knoppen.some((knop) => knop.includes("Kopiëren")),
    stand ? stand.knoppen.join(" | ") : "geen kaart"
  );

  // Eén klik moet een compleet, plakbaar bericht opleveren: het hele bestand, met daarboven de
  // versie en het systeem. Zonder die kop moet de melder zelf uitzoeken welke versie hij draait.
  await clipboard.writeText("");
  const geklikt = await venster.webContents.executeJavaScript(`(() => {
    const kaart = [...document.querySelectorAll(".card")].find((k) =>
      k.querySelector("h3") && k.querySelector("h3").textContent.trim() === "Foutenlogboek"
    );
    const knop = kaart
      ? [...kaart.querySelectorAll("button")].find((k) => (k.textContent || "").includes("Kopiëren"))
      : null;
    if (!knop) return false;
    knop.click();
    return true;
  })()`);
  const opKlembord = await wachtOpKlembord();
  meld(
    "de knop Kopiëren zet het logboek op het klembord",
    geklikt === true && opKlembord.length > 0,
    `${opKlembord.length} tekens`
  );
  meld(
    "het gekopieerde blok bevat alle fouten",
    [derde, vierde, vijfde].every((bericht) => opKlembord.includes(bericht)),
    opKlembord.slice(0, 160)
  );
  meld(
    "het gekopieerde blok noemt versie, systeem en het aantal fouten",
    opKlembord.includes(`Helder ${app.getVersion()} · Electron `) &&
      opKlembord.includes(process.platform) &&
      opKlembord.includes("3 fouten vastgelegd") &&
      opKlembord.includes(pad),
    opKlembord.split("\n").slice(0, 4).join(" / ")
  );
  meld(
    "het gekopieerde blok is het hele logboek, niet het ingekorte scherm",
    opKlembord.endsWith(lees()),
    `${opKlembord.length} tekens gekopieerd, ${lees().length} in het bestand`
  );
  meld(
    "het gekopieerde blok wijst ook de oudere fouten aan",
    opKlembord.includes(oud),
    opKlembord.split("\n")[4] || "(geen vijfde regel)"
  );

  // Een logboek van een megabyte mag de pagina niet laten hangen: het scherm toont de nieuwste
  // regels met een uitleg erboven, en de nieuwste fout blijft zichtbaar.
  appendFileSync(pad, "x".repeat(24 * 1024), "utf8");
  const zesde = "Proef: zesde fout in een groot logboek";
  setTimeout(() => {
    throw new Error(zesde);
  }, 0);
  await wachtTot(() => lees().includes(zesde));
  await toonInstellingen();
  const ingekort = await kaartStand();
  meld(
    "een groot logboek wordt op het scherm ingekort, met de nieuwste fout erin",
    !!ingekort &&
      !!ingekort.uitleg &&
      ingekort.uitleg.startsWith("… alleen de nieuwste regels") &&
      ingekort.uitleg.includes(zesde) &&
      ingekort.uitleg.length < 20 * 1024,
    ingekort && ingekort.uitleg ? `${ingekort.uitleg.length} tekens op het scherm` : "geen kaart"
  );
  meld(
    "een lang logboek scrolt in zijn eigen vak, niet over de pagina",
    !!ingekort &&
      !!ingekort.vak &&
      ingekort.vak.maxHoogte === "220px" &&
      ingekort.vak.totaal > ingekort.vak.zichtbaar,
    ingekort && ingekort.vak
      ? `max ${ingekort.vak.maxHoogte}, ${ingekort.vak.zichtbaar} van ${ingekort.vak.totaal} px zichtbaar`
      : "geen vak"
  );

  // En als er nooit iets misging, hoort de kaart dat eerlijk te zeggen in plaats van een leeg
  // vlak of een knop die niets kopieert.
  rmSync(pad, { force: true });
  await toonInstellingen();
  const leeg = await kaartStand();
  meld(
    "zonder logboek zegt de kaart dat er niets is opgeschreven",
    !!leeg && leeg.badge === "Geen fouten" && /Er is nog niets opgeschreven/.test(leeg.tekst),
    leeg ? leeg.tekst.slice(0, 180) : "geen kaart"
  );
  meld(
    "zonder logboek valt er niets te kopiëren",
    !!leeg && !leeg.knoppen.some((knop) => knop.includes("Kopiëren")),
    leeg ? leeg.knoppen.join(" | ") || "(geen knoppen)" : "geen kaart"
  );
  meld(
    "zonder logboek blijft zichtbaar waar het zou komen te staan",
    !!leeg && leeg.pad === true,
    leeg ? leeg.tekst.slice(-160) : "geen kaart"
  );

  return { naam: "Foutenlog", uitslagen: uitslagen };
}

// Het venster: de app hoort te openen in een maat die op het scherm past, ook op een laptop met
// een klein werkvlak, en de zijbalk hoort dan scrollbaar te zijn in plaats van onder de rand te
// verdwijnen. De rekenregel zelf (electron/venster.cjs) wordt met een paar werkvlakken nagekeken,
// zodat dit ook klopt voor schermen die deze machine niet heeft. Verder: de maat en plek worden
// bewaard in de gegevensmap, een bewaarde stand van een verdwenen scherm valt terug op de
// standaard, en de knop in Instellingen zet het venster terug op de standaardmaat.
async function vensterGeval(venster) {
  const uitslagen = [];
  const meld = (naam, ok, detail) =>
    uitslagen.push({ naam: naam, ok: !!ok, detail: detail === undefined ? "" : String(detail) });

  const werkvlak = screen.getDisplayMatching(venster.getBounds()).workArea;
  const kader = venster.getBounds();
  const hoort = vensterMaat(werkvlak);
  meld(
    "het venster past op het scherm waarop het staat",
    kader.width <= werkvlak.width && kader.height <= werkvlak.height,
    `${kader.width}×${kader.height} in een werkvlak van ${werkvlak.width}×${werkvlak.height}`
  );
  // Een paar pixels verschil is afronding van het vensterkader (en bij een geschaalde weergave
  // valt de rand soms net anders uit); het gaat erom dat de maat van het scherm komt en niet vast
  // op 1360 × 900 staat.
  meld(
    "het venster opent op de maat die bij dat scherm hoort",
    Math.abs(kader.width - hoort.breedte) <= 2 && Math.abs(kader.height - hoort.hoogte) <= 2,
    `${kader.width}×${kader.height}, verwacht ${hoort.breedte}×${hoort.hoogte}`
  );

  const proeven = [
    { werk: { width: 1920, height: 1032 }, verwacht: { breedte: 1360, hoogte: 900, minBreedte: 1024, minHoogte: 680 } },
    { werk: { width: 1366, height: 728 }, verwacht: { breedte: 1318, hoogte: 680, minBreedte: 1024, minHoogte: 680 } },
    { werk: { width: 1024, height: 600 }, verwacht: { breedte: 976, hoogte: 552, minBreedte: 976, minHoogte: 552 } },
    { werk: { width: 800, height: 480 }, verwacht: { breedte: 752, hoogte: 432, minBreedte: 752, minHoogte: 432 } },
    { werk: { width: 3840, height: 2080 }, verwacht: { breedte: 1360, hoogte: 900, minBreedte: 1024, minHoogte: 680 } },
  ];
  const mis = proeven.filter(({ werk, verwacht }) => {
    const maat = vensterMaat(werk);
    return Object.keys(verwacht).some((sleutel) => maat[sleutel] !== verwacht[sleutel]);
  });
  meld(
    "de maat gaat mee met het werkvlak, van klein tot groot",
    mis.length === 0,
    mis.length === 0
      ? "vijf werkvlakken goed"
      : mis.map(({ werk }) => `${werk.width}×${werk.height} → ${JSON.stringify(vensterMaat(werk))}`).join(" | ")
  );

  // Een kort venster: de zijbalk is dan hoger dan het scherm. Scrollen moet de laatste ingang en
  // de hulpkaart onderaan bereikbaar maken.
  const origineel = venster.getBounds();
  // 680 is de minimumhoogte van het venster; lager laat Electron niet toe en dat is precies het
  // geval waarin de zijbalk moet scrollen.
  venster.setSize(Math.max(1100, origineel.width), 680);
  await new Promise((klaar) => setTimeout(klaar, 300));
  const stand = await venster.webContents.executeJavaScript(`(() => {
    const zijbalk = document.querySelector(".sidebar");
    if (!zijbalk) return null;
    const laatste = [...document.querySelectorAll(".nav-item")].pop();
    const kader = zijbalk.getBoundingClientRect();
    const voor = laatste ? laatste.getBoundingClientRect().bottom : null;
    zijbalk.scrollTop = zijbalk.scrollHeight;
    const na = laatste ? laatste.getBoundingClientRect().bottom : null;
    return {
      overloop: getComputedStyle(zijbalk).overflowY,
      scrollbaar: zijbalk.scrollHeight > zijbalk.clientHeight + 1,
      hoogte: zijbalk.clientHeight,
      inhoud: zijbalk.scrollHeight,
      voor: voor === null ? null : Math.round(voor),
      na: na === null ? null : Math.round(na),
      onderkant: Math.round(kader.bottom),
      bereikbaar: na !== null && na <= kader.bottom + 1,
    };
  })()`);
  meld(
    "in een kort venster scrolt de zijbalk in plaats van af te knippen",
    !!stand && stand.overloop === "auto" && stand.scrollbaar,
    stand ? `overflow-y: ${stand.overloop}, ${stand.inhoud} px inhoud in ${stand.hoogte} px` : "geen zijbalk"
  );
  meld(
    "de laatste ingang van de zijbalk blijft zo bereikbaar",
    !!stand && stand.bereikbaar,
    stand ? `onderkant van Instellingen op ${stand.na} px, zijbalk tot ${stand.onderkant} px` : "geen zijbalk"
  );
  venster.setSize(origineel.width, origineel.height);
  // Bewaren gebeurt met een korte vertraging, zodat slepen niet bij elke pixel schrijft.
  await new Promise((klaar) => setTimeout(klaar, 700));

  const bewaardPad = path.join(app.getPath("userData"), "venster.json");
  const leesBewaard = () => {
    try {
      return JSON.parse(readFileSync(bewaardPad, "utf8"));
    } catch (fout) {
      return null;
    }
  };
  const bewaard = leesBewaard();
  const normaal = venster.getNormalBounds();
  meld(
    "de maat en de plek worden in de gegevensmap bewaard",
    !!bewaard &&
      bewaard.breedte === normaal.width &&
      bewaard.hoogte === normaal.height &&
      bewaard.x === normaal.x &&
      bewaard.y === normaal.y,
    bewaard ? JSON.stringify(bewaard) : `geen ${bewaardPad}`
  );

  // Een bewaarde stand van een scherm dat er niet meer is, of een maat die intussen te groot is,
  // mag de app niet buiten beeld laten beginnen.
  const schermen = [
    { x: 0, y: 0, width: 1920, height: 1032 },
    { x: 1920, y: 0, width: 1920, height: 1032 },
  ];
  const gevallen = [
    {
      naam: "een bewaarde maat die nog op het scherm past blijft staan",
      stand: { x: 280, y: 66, breedte: 1360, hoogte: 900 },
      verwacht: { x: 280, y: 66, breedte: 1360, hoogte: 900 },
    },
    {
      naam: "een scherm dat niet meer aangesloten is valt terug op de standaard",
      stand: { x: 5200, y: 120, breedte: 1200, hoogte: 800 },
      verwacht: null,
    },
    {
      naam: "een bewaarde maat die niet meer past wordt op het scherm gekrompen",
      stand: { x: 0, y: 0, breedte: 3000, hoogte: 2000 },
      verwacht: { x: 0, y: 0, breedte: 1920, hoogte: 1032 },
    },
    {
      naam: "een venster dat half buiten beeld stond schuift terug het scherm in",
      stand: { x: 1800, y: 900, breedte: 1200, hoogte: 700 },
      verwacht: { x: 1920, y: 332, breedte: 1200, hoogte: 700 },
    },
    {
      naam: "een te klein bewaarde maat wordt op de minimummaat gezet",
      stand: { x: 100, y: 100, breedte: 320, hoogte: 200 },
      verwacht: { x: 100, y: 100, breedte: 1024, hoogte: 680 },
    },
  ];
  for (const geval of gevallen) {
    const uitkomst = pasAanOpScherm(geval.stand, schermen);
    const gelijk =
      geval.verwacht === null
        ? uitkomst === null
        : !!uitkomst &&
          ["x", "y", "breedte", "hoogte"].every(
            (sleutel) => uitkomst[sleutel] === geval.verwacht[sleutel]
          );
    meld(geval.naam, gelijk, JSON.stringify(uitkomst));
  }

  // De knop in Instellingen: eerst een eigen maat, dan terug naar de standaardmaat. De kaart leest
  // de maat bij het openen en volgt daarna elke wijziging van het venster.
  const naarInstellingen = await venster.webContents.executeJavaScript(`new Promise((klaar) => {
    location.hash = "#/instellingen";
    const begin = Date.now();
    const kijk = () => {
      const kaart = [...document.querySelectorAll(".card")].find((k) =>
        k.querySelector("h3") && k.querySelector("h3").textContent.trim() === "Venster"
      );
      if (kaart && (kaart.innerText || "").includes("×")) return klaar(true);
      if (Date.now() - begin > 5000) return klaar(false);
      setTimeout(kijk, 25);
    };
    kijk();
  })`);
  meld("Instellingen toont de kaart Venster", naarInstellingen === true);

  const vensterKaart = () =>
    venster.webContents.executeJavaScript(`(() => {
      const kaart = [...document.querySelectorAll(".card")].find((k) =>
        k.querySelector("h3") && k.querySelector("h3").textContent.trim() === "Venster"
      );
      if (!kaart) return null;
      return {
        badge: kaart.querySelector(".badge") ? kaart.querySelector(".badge").textContent.trim() : null,
        tekst: (kaart.innerText || "").replace(/\\s+/g, " ").trim(),
        knoppen: [...kaart.querySelectorAll("button")].map((k) => (k.textContent || "").trim()),
      };
    })()`);

  venster.setSize(1100, 700);
  // De kaart volgt de maat met een korte vertraging; op een drukke machine duurt die soms langer
  // dan de vaste wachttijd. Pollen tot de kaart de nieuwe maat toont, in plaats van gokken.
  let eigen = null;
  for (let poging = 0; poging < 60; poging++) {
    eigen = await vensterKaart();
    if (eigen && eigen.badge === "Eigen maat" && eigen.tekst.includes("1100 × 700")) break;
    await new Promise((klaar) => setTimeout(klaar, 100));
  }
  meld(
    "de kaart laat de eigen maat zien naast de standaardmaat",
    !!eigen &&
      eigen.badge === "Eigen maat" &&
      eigen.tekst.includes("1100 × 700") &&
      eigen.tekst.includes(`${hoort.breedte} × ${hoort.hoogte}`),
    eigen ? eigen.tekst.slice(0, 220) : "geen kaart"
  );

  const verwachtTerug = standaardStand(screen.getDisplayMatching(venster.getBounds()).workArea);
  const geklikt = await venster.webContents.executeJavaScript(`(() => {
    const kaart = [...document.querySelectorAll(".card")].find((k) =>
      k.querySelector("h3") && k.querySelector("h3").textContent.trim() === "Venster"
    );
    const knop = kaart
      ? [...kaart.querySelectorAll("button")].find((k) =>
          (k.textContent || "").includes("Terug naar de standaardmaat")
        )
      : null;
    if (!knop) return false;
    knop.click();
    return true;
  })()`);
  let terug = false;
  for (let poging = 0; poging < 60; poging++) {
    const nu = venster.getBounds();
    if (
      Math.abs(nu.width - verwachtTerug.breedte) <= 2 &&
      Math.abs(nu.height - verwachtTerug.hoogte) <= 2
    ) {
      terug = true;
      break;
    }
    await new Promise((klaar) => setTimeout(klaar, 50));
  }
  meld(
    "de knop zet het venster terug op de standaardmaat",
    geklikt === true && terug,
    `${venster.getBounds().width}×${venster.getBounds().height}, verwacht ${verwachtTerug.breedte}×${verwachtTerug.hoogte}`
  );
  let na = null;
  for (let poging = 0; poging < 40; poging++) {
    na = await vensterKaart();
    if (na && na.badge === "Standaardmaat") break;
    await new Promise((klaar) => setTimeout(klaar, 100));
  }
  meld(
    "na het terugzetten zegt de kaart weer standaardmaat",
    !!na &&
      na.badge === "Standaardmaat" &&
      na.tekst.includes(`${verwachtTerug.breedte} × ${verwachtTerug.hoogte}`),
    na ? `${na.badge}: ${na.tekst.slice(0, 160)}` : "geen kaart"
  );
  const bewaardNa = leesBewaard();
  meld(
    "de teruggezette maat staat ook meteen in de gegevensmap",
    !!bewaardNa &&
      bewaardNa.breedte === verwachtTerug.breedte &&
      bewaardNa.hoogte === verwachtTerug.hoogte,
    bewaardNa ? JSON.stringify(bewaardNa) : "geen bestand"
  );

  // Hetzelfde via het menu, met een sneltoets: eerst weer een eigen maat.
  const menu = Menu.getApplicationMenu();
  const weergave = menu ? menu.items.find((item) => item.label === "Weergave") : null;
  const menuTerug =
    weergave && weergave.submenu
      ? weergave.submenu.items.find((item) => item.id === "venster-terugzetten")
      : null;
  const sneltoets = menuTerug ? menuTerug.accelerator || menuTerug.userAccelerator || "" : "";
  meld(
    "het menu Weergave heeft een item om het venster terug te zetten",
    !!menuTerug && menuTerug.label === "Venstermaat terugzetten",
    menuTerug
      ? menuTerug.label
      : weergave && weergave.submenu
        ? weergave.submenu.items.map((item) => item.label).join(" | ")
        : "geen menu"
  );
  meld(
    "het menu-item noemt de sneltoets",
    /Shift\+0$/.test(sneltoets),
    sneltoets || "(geen sneltoets)"
  );

  venster.setSize(1100, 700);
  await new Promise((klaar) => setTimeout(klaar, 500));
  if (menuTerug) menuTerug.click(menuTerug, venster, {});
  let menuTeruggezet = false;
  for (let poging = 0; poging < 60; poging++) {
    const nu = venster.getBounds();
    if (
      Math.abs(nu.width - verwachtTerug.breedte) <= 2 &&
      Math.abs(nu.height - verwachtTerug.hoogte) <= 2
    ) {
      menuTeruggezet = true;
      break;
    }
    await new Promise((klaar) => setTimeout(klaar, 50));
  }
  meld(
    "het menu-item zet het venster terug op de standaardmaat",
    !!menuTerug && menuTeruggezet,
    `${venster.getBounds().width}×${venster.getBounds().height}, verwacht ${verwachtTerug.breedte}×${verwachtTerug.hoogte}`
  );

  // Ook een gemaximaliseerd venster hoort onthouden te worden, met de normale maat erbij zodat
  // het na het verkleinen weer terug kan naar wat het was.
  const voorMaximaliseren = venster.getNormalBounds();
  venster.maximize();
  await new Promise((klaar) => setTimeout(klaar, 700));
  const maxStand = leesBewaard();
  meld(
    "een gemaximaliseerd venster wordt als zodanig bewaard",
    !!maxStand &&
      maxStand.gemaximaliseerd === true &&
      Math.abs(maxStand.breedte - voorMaximaliseren.width) <= 2 &&
      Math.abs(maxStand.hoogte - voorMaximaliseren.height) <= 2,
    maxStand ? JSON.stringify(maxStand) : "geen bestand"
  );
  venster.unmaximize();
  await new Promise((klaar) => setTimeout(klaar, 700));
  const normaalStand = leesBewaard();
  meld(
    "na het verkleinen wordt de normale maat weer bewaard",
    !!normaalStand &&
      normaalStand.gemaximaliseerd === false &&
      Math.abs(normaalStand.breedte - voorMaximaliseren.width) <= 2,
    normaalStand ? JSON.stringify(normaalStand) : "geen bestand"
  );

  // De app eindigt met een eigen maat en plek, en gemaximaliseerd. scripts/test-btw.mjs start de
  // app daarna nog een paar keer in dezelfde gegevensmap: eerst moet hij gemaximaliseerd opengaan
  // met die normale maat bewaard, daarna (na verkleinen) op precies die maat en plek. De maat
  // blijft binnen het werkvlak: op een kleine CI-runner zou de app een te groot venster bij de
  // volgende start terecht weer inkrimpen, en dan klopt de bewaarde maat niet meer.
  const eindVlak = screen.getDisplayMatching(venster.getBounds()).workArea;
  const eindBreedte = Math.min(1180, eindVlak.width);
  const eindHoogte = Math.min(720, eindVlak.height);
  venster.setPosition(
    Math.max(eindVlak.x, Math.min(120, eindVlak.x + eindVlak.width - eindBreedte)),
    Math.max(eindVlak.y, Math.min(90, eindVlak.y + eindVlak.height - eindHoogte))
  );
  venster.setSize(eindBreedte, eindHoogte);
  await new Promise((klaar) => setTimeout(klaar, 700));
  venster.maximize();
  await new Promise((klaar) => setTimeout(klaar, 700));

  return { naam: "Venster", uitslagen: uitslagen };
}

// De opslag leegmaken (en eventueel vullen) en de pagina opnieuw laden, zodat elk geval met
// dezelfde schone situatie begint.
async function herlaadMet(venster, start) {
  const script = start
    ? `localStorage.clear(); localStorage.setItem(${JSON.stringify(OPSLAGSLEUTEL)}, ${JSON.stringify(
        JSON.stringify(start)
      )});`
    : "localStorage.clear();";
  await venster.webContents.executeJavaScript(script);
  const geladen = new Promise((klaar) => venster.webContents.once("did-finish-load", klaar));
  venster.webContents.reload();
  await geladen;
}

async function btwTest(venster, consoleFouten = [], hoofdprocesFouten = []) {
  const gevallen = [];
  const toon = (naam, uitslagen) => {
    const mis = uitslagen.filter((controle) => !controle.ok);
    console.log(`BTW ${naam}: ${uitslagen.length - mis.length}/${uitslagen.length} goed`);
    for (const controle of mis) {
      console.error(`  GEZAKT ${controle.naam}${controle.detail ? ` → ${controle.detail}` : ""}`);
    }
  };
  try {
    await new Promise((klaar) => venster.webContents.once("did-finish-load", klaar));
    for (const geval of GEVALLEN) {
      await herlaadMet(venster, geval.start);
      const uitslag = await venster.webContents.executeJavaScript(geval.bron(geval.testgeval));
      if (geval.print) {
        // De laatste aanmaning hoort op één A4 te passen. Dit gebruikt dezelfde weg als de
        // knop in de app: printen met de vaste A4-opties en het resultaat als bestand schrijven.
        const doel = path.join(app.getPath("temp"), `helder-brief-${Date.now()}`);
        let geschreven = "";
        try {
          geschreven = await schrijfBriefPdf(venster, doel);
          const pdf = readFileSync(geschreven);
          const paginas = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
          // De knop moet dezelfde vaste A4-maat geven als Print / PDF, ook als het venster
          // groot of klein staat. MediaBox staat in punten: A4 is 595,28 × 841,89.
          const box = pdf
            .toString("latin1")
            .match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
          const breedte = box ? Number(box[3]) - Number(box[1]) : 0;
          const hoogte = box ? Number(box[4]) - Number(box[2]) : 0;
          uitslag.uitslagen.push({
            naam: "de laatste aanmaning past op één A4",
            ok: paginas === 1,
            detail: `${paginas} pagina${paginas === 1 ? "" : "'s"}`,
          });
          uitslag.uitslagen.push({
            naam: "de PDF heeft het vaste A4-formaat",
            ok: Math.abs(breedte - 595.28) < 2 && Math.abs(hoogte - 841.89) < 2,
            detail: box ? `${breedte.toFixed(2)}×${hoogte.toFixed(2)} pt` : "geen MediaBox",
          });
          uitslag.uitslagen.push({
            naam: "de PDF wordt als .pdf-bestand opgeslagen",
            ok: /\.pdf$/i.test(geschreven) && pdf.length > 0,
            detail: `${path.basename(geschreven)} · ${pdf.length} bytes`,
          });
        } catch (fout) {
          uitslag.uitslagen.push({
            naam: "de laatste aanmaning wordt als PDF opgeslagen",
            ok: false,
            detail: fout instanceof Error ? fout.message : String(fout),
          });
        } finally {
          if (geschreven) rmSync(geschreven, { force: true });
        }

        // De knop in de app zelf: de pagina vraagt het hoofdproces om de brief op te slaan, dat
        // opent de bestandskeuze en schrijft de PDF. Voor de test vervangen we alleen die keuze,
        // zodat er geen venster nodig is; de knop, de brug en het schrijven blijven de echte weg.
        const knopDoel = path.join(app.getPath("temp"), `helder-knop-${Date.now()}.pdf`);
        const origineleOpslag = dialog.showSaveDialog;
        let dialoogAanroepen = 0;
        let geklikt = false;
        dialog.showSaveDialog = async () => {
          dialoogAanroepen++;
          return { canceled: false, filePath: knopDoel };
        };
        try {
          const uitslagVanKlik = await venster.webContents.executeJavaScript(`(async () => {
            const knop = [...document.querySelectorAll("button")].find((k) =>
              (k.textContent || "").includes("PDF opslaan")
            );
            if (!knop) return { geklikt: false };
            knop.click();
            return { geklikt: true };
          })()`);
          geklikt = !!uitslagVanKlik?.geklikt;
          const einde = Date.now() + 10000;
          while (!existsSync(knopDoel) && Date.now() < einde) {
            await new Promise((klaar) => setTimeout(klaar, 100));
          }
          const pdf = existsSync(knopDoel) ? readFileSync(knopDoel) : Buffer.alloc(0);
          const paginas = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
          uitslag.uitslagen.push({
            naam: "de knop PDF opslaan schrijft de brief zonder printdialoog",
            ok:
              geklikt &&
              dialoogAanroepen === 1 &&
              pdf.subarray(0, 5).toString() === "%PDF-" &&
              paginas === 1,
            detail: `${geklikt ? "geklikt" : "geen knop"} · opslagkeuze ${dialoogAanroepen}× · ${paginas} pagina${paginas === 1 ? "" : "'s"} · ${pdf.length} bytes`,
          });
        } catch (fout) {
          uitslag.uitslagen.push({
            naam: "de knop PDF opslaan schrijft de brief zonder printdialoog",
            ok: false,
            detail: fout instanceof Error ? fout.message : String(fout),
          });
        } finally {
          dialog.showSaveDialog = origineleOpslag;
          rmSync(knopDoel, { force: true });
        }
      }
      gevallen.push({ naam: geval.naam, uitslagen: uitslag.uitslagen });
    }

    // Een stille fout in de app — een React-fout in de pagina, een uitzondering, een afgewezen
    // belofte — is precies wat de andere controles missen: die kijken naar tekst en opslag, niet
    // naar de console. Dit lezen we bewust vóór we zelf iets melden, want onze eigen GEZAKT-regels
    // gaan ook naar console.error en zouden anders als fout van de app meetellen. De app zelf
    // schrijft niets naar de console en heeft geen externe bronnen, dus dit oordeel hangt niet af
    // van internet of van de machine waarop de test draait.
    gevallen.push(
      foutGeval("Consolefouten", "geen foutmeldingen in de console van de app", consoleFouten)
    );
    gevallen.push(
      foutGeval("Hoofdprocesfouten", "geen foutmeldingen in het hoofdproces", hoofdprocesFouten)
    );

    // Pas hierna, als de fouten van de app zelf al geteld zijn, laat de test een fout met opzet
    // ontstaan: die hoort in het logboek te belanden en niet als fout van de app te gelden.
    gevallen.push(await foutenlogGeval(venster));
    gevallen.push(await vensterGeval(venster));
    gevallen.push(await backupGeval(venster));

    for (const deel of gevallen) toon(deel.naam, deel.uitslagen);

    const aantal = gevallen.reduce((som, deel) => som + deel.uitslagen.length, 0);
    const gezakt = gevallen.flatMap((deel) =>
      deel.uitslagen
        .filter((controle) => !controle.ok)
        .map((controle) => `${deel.naam}: ${controle.naam}${controle.detail ? ` → ${controle.detail}` : ""}`)
    );
    const verslag = JSON.stringify(
      {
        versie: app.getVersion(),
        controles: aantal,
        gezakt: gezakt,
        gevallen: gevallen,
        consoleFouten: consoleFouten,
      },
      null,
      2
    );
    if (process.env.HELDER_SMOKE_FILE) await writeFile(process.env.HELDER_SMOKE_FILE, verslag);
    console.log(`BTW-UITSLAG ${aantal - gezakt.length} van ${aantal} controles goed`);
    if (gezakt.length > 0) {
      console.error(`BTW-GEZAKT ${gezakt.join(" | ")}`);
      app.exit(1);
      return;
    }
    app.exit(0);
  } catch (fout) {
    const bericht = `BTW-FOUT ${fout && fout.stack ? fout.stack : fout}`;
    if (process.env.HELDER_SMOKE_FILE) {
      await writeFile(process.env.HELDER_SMOKE_FILE, bericht).catch(() => {});
    }
    console.error(bericht);
    app.exit(1);
  }
}

/**
 * De automatische back-up, in de echte app: de pagina stuurt de administratie via de brug naar het
 * hoofdproces, dat hem in de gegevensmap schrijft. Deze test draait met een eigen gegevensmap
 * (scripts/test-btw.mjs geeft --user-data-dir mee), dus de administratie van de gebruiker blijft
 * buiten schot.
 */
async function backupGeval(venster) {
  return venster.webContents.executeJavaScript(`new Promise(async (klaar) => {
    const uitslagen = [];
    const meld = (naam, ok, detail) =>
      uitslagen.push({ naam: naam, ok: !!ok, detail: detail === undefined ? "" : String(detail) });
    const brug = window.helder;

    meld("de pagina kan een back-up laten schrijven", !!brug && typeof brug.schrijfBackup === "function");

    // De app schrijft meteen na het starten een kopie; die moet er dus al staan voordat deze
    // controle iets doet.
    const stand = await brug.backupStatus();
    meld(
      "de app heeft na het starten al een kopie geschreven",
      !!(stand && stand.laatste),
      stand && stand.laatste
        ? stand.laatste.naam + " · " + stand.laatste.bytes + " bytes"
        : "geen back-up gevonden"
    );

    const uitslag = await brug.schrijfBackup(JSON.stringify({ test: true }));
    meld(
      "het antwoord wijst naar een bestand in de back-upmap",
      !!(uitslag && typeof uitslag.pad === "string" && uitslag.pad.includes("back-ups")),
      uitslag ? uitslag.pad : "geen antwoord"
    );

    location.hash = "#/instellingen";
    await new Promise((gedaan) => setTimeout(gedaan, 600));
    meld(
      "Instellingen laat zien wanneer de laatste back-up is gemaakt",
      /Automatische back-up: (laatst|nog geen)/.test(document.body.innerText),
      (document.body.innerText.match(/Automatische back-up[^\\n]*/) || [""])[0]
    );
    klaar({ naam: "Automatische back-up", uitslagen: uitslagen });
  })`);
}

module.exports = { btwTest, GEVALLEN, BTW_NUMMER };
