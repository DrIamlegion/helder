// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// De brug naar de desktop-app. Alleen de geïnstalleerde app heeft een hoofdproces dat
// updates kan ophalen en installeren; in de browser bestaat deze brug niet en laten we
// de update-kaart gewoon weg.
import { useEffect, useRef, useState } from "react";
import type { AppState } from "./types";

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

/** Wat het hoofdproces over het foutenlogboek kwijt wil; zie electron/foutenlog.cjs. */
export interface Foutenlog {
  pad: string;
  bestaat: boolean;
  /** Aantal vastgelegde fouten, voor de badge in Instellingen. */
  aantal: number;
  /** De leesbare inhoud; bij een groot logboek alleen de nieuwste regels. */
  inhoud: string;
  afgekapt: boolean;
}

export interface KopieerUitslag {
  gekopieerd: boolean;
  aantal: number;
  pad: string;
  tekens: number;
}

/**
 * De gegevens die een eenmalige tip meekrijgt. Elke tip leest zelf wat hij nodig heeft; de tekst
 * en de boekhouding staan in src/tips.ts.
 */
export type TipGegevens = Record<string, string | number | boolean | undefined>;

/** Een eenmalige tip uit het hoofdproces: welk onderwerp, met welke gegevens. */
export interface TipMelding {
  id: string;
  gegevens?: TipGegevens;
}

/** De uitkomst van een PDF-opslag: het pad alleen als het bestand echt geschreven is. */
export interface PdfOpslag {
  opgeslagen: boolean;
  pad: string | null;
  fout: string;
}

/** Wat er in de back-upmap staat; zie electron/back-up.cjs. */
export interface BackupStand {
  map: string;
  aantal: number;
  laatste: {
    naam: string;
    pad: string;
    datum: string;
    bytes: number;
    geschrevenOp: string;
  } | null;
}

/** De uitkomst van één automatische back-up. */
export interface BackupUitslag {
  geschreven: boolean;
  overgeslagen: boolean;
  pad: string;
  opgeruimd: string[];
}

/** Het resultaat van "laat de back-upmap zien". */
export interface BackupMapOpenen {
  geopend: boolean;
  pad: string;
  fout: string;
}

/** De maat van het venster, en de standaardmaat die bij het huidige scherm hoort. */
export interface Vensterstand {
  breedte: number;
  hoogte: number;
  standaard: { breedte: number; hoogte: number };
  /** Of het venster een andere maat heeft dan de standaardmaat van dit scherm. */
  aangepast: boolean;
}

interface HelderBrug {
  desktop: true;
  updateStatus: () => Promise<UpdateStatus>;
  checkForUpdates: () => Promise<UpdateStatus>;
  installUpdate: () => Promise<UpdateStatus>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  leesFoutenlog: () => Promise<Foutenlog>;
  kopieerFoutenlog: () => Promise<KopieerUitslag>;
  /** De tips die vóór het tipsysteem al gezien waren; het hoofdproces ruimt de oude markering op. */
  neemTipsOver: () => Promise<string[]>;
  vensterStand: () => Promise<Vensterstand | null>;
  vensterTerugzetten: () => Promise<Vensterstand | null>;
  /** De huidige brief als vaste A4-PDF opslaan; de systeem-printdialoog komt er niet aan te pas. */
  opslaanBriefPdf: (naam: string) => Promise<PdfOpslag>;
  /** De administratie als JSON naar de back-upmap schrijven; het hoofdproces beslist of dat nu nodig is. */
  schrijfBackup: (inhoud: string) => Promise<BackupUitslag>;
  backupStatus: () => Promise<BackupStand>;
  openBackUpMap: () => Promise<BackupMapOpenen>;
  onTip: (callback: (melding: TipMelding | null) => void) => () => void;
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

/**
 * Laat het hoofdproces de huidige pagina als vaste A4-PDF opslaan. De renderer kiest geen pad:
 * het hoofdproces opent de systeemopslag en schrijft pas daarna. Zo werkt de knop ook in de
 * browserbuild gewoon niet, zonder een half bestand achter te laten.
 */
export async function bewaarBriefAlsPdf(naam: string): Promise<PdfOpslag> {
  const brug = desktopBrug();
  if (!brug) {
    return { opgeslagen: false, pad: null, fout: "PDF opslaan werkt alleen in de desktop-app." };
  }
  try {
    return await brug.opslaanBriefPdf(naam);
  } catch {
    return { opgeslagen: false, pad: null, fout: "Het hoofdproces gaf geen antwoord." };
  }
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

/**
 * Het foutenlogboek van de desktop-app, voor Instellingen. In de browser bestaat er geen
 * hoofdproces en dus geen logboek; `beschikbaar` is daar false en de kaart blijft weg.
 */
export function useFoutenlog() {
  const [brug] = useState(desktopBrug);
  const [log, setLog] = useState<Foutenlog | null>(null);
  const [mislukt, setMislukt] = useState(false);

  useEffect(() => {
    if (!brug) return;
    let actief = true;
    brug
      .leesFoutenlog()
      .then((gelezen) => {
        if (actief) setLog(gelezen);
      })
      .catch(() => {
        if (actief) setMislukt(true);
      });
    return () => {
      actief = false;
    };
  }, [brug]);

  /** Kopieert het hele logboek plus een kop met versie en systeem; true als het op het klembord staat. */
  async function kopieer(): Promise<boolean> {
    if (!brug) return false;
    try {
      const uitslag = await brug.kopieerFoutenlog();
      if (uitslag.gekopieerd) {
        setLog((huidig) =>
          huidig ? { ...huidig, aantal: uitslag.aantal, pad: uitslag.pad } : huidig
        );
      }
      return uitslag.gekopieerd;
    } catch {
      return false;
    }
  }

  return { beschikbaar: !!brug, log, mislukt, kopieer };
}

/**
 * De maat van het venster, voor Instellingen. Het hoofdproces onthoudt de maat en de plek al bij
 * het schalen en verplaatsen; hier alleen de stand op het scherm, plus de knop om terug te gaan
 * naar de standaardmaat.
 */
export function useVensterstand() {
  const [brug] = useState(desktopBrug);
  const [stand, setStand] = useState<Vensterstand | null>(null);

  useEffect(() => {
    if (!brug) return;
    let actief = true;
    let timer: number | undefined;
    const lees = () => {
      brug
        .vensterStand()
        .then((nieuw) => {
          if (actief && nieuw) setStand(nieuw);
        })
        .catch(() => {
          // Geen antwoord van het hoofdproces: dan blijft de kaart weg.
        });
    };
    lees();
    // Zolang de kaart openstaat, meeschalen met het venster (met een korte vertraging, want een
    // resize geeft tientallen gebeurtenissen per seconde).
    const bijMaat = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lees, 250);
    };
    window.addEventListener("resize", bijMaat);
    return () => {
      actief = false;
      window.clearTimeout(timer);
      window.removeEventListener("resize", bijMaat);
    };
  }, [brug]);

  /** Zet het venster terug op de standaardmaat; true als dat gelukt is. */
  async function terugzetten(): Promise<boolean> {
    if (!brug) return false;
    try {
      const nieuw = await brug.vensterTerugzetten();
      if (nieuw) setStand(nieuw);
      return !!nieuw;
    } catch {
      return false;
    }
  }

  return { beschikbaar: !!brug, stand, terugzetten };
}

/**
 * De stand van de automatische back-ups, voor Instellingen: wanneer er voor het laatst een kopie
 * is geschreven, hoeveel er bewaard worden en waar ze staan. De kaart ververst zichzelf elke
 * minuut, zodat een back-up die tijdens het werken ontstaat meteen zichtbaar is.
 */
export function useBackup() {
  const [brug] = useState(desktopBrug);
  const [stand, setStand] = useState<BackupStand | null>(null);

  useEffect(() => {
    if (!brug) return;
    let actief = true;
    const lees = () => {
      brug
        .backupStatus()
        .then((nieuw) => {
          if (actief) setStand(nieuw);
        })
        .catch(() => {
          // Geen antwoord: dan blijft de kaart bij de vorige stand.
        });
    };
    lees();
    const timer = window.setInterval(lees, 60_000);
    return () => {
      actief = false;
      window.clearInterval(timer);
    };
  }, [brug]);

  /** Opent de back-upmap in de bestandsbeheerder; leeg als het gelukt is, anders de melding. */
  async function openMap(): Promise<string> {
    if (!brug) return "";
    try {
      const uitslag = await brug.openBackUpMap();
      return uitslag.geopend ? "" : uitslag.fout || "De map kon niet worden geopend.";
    } catch {
      return "Het hoofdproces gaf geen antwoord.";
    }
  }

  return { beschikbaar: !!brug, stand, openMap };
}

/**
 * Houdt de automatische back-up bij: meteen bij het starten en daarna elke tien minuten. Hoe vaak
 * er echt geschreven wordt bepaalt het hoofdproces: hooguit één keer per uur, en nooit als de
 * inhoud gelijk is. Mislukt een poging, dan merkt de gebruiker daar niets van — de handmatige
 * back-up blijft gewoon bestaan.
 */
export function useAutomatischeBackup(state: AppState) {
  const [brug] = useState(desktopBrug);
  const laatste = useRef(state);
  laatste.current = state;

  useEffect(() => {
    if (!brug) return;
    let actief = true;
    const schrijf = () => {
      if (!actief) return;
      void brug.schrijfBackup(JSON.stringify(laatste.current)).catch(() => {
        // Vangnet, geen functionaliteit: stil doorgaan.
      });
    };
    schrijf();
    const timer = window.setInterval(schrijf, 10 * 60 * 1000);
    return () => {
      actief = false;
      window.clearInterval(timer);
    };
  }, [brug]);
}
