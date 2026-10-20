// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// De maat en de plek van het venster. Een vaste 1360×900 past lang niet op elk scherm: op een
// laptop van 1366×768 of een hoog geschaalde 4K-monitor is het werkvlak kleiner, en dan valt de
// onderkant van de app achter de taakbalk of buiten beeld. Daarom rekenen we de standaardmaat uit
// vanaf het werkvlak van het scherm waarop de app opent: nooit groter dan wat er staat, en de
// minimummaat zakt mee zodat het venster op een klein scherm altijd past.
//
// De laatste maat en plek worden bewaard in de gegevensmap, zodat de app de volgende keer op
// dezelfde plek opent. Bij het teruglezen wordt de bewaarde stand langs de aangesloten schermen
// gelegd: een venster van een monitor die er niet meer is, of een maat die intussen te groot is,
// zou anders buiten beeld of achter de taakbalk beginnen. Dan valt de app terug op de standaard.
const fs = require("node:fs");
const path = require("node:path");

const BESTAND = "venster.json";
// Lucht naast het venster, zodat het niet strak tegen de schermrand of de taakbalk plakt.
const RAND = 24;
// De gewenste maat op een ruim scherm; groter heeft de indeling niet nodig.
const BREEDTE = 1360;
const HOOGTE = 900;
// Hieronder klapt de zijbalk in en wordt de indeling smaller; dat mag, maar liever niet onnodig.
const MIN_BREEDTE = 1024;
const MIN_HOOGTE = 680;
// Ondergrens voor het rekenen zelf, voor een werkvlak dat kleiner is dan de app ooit nodig heeft.
const KLEINSTE_BREEDTE = 360;
const KLEINSTE_HOOGTE = 400;

function vensterMaat(werkvlak) {
  const breedte = Math.min(BREEDTE, Math.max(KLEINSTE_BREEDTE, werkvlak.width - RAND * 2));
  const hoogte = Math.min(HOOGTE, Math.max(KLEINSTE_HOOGTE, werkvlak.height - RAND * 2));
  return {
    breedte,
    hoogte,
    // De minimummaat kan niet groter zijn dan het venster zelf, anders zou het scherm het venster
    // alsnog buiten beeld duwen.
    minBreedte: Math.min(MIN_BREEDTE, breedte),
    minHoogte: Math.min(MIN_HOOGTE, hoogte),
  };
}

// De standaardstand: de maat die bij het scherm past, midden op het werkvlak.
function standaardStand(werkvlak) {
  const maat = vensterMaat(werkvlak);
  return {
    x: Math.round(werkvlak.x + (werkvlak.width - maat.breedte) / 2),
    y: Math.round(werkvlak.y + (werkvlak.height - maat.hoogte) / 2),
    breedte: maat.breedte,
    hoogte: maat.hoogte,
    gemaximaliseerd: false,
  };
}

function getal(waarde) {
  return typeof waarde === "number" && Number.isFinite(waarde);
}

// De bewaarde stand langs de aangesloten schermen leggen. Geeft null als er niets bruikbaars staat
// (geen bestand, kapot bestand, of een scherm dat niet meer bestaat); dan kiest de app de standaard.
function pasAanOpScherm(stand, werkvlakken) {
  if (!stand || typeof stand !== "object") return null;
  if (![stand.x, stand.y, stand.breedte, stand.hoogte].every(getal)) return null;
  if (!Array.isArray(werkvlakken) || werkvlakken.length === 0) return null;

  // Het scherm waar het venster het meeste oppervlak mee deelt, is waar het hoort. Zo blijft een
  // venster op de tweede monitor staan als die er nog is.
  let gekozen = null;
  let meeste = 0;
  for (const vlak of werkvlakken) {
    const breedte = Math.max(
      0,
      Math.min(stand.x + stand.breedte, vlak.x + vlak.width) - Math.max(stand.x, vlak.x)
    );
    const hoogte = Math.max(
      0,
      Math.min(stand.y + stand.hoogte, vlak.y + vlak.height) - Math.max(stand.y, vlak.y)
    );
    const oppervlak = breedte * hoogte;
    if (oppervlak > meeste) {
      meeste = oppervlak;
      gekozen = vlak;
    }
  }
  // Niets van het venster valt op een aangesloten scherm: niet terugzetten, maar de standaard nemen.
  if (!gekozen) return null;

  const breedte = Math.min(
    Math.max(stand.breedte, Math.min(MIN_BREEDTE, gekozen.width)),
    gekozen.width
  );
  const hoogte = Math.min(
    Math.max(stand.hoogte, Math.min(MIN_HOOGTE, gekozen.height)),
    gekozen.height
  );
  // En de plek zo schuiven dat het hele venster op dat scherm staat.
  return {
    x: Math.min(Math.max(stand.x, gekozen.x), gekozen.x + gekozen.width - breedte),
    y: Math.min(Math.max(stand.y, gekozen.y), gekozen.y + gekozen.height - hoogte),
    breedte,
    hoogte,
    gemaximaliseerd: stand.gemaximaliseerd === true,
  };
}

function leesVensterstand(map) {
  try {
    const stand = JSON.parse(fs.readFileSync(path.join(map, BESTAND), "utf8"));
    return stand && typeof stand === "object" ? stand : null;
  } catch {
    // Geen bestand, geen leesrechten of geen geldige JSON: gewoon de standaardmaat.
    return null;
  }
}

// Bewaren mag nooit de app laten stuklopen; mislukt het, dan opent de volgende keer de standaard.
function bewaarVensterstand(map, stand) {
  try {
    fs.mkdirSync(map, { recursive: true });
    fs.writeFileSync(
      path.join(map, BESTAND),
      `${JSON.stringify(
        {
          x: Math.round(stand.x),
          y: Math.round(stand.y),
          breedte: Math.round(stand.breedte),
          hoogte: Math.round(stand.hoogte),
          gemaximaliseerd: stand.gemaximaliseerd === true,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  vensterMaat,
  standaardStand,
  pasAanOpScherm,
  leesVensterstand,
  bewaarVensterstand,
};
