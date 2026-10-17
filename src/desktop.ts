// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// De brug naar de desktop-app. Alleen de geïnstalleerde app heeft een hoofdproces dat
// updates kan ophalen en installeren; in de browser bestaat deze brug niet en laten we
// de update-kaart gewoon weg.
import { useEffect, useState } from "react";

export type UpdateToestand =
  | "onbekend"
  | "controleren"
  | "beschikbaar"
  | "downloaden"
  | "klaar"
  | "actueel"
  | "fout";

export interface UpdateStatus {
  toestand: UpdateToestand;
  huidigeVersie: string;
  versie: string | null;
  percentage: number;
  bericht: string;
  gecontroleerdOp: string | null;
  /** Wat er in de nieuwe versie verandert, uit de notities op het updatekanaal. */
  notities: string | null;
  /** Uitgiftedatum van de nieuwe versie, zoals het kanaal hem meldt. */
  uitgebrachtOp: string | null;
}

interface HelderBrug {
  desktop: true;
  updateStatus: () => Promise<UpdateStatus>;
  checkForUpdates: () => Promise<UpdateStatus>;
  installUpdate: () => Promise<UpdateStatus>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    helder?: HelderBrug;
  }
}

export function desktopBrug(): HelderBrug | null {
  if (typeof window === "undefined") return null;
  return window.helder ?? null;
}

const LEGE_STATUS: UpdateStatus = {
  toestand: "onbekend",
  huidigeVersie: "",
  versie: null,
  percentage: 0,
  bericht: "",
  gecontroleerdOp: null,
  notities: null,
  uitgebrachtOp: null,
};

export function useUpdates() {
  const [brug] = useState(desktopBrug);
  const [status, setStatus] = useState<UpdateStatus>(LEGE_STATUS);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!brug) return;
    let actief = true;
    brug
      .updateStatus()
      .then((huidig) => {
        if (actief) setStatus(huidig);
      })
      .catch(() => {
        // Geen antwoord van het hoofdproces: dan blijft de kaart op "onbekend".
      });
    // Het hoofdproces meldt elke stap (controleren, downloaden, klaar) uit zichzelf.
    const stop = brug.onUpdateStatus((nieuw) => setStatus(nieuw));
    return () => {
      actief = false;
      stop();
    };
  }, [brug]);

  async function controleer() {
    if (!brug) return;
    setBezig(true);
    try {
      setStatus(await brug.checkForUpdates());
    } finally {
      setBezig(false);
    }
  }

  async function installeer() {
    if (!brug) return;
    setStatus(await brug.installUpdate());
  }

  return { beschikbaar: !!brug, status, bezig, controleer, installeer };
}
