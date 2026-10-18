// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// De versiegeschiedenis, rechtstreeks uit CHANGELOG.md. Zo staat er één lijst in de repo:
// de bouw zet de notities van de huidige versie in latest.yml (voor de update-kaart) en de
// app leest hetzelfde bestand voor het overzicht van alle versies. Het leeswerk zelf staat
// in changelog-parse.ts, zodat de releasetest precies dezelfde regel kan controleren.
import ruwBestand from "../CHANGELOG.md?raw";
import { leesVersies, type ChangelogRegel } from "./changelog-parse";

export type { ChangelogRegel };

export function leesChangelog(tekst: string): ChangelogRegel[] {
  return leesVersies(tekst);
}

export const CHANGELOG: ChangelogRegel[] = leesChangelog(ruwBestand);

export function changelogVoor(versie: string | null | undefined): ChangelogRegel | null {
  if (!versie) return null;
  return CHANGELOG.find((regel) => regel.versie === versie) ?? null;
}
