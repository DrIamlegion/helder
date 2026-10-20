// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import qrcode from "qrcode-generator";

// Vier modules stilte rondom, zoals de QR-standaard voorschrijft, en vier beeldpunten per
// module. Bij 48 mm op papier is dat ruim 300 dpi; groter maken maakt de afbeelding alleen
// zwaarder zonder dat de printer er meer van kan maken.
const QUIET_ZONE = 4;
const MODULE_PIXELS = 4;

/**
 * Maakt een PNG-data-URL van een QR-code. We proberen M en L en kiezen de variant met de
 * minste modules: die heeft de grootste vierkantjes en is op papier het best te scannen.
 * Bij een gelijk aantal modules wint M, want dat corrigeert meer fouten. Geeft een lege
 * string terug als de tekst zelfs voor L te lang is of als er geen canvas is.
 */
export function maakQrCode(tekst: string): string {
  if (!tekst || typeof document === "undefined") return "";

  let beste: { code: ReturnType<typeof qrcode>; niveau: "M" | "L" } | null = null;
  for (const niveau of ["M", "L"] as const) {
    try {
      const code = qrcode(0, niveau);
      code.addData(tekst, "Byte");
      code.make();
      if (
        !beste ||
        code.getModuleCount() < beste.code.getModuleCount() ||
        (code.getModuleCount() === beste.code.getModuleCount() && niveau === "M")
      ) {
        beste = { code, niveau };
      }
    } catch {
      // Te veel gegevens voor dit foutcorrectieniveau; L heeft de grootste capaciteit.
    }
  }
  if (!beste) return "";

  const modules = beste.code.getModuleCount();
  const zijde = (modules + QUIET_ZONE * 2) * MODULE_PIXELS;
  const canvas = document.createElement("canvas");
  canvas.width = zijde;
  canvas.height = zijde;
  const teken = canvas.getContext("2d");
  if (!teken) return "";
  teken.fillStyle = "#fff";
  teken.fillRect(0, 0, zijde, zijde);
  teken.fillStyle = "#000";
  for (let rij = 0; rij < modules; rij++) {
    for (let kolom = 0; kolom < modules; kolom++) {
      if (!beste.code.isDark(rij, kolom)) continue;
      teken.fillRect(
        (kolom + QUIET_ZONE) * MODULE_PIXELS,
        (rij + QUIET_ZONE) * MODULE_PIXELS,
        MODULE_PIXELS,
        MODULE_PIXELS
      );
    }
  }
  return canvas.toDataURL("image/png");
}
