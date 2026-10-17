// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// De versiegeschiedenis, rechtstreeks uit CHANGELOG.md. Zo staat er één lijst in de repo:
// de bouw zet de notities van de huidige versie in latest.yml (voor de update-kaart) en de
// app leest hetzelfde bestand voor het overzicht van alle versies.
import ruwBestand from "../CHANGELOG.md?raw";

export interface ChangelogRegel {
  versie: string;
  datum: string;
  punten: string[];
}

export function leesChangelog(tekst: string): ChangelogRegel[] {
  const blokken = tekst.replace(/\r\n/g, "\n").split(/^## /m).slice(1);
  return blokken.map((blok) => {
    const [kop, ...rest] = blok.split("\n");
    const [versie, ...datumDelen] = kop.split("—");
    return {
      versie: versie.trim(),
      datum: datumDelen.join("—").trim(),
      punten: rest
        .map((regel) => regel.trim())
        .filter((regel) => /^[-*]\s+/.test(regel))
        .map((regel) => regel.replace(/^[-*]\s+/, "")),
    };
  });
}

export const CHANGELOG: ChangelogRegel[] = leesChangelog(ruwBestand);

export function changelogVoor(versie: string | null | undefined): ChangelogRegel | null {
  if (!versie) return null;
  return CHANGELOG.find((regel) => regel.versie === versie) ?? null;
}
