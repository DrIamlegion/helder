// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Alle eenmalige tips op één plek: de tekst, de boekhouding van wat al langs is gekomen en het
// luisteren naar tips uit het hoofdproces. Een tip is een korte melding die je maar één keer
// ziet, op het moment dat hij nuttig is — bijvoorbeeld bij het verkleinen van een
// gemaximaliseerd venster.
//
// Een nieuwe tip toevoegen is twee stappen:
//   1. zet hem in TIPS, met de tekst als functie van de gegevens die je meestuurt;
//   2. roep toonTip("jouw-tip", gegevens, toast) aan waar het moment daar is. Gebeurt het moment
//      in het hoofdproces (zoals bij het venster), stuur dan daar een bericht op "helder:tip";
//      de app vangt dat hieronder op.
// Het onthouden, het eenmalige en de tekst staan dus bij elkaar; er is geen apart bestand of
// vlag per tip meer nodig.
import { useEffect, useRef, useState } from "react";
import { desktopBrug, type TipGegevens } from "./desktop";

/**
 * De teksten van de tips, op id. De functie krijgt de gegevens mee die de aanroeper meestuurt,
 * zodat bijvoorbeeld een sneltoets uit het menu kan komen en niet in de tekst kan verouderen.
 */
export const TIPS = {
  "venster-terugzetten": (gegevens: TipGegevens) => {
    const sneltoets = typeof gegevens.sneltoets === "string" ? gegevens.sneltoets : "";
    return sneltoets
      ? `Tip: met ${sneltoets} zet je het venster terug op de standaardmaat`
      : "Tip: via Weergave → Venstermaat terugzetten zet je het venster terug op de standaardmaat";
  },
} as const;

export type TipId = keyof typeof TIPS;

// De ids die de app al heeft laten zien, in de opslag van de app zelf. Zo werkt het ook in de
// browser-versie, en blijft de administratie van de gebruiker erbuiten.
const SLEUTEL = "helder.tips";

function leesGezien(): string[] {
  try {
    const waarde = JSON.parse(localStorage.getItem(SLEUTEL) || "[]");
    return Array.isArray(waarde) ? waarde.filter((id) => typeof id === "string") : [];
  } catch {
    // Een kapotte of onleesbare opslag: dan begint de boekhouding opnieuw. Hooguit komt een tip
    // nog eens langs; dat is beter dan de app laten stuklopen.
    return [];
  }
}

export function isTipGezien(id: TipId): boolean {
  return leesGezien().includes(id);
}

function markeerMeerdereGezien(ids: string[]) {
  const gezien = leesGezien();
  const nieuw = ids.filter((id) => !gezien.includes(id));
  if (nieuw.length === 0) return;
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify([...gezien, ...nieuw]));
  } catch {
    // Zonder schrijfrechten komt de tip misschien nog eens terug; de melding zelf gaat gewoon door.
  }
}

function markeerGezien(id: TipId) {
  markeerMeerdereGezien([id]);
}

/**
 * Toont een tip als hij nog niet eerder langs is gekomen, en onthoudt hem. Geeft terug of de
 * melding is getoond. De tekst komt uit TIPS, zodat elke tip zijn eigen gegevens kan gebruiken.
 */
export function toonTip(
  id: TipId,
  gegevens: TipGegevens,
  toon: (tekst: string) => void
): boolean {
  if (isTipGezien(id)) return false;
  // Eerst onthouden, dan tonen: zo zet een dubbele gebeurtenis (twee keer verkleinen) de tip
  // niet twee keer op het scherm.
  markeerGezien(id);
  toon(TIPS[id](gegevens));
  return true;
}

/**
 * Luistert naar tips uit het hoofdproces, bijvoorbeeld bij iets wat in het venster gebeurt. De
 * app roept dit één keer aan, naast de meldingen. Een tip die deze versie niet kent (van een
 * nieuwer hoofdproces) wordt stil overgeslagen.
 */
export function useTips(toon: (tekst: string) => void) {
  const [brug] = useState(desktopBrug);
  const bewaar = useRef(toon);
  bewaar.current = toon;

  useEffect(() => {
    if (!brug) return;
    let actief = true;
    const stop = brug.onTip((melding) => {
      if (!melding || !(melding.id in TIPS)) return;
      toonTip(
        melding.id as TipId,
        melding.gegevens ?? {},
        (tekst) => bewaar.current(tekst)
      );
    });
    // De markering van vóór dit tipsysteem (venster-tip.json) één keer overnemen, zodat een
    // bestaande installatie de venstertip niet opnieuw ziet. Het hoofdproces leest en verwijdert
    // dat bestand; hier komt de tip in dezelfde boekhouding terecht.
    brug
      .neemTipsOver()
      .then((ids) => {
        if (!actief || !Array.isArray(ids)) return;
        markeerMeerdereGezien(ids.filter((id): id is TipId => id in TIPS));
      })
      .catch(() => {
        // Geen antwoord van het hoofdproces: dan blijft alleen de oude markering liggen.
      });
    return () => {
      actief = false;
      stop();
    };
  }, [brug]);
}
