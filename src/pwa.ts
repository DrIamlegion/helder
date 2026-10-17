// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Alles wat nodig is om Helder als echte app te draaien: installatie aanbieden,
// onthouden dat de app al geïnstalleerd is, en weten of je online bent.
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export type InstallUitkomst = "geinstalleerd" | "afgewezen" | "niet-beschikbaar";

export interface InstallState {
  kanInstalleren: boolean;
  isGeinstalleerd: boolean;
  afgewezen: boolean;
  installeren: () => Promise<InstallUitkomst>;
}

// Chrome en Edge bieden installatie aan via beforeinstallprompt; Safari doet dat niet,
// daar verwijs je naar het menu. We tonen de knop daarom alleen als het echt kan.
export function useInstall(): InstallState {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [isGeinstalleerd, setIsGeinstalleerd] = useState(isStandalone);
  const [afgewezen, setAfgewezen] = useState(false);

  useEffect(() => {
    function onPrompt(event: Event) {
      // Zonder preventDefault toont de browser zijn eigen balkje in plaats van onze knop.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setIsGeinstalleerd(true);
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installeren(): Promise<InstallUitkomst> {
    if (!prompt) return "niet-beschikbaar";
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // Het prompt-event is eenmalig bruikbaar; daarna is het menu van de browser de weg.
    setPrompt(null);
    if (outcome === "accepted") {
      setIsGeinstalleerd(true);
      return "geinstalleerd";
    }
    setAfgewezen(true);
    return "afgewezen";
  }

  return { kanInstalleren: !!prompt, isGeinstalleerd, afgewezen, installeren };
}

// De service worker zet de app in de cache. Is hij actief, dan werkt Helder zonder internet.
export function useOfflineGereed(): boolean {
  const [gereed, setGereed] = useState(
    () => typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let gestopt = false;
    navigator.serviceWorker.ready
      .then(() => {
        if (!gestopt) setGereed(true);
      })
      .catch(() => {
        // Geen service worker (bijvoorbeeld in een privévenster): niets aan de hand.
      });
    return () => {
      gestopt = true;
    };
  }, []);

  return gereed;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const naarOnline = () => setOnline(true);
    const naarOffline = () => setOnline(false);
    window.addEventListener("online", naarOnline);
    window.addEventListener("offline", naarOffline);
    return () => {
      window.removeEventListener("online", naarOnline);
      window.removeEventListener("offline", naarOffline);
    };
  }, []);

  return online;
}
