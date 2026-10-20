// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// De laatste aanmaning als PDF vastleggen. De opmaak komt uit de printstijl van de pagina;
// hier staan alleen de vaste A4-keuzes en het schrijven. Zo gebruikt de knop in de app
// dezelfde weg als de test, zonder de dialoog van het systeem na te bootsen.
const { writeFile } = require("node:fs/promises");
const path = require("node:path");

const PDF_OPTIES = {
  pageSize: "A4",
  printBackground: true,
  preferCSSPageSize: true,
};

function metPdfExtensie(pad) {
  const tekst = String(pad || "");
  return /\.pdf$/i.test(tekst) ? tekst : `${tekst}.pdf`;
}

async function schrijfBriefPdf(venster, pad) {
  if (!venster || venster.isDestroyed()) {
    throw new Error("Geen venster om de brief uit te printen.");
  }
  const doel = metPdfExtensie(path.normalize(pad));
  const pdf = await venster.webContents.printToPDF(PDF_OPTIES);
  await writeFile(doel, pdf);
  return doel;
}

module.exports = { schrijfBriefPdf, metPdfExtensie, PDF_OPTIES };
