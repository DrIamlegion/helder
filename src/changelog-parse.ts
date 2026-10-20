// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Het lezen van CHANGELOG.md, zonder React en zonder bestandssysteem: zo kan de app het
// gebruiken én kan de test in scripts/ dezelfde functie draaien. Eén regel geldt overal:
// een punt mag in de changelog over meerdere regels doorlopen, en die regels horen bij
// hetzelfde punt.

export interface ChangelogRegel {
  versie: string;
  datum: string;
  punten: string[];
}

export function leesVersies(tekst: string): ChangelogRegel[] {
  const blokken = String(tekst || "")
    .replace(/\r\n/g, "\n")
    .split(/^## /m)
    .slice(1);
  return blokken.map((blok) => {
    const [kop, ...rest] = blok.split("\n");
    const [versie, ...datumDelen] = kop.split("—");
    return {
      versie: versie.trim(),
      datum: datumDelen.join("—").trim(),
      punten: puntenUitRegels(rest),
    };
  });
}

/**
 * De punten uit de regels onder een versiekop. Een regel die met een streepje begint opent een
 * nieuw punt; elke volgende regel hoort bij het punt hierboven en wordt er met een spatie aan
 * vastgeplakt. Zonder dat zou de versiegeschiedenis elk punt midden in een zin afkappen.
 */
export function puntenUitRegels(regels: string[]): string[] {
  const punten: string[] = [];
  let huidig: string | null = null;
  for (const ruweRegel of regels) {
    const regel = ruweRegel.trim();
    if (!regel) continue;
    const nieuwPunt = regel.match(/^[-*]\s+(.*)$/);
    if (nieuwPunt) {
      if (huidig !== null) punten.push(huidig);
      huidig = nieuwPunt[1].trim();
    } else if (huidig !== null) {
      huidig = `${huidig} ${regel}`.replace(/\s+/g, " ").trim();
    }
  }
  if (huidig !== null) punten.push(huidig);
  return punten;
}
