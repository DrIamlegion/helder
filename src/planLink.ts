// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import type { Company, PaymentPlan } from "./types";

// De app heeft geen server: de deelbare link draagt de afspraak zelf mee en de klant
// stuurt zijn akkoord terug als bevestigingscode. Zo werkt het ook zonder backend.
export const PLAN_LINK_VERSION = 1;
const ACCEPTANCE_PREFIX = "AKK1-";
// Een deellink gaat door e-mail, chat en de prullenbak van de klant. Het logo reist mee als
// compacte thumbnail, nooit als het originele bestand: zo blijft de link behapbaar.
export const MAX_PLAN_LOGO_CHARS = 1400;
const MAX_PLAN_LINK_CHARS = 6000;
const PLAN_LOGO_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

export interface PlanLinkCompany {
  naam: string;
  email: string;
  iban: string;
  telefoon: string;
  // Alleen de kleine variant uit Company.logoKlein, en alleen als die binnen de grens past.
  logo?: string;
}

// Alleen een echte, kleine afbeeldingsdata-URL komt in de link terecht. Zo kan een bewerkte
// administratie of back-up geen externe afbeelding of een megagroot logo meesturen.
export function normalisePlanLogo(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  return PLAN_LOGO_PATTERN.test(value) && value.length <= MAX_PLAN_LOGO_CHARS ? value : "";
}

export interface PlanLinkData {
  v: number;
  planId: string;
  nummer: string;
  klant: string;
  bedrijf: PlanLinkCompany;
  termijnen: number;
  totaal: number;
  bedragPerTermijn: number;
  intervalDagen: number;
  eersteTermijn: string;
  // Hosted betaallink (Mollie, Stripe, bank) voor de eerste termijn; optioneel.
  betaalLink?: string;
}

export interface PlanAcceptance {
  planId: string;
  acceptedAt: string;
  fingerprint: string;
}

type FingerprintSource = Pick<
  PaymentPlan,
  "id" | "termijnen" | "totaal" | "intervalDagen" | "eersteTermijn"
>;

type PaymentLinkSource = FingerprintSource & Pick<PaymentPlan, "bedragPerTermijn" | "betaalLink">;

// Alleen echte https-betaallinks; http mag alleen op loopback, zodat een testlink lokaal werkt.
export function normalisePaymentLink(raw: string | undefined): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const loopback =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !loopback) return null;
  if (!loopback && !url.hostname.includes(".")) return null;
  return url.toString();
}

// “payment-links.mollie.com” — genoeg om de klant te laten zien waar hij betaalt.
export function paymentLinkHost(link: string | undefined): string {
  const normalised = normalisePaymentLink(link);
  if (!normalised) return "";
  return new URL(normalised).hostname.replace(/^www\./, "");
}

// base64url zonder afhankelijkheden; TextEncoder/TextDecoder houden accenten intact.
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): string {
  const normal = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// FNV-1a: klein, deterministisch en genoeg om een gekopieerde of verkeerde code te herkennen.
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function planFingerprint(plan: FingerprintSource): string {
  const canonical = [
    plan.id,
    plan.termijnen,
    Math.round(Number(plan.totaal) * 100),
    plan.intervalDagen,
    plan.eersteTermijn,
  ].join("|");
  return fnv1a(canonical) + fnv1a(`${canonical}|helder`);
}

function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export function planLinkData(
  plan: PaymentLinkSource,
  invoice: { nummer: string },
  klantNaam: string,
  bedrijf: Company
): PlanLinkData {
  const betaalLink = normalisePaymentLink(plan.betaalLink);
  const logo = normalisePlanLogo(bedrijf.logoKlein);
  return {
    v: PLAN_LINK_VERSION,
    planId: plan.id,
    nummer: invoice.nummer,
    klant: klantNaam,
    bedrijf: {
      naam: bedrijf.naam,
      email: bedrijf.email,
      iban: bedrijf.iban,
      telefoon: bedrijf.telefoon,
      ...(logo ? { logo } : {}),
    },
    termijnen: plan.termijnen,
    totaal: plan.totaal,
    bedragPerTermijn: plan.bedragPerTermijn,
    intervalDagen: plan.intervalDagen,
    eersteTermijn: plan.eersteTermijn,
    betaalLink: betaalLink ?? undefined,
  };
}

export function encodePlanLink(data: PlanLinkData): string {
  return toBase64Url(JSON.stringify(data));
}

export function decodePlanLink(token: string | undefined): PlanLinkData | null {
  if (!token || token.length > MAX_PLAN_LINK_CHARS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const data = parsed as Partial<PlanLinkData>;
  const bedrijf = data.bedrijf as Partial<PlanLinkCompany> | undefined;
  const geldig =
    data.v === PLAN_LINK_VERSION &&
    typeof data.planId === "string" &&
    data.planId.length > 0 &&
    typeof data.nummer === "string" &&
    typeof data.klant === "string" &&
    !!bedrijf &&
    typeof bedrijf.naam === "string" &&
    typeof bedrijf.email === "string" &&
    typeof data.termijnen === "number" &&
    data.termijnen >= 2 &&
    data.termijnen <= 12 &&
    typeof data.totaal === "number" &&
    data.totaal > 0 &&
    typeof data.bedragPerTermijn === "number" &&
    data.bedragPerTermijn > 0 &&
    typeof data.intervalDagen === "number" &&
    data.intervalDagen > 0 &&
    isISODate(data.eersteTermijn);
  if (!geldig) return null;
  const logo = normalisePlanLogo(bedrijf!.logo);
  return {
    ...(data as PlanLinkData),
    bedrijf: {
      naam: bedrijf!.naam!,
      email: bedrijf!.email!,
      iban: bedrijf!.iban || "",
      telefoon: bedrijf!.telefoon || "",
      ...(logo ? { logo } : {}),
    },
    // Een ongeldige of vreemde betaallink negeren we; de klant kan altijd nog overmaken.
    betaalLink: normalisePaymentLink(data.betaalLink) ?? undefined,
  };
}

export function planAcceptPath(data: PlanLinkData): string {
  return `/regeling/${encodePlanLink(data)}`;
}

// Deelbare URL op de origin waar Helder draait; werkt ook achter een subpad.
export function planShareUrl(data: PlanLinkData): string {
  const base = window.location.href.split("#")[0];
  return `${base}#${planAcceptPath(data)}`;
}

// Het akkoord dat de klant terugstuurt: plan, tijdstip en vingerafdruk van de termijnen.
export function buildAcceptance(plan: FingerprintSource, acceptedAt: string): string {
  const acceptance: PlanAcceptance = {
    planId: plan.id,
    acceptedAt,
    fingerprint: planFingerprint(plan),
  };
  return ACCEPTANCE_PREFIX + toBase64Url(JSON.stringify(acceptance));
}

export function parseAcceptance(code: string): PlanAcceptance | null {
  const trimmed = code.trim().replace(/\s+/g, "");
  if (!trimmed.toUpperCase().startsWith(ACCEPTANCE_PREFIX)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(trimmed.slice(ACCEPTANCE_PREFIX.length)));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const acceptance = parsed as Partial<PlanAcceptance>;
  const tijd = typeof acceptance.acceptedAt === "string" ? Date.parse(acceptance.acceptedAt) : NaN;
  if (
    typeof acceptance.planId !== "string" ||
    !acceptance.planId ||
    typeof acceptance.fingerprint !== "string" ||
    !/^[0-9a-f]{16}$/.test(acceptance.fingerprint) ||
    Number.isNaN(tijd) ||
    typeof acceptance.acceptedAt !== "string"
  ) {
    return null;
  }
  return {
    planId: acceptance.planId,
    acceptedAt: acceptance.acceptedAt,
    fingerprint: acceptance.fingerprint,
  };
}

export function acceptanceMatches(acceptance: PlanAcceptance, plan: FingerprintSource): boolean {
  return (
    acceptance.planId === plan.id && acceptance.fingerprint === planFingerprint(plan)
  );
}
