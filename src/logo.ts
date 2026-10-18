// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { MAX_PLAN_LOGO_CHARS } from "./planLink";

// De openbare betaalregeling heeft geen server: alles wat de klant ziet, staat in de link.
// Daarom bewaren we naast het originele logo een thumbnail die in de kop van de pagina past:
// een doos van 132 × 36 pixels, met wat extra ruimte voor scherpe schermen. Zodra hij te groot
// wordt voor de link, proberen we een kleinere doos; zo blijft de link bruikbaar in mail en chat.
const KANDIDATEN: Array<[number, number, number]> = [
  [132, 72, 0.82],
  [132, 54, 0.8],
  [132, 40, 0.78],
  [112, 36, 0.72],
  [96, 30, 0.66],
  [64, 20, 0.58],
  [48, 15, 0.5],
];

function laadBeeld(bron: string): Promise<HTMLImageElement | null> {
  return new Promise((klaar) => {
    const beeld = new Image();
    beeld.onload = () => klaar(beeld);
    beeld.onerror = () => klaar(null);
    beeld.src = bron;
  });
}

/**
 * Maakt een kleine WebP (of PNG als WebP niet kan) van een logo-data-URL. Geeft een lege
 * string terug als de bron geen afbeelding is of als zelfs de kleinste variant niet in de
 * link past; de openbare pagina valt dan terug op de initialen.
 */
export async function maakLogoKlein(
  bron: string,
  maxChars = MAX_PLAN_LOGO_CHARS
): Promise<string> {
  if (
    typeof document === "undefined" ||
    !/^data:image\/(png|jpe?g|webp);base64,/.test(bron)
  ) {
    return "";
  }
  const beeld = await laadBeeld(bron);
  if (!beeld) return "";
  const breed = beeld.naturalWidth || beeld.width;
  const hoog = beeld.naturalHeight || beeld.height;
  if (!breed || !hoog) return "";

  try {
    for (const [doosBreed, doosHoog, kwaliteit] of KANDIDATEN) {
      const schaal = Math.min(1, doosBreed / breed, doosHoog / hoog);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(breed * schaal));
      canvas.height = Math.max(1, Math.round(hoog * schaal));
      const teken = canvas.getContext("2d");
      if (!teken) return "";
      teken.imageSmoothingEnabled = true;
      teken.imageSmoothingQuality = "high";
      teken.clearRect(0, 0, canvas.width, canvas.height);
      teken.drawImage(beeld, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/webp", kwaliteit);
      if (!/^data:image\/(webp|png);base64,/.test(data)) continue;
      if (data.length <= maxChars) return data;
    }
  } catch {
    // Een browser zonder canvas of met een geblokkeerde afbeelding: dan maar geen logo in de link.
    return "";
  }
  return "";
}
