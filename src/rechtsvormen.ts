// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Eén lijst voor de wizard en Instellingen, zodat dezelfde rechtsvorm overal dezelfde naam heeft.
export const RECHTSVORMEN = [
  "Eenmanszaak",
  "Zzp",
  "Vennootschap onder firma (VOF)",
  "Commanditaire vennootschap (CV)",
  "Besloten vennootschap (BV)",
  "Stichting",
  "Vereniging",
  "Anders",
];

// Een vereniging of stichting is in principe niet btw-plichtig en heeft dan ook geen
// btw-nummer. Ze kan het wél zijn (kantine, webwinkel, diensten), dus het veld blijft
// bereikbaar — alleen niet standaard in beeld.
export function zonderBtwNummer(rechtsvorm: string): boolean {
  const vorm = rechtsvorm.trim().toLowerCase();
  return vorm === "stichting" || vorm === "vereniging";
}

// Voor een select: de huidige waarde blijft zichtbaar, ook als die van een oudere versie komt
// (bijvoorbeeld "B.V." of "VOF").
export function rechtsvormOpties(huidig: string): string[] {
  const waarde = huidig.trim();
  if (!waarde || RECHTSVORMEN.includes(waarde)) return RECHTSVORMEN;
  return [waarde, ...RECHTSVORMEN];
}
