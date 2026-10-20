// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import {
  addDays,
  advanceRecurringDate,
  daysUntil,
  inRange,
  invoiceTotals,
  lineTotals,
  nextDocumentNumber,
  nextInvoiceNumber,
  quarterRange,
  sum,
  todayISO,
  uid,
  vatDeadline,
} from "./lib";
import { normalisePaymentLink, normalisePlanLogo } from "./planLink";
import type {
  AppState,
  BankTransaction,
  Company,
  Invoice,
  InvoiceDraft,
  PaymentPlan,
  Product,
  QuarterOption,
  Quote,
  QuoteDraft,
  RateTotals,
  RecurringInvoice,
  Reminder,
  ReminderStatus,
  VatReport,
} from "./types";

// De opslagsleutel blijft gelijk, zodat een bestaande installatie zijn gegevens kan inleveren
// bij de overstap naar een lege administratie (zie normalizeState).
export const STORAGE_KEY = "helder.state.v2";
// Versie 10 is de eerste zonder voorbeeldadministratie: oudere staten worden niet gemigreerd
// maar vervangen door een lege start, zodat niemand met demo-gegevens verder werkt.
export const STATE_VERSION = 10;
const MIGRATABLE_VERSIONS = [STATE_VERSION];

// Een nieuwe administratie begint leeg: geen voorbeeldklanten, facturen of uitgaven. De
// gebruiker vult eerst het eigen bedrijf in via de wizard (zie src/pages/OnboardingPage.tsx).
const LEEG_BEDRIJF: Company = {
  naam: "",
  logo: "",
  logoKlein: "",
  rechtsvorm: "Eenmanszaak",
  eigenaar: "",
  kvk: "",
  btw: "",
  iban: "",
  email: "",
  telefoon: "",
  website: "",
  adres: "",
  postcode: "",
  plaats: "",
  land: "Nederland",
  betaaltermijn: 14,
};

export const CATEGORIES = [
  "Software & abonnementen",
  "Apparatuur",
  "Reiskosten",
  "Kantoorkosten",
  "Marketing",
  "Opleiding",
  "Representatie",
  "Huisvesting",
  "Overig",
];

// Er zijn geen voorbeeldgegevens meer: elke administratie begint met lege lijsten.
export function seedQuotes(): Quote[] {
  return [];
}

export function seedProducts(): Product[] {
  return [];
}

export function seedBankTransactions(): BankTransaction[] {
  return [];
}

export function seedRecurring(): RecurringInvoice[] {
  return [];
}

// Oudere back-ups kennen alleen verzonden brieven; die krijgen status "verzonden".
function normalizeReminders(input: unknown): Reminder[] {
  if (!Array.isArray(input)) return [];
  const reminders: Reminder[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<Reminder>;
    if (!item.factuurId) continue;
    if (item.niveau !== 1 && item.niveau !== 2 && item.niveau !== 3) continue;
    const status: ReminderStatus = item.status === "concept" ? "concept" : "verzonden";
    const aangemaaktOp = item.aangemaaktOp || item.verzondenOp || todayISO();
    reminders.push({
      id: item.id || `rem-${uid()}`,
      factuurId: item.factuurId,
      niveau: item.niveau,
      status,
      aangemaaktOp,
      verzondenOp: status === "verzonden" ? item.verzondenOp || aangemaaktOp : item.verzondenOp,
      automatisch: item.automatisch,
      genegeerdOp: item.genegeerdOp,
    });
  }
  return reminders;
}

function normalizePaymentPlans(input: unknown): PaymentPlan[] {
  if (!Array.isArray(input)) return [];
  const plans: PaymentPlan[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<PaymentPlan>;
    if (!item.factuurId) continue;
    const termijnen = Math.round(Number(item.termijnen) || 0);
    const intervalDagen = Math.round(Number(item.intervalDagen) || 0);
    const totaal = Number(item.totaal) || 0;
    if (termijnen < 2 || intervalDagen <= 0 || totaal <= 0 || !item.eersteTermijn) continue;
    plans.push({
      id: item.id || `plan-${item.factuurId}`,
      factuurId: item.factuurId,
      termijnen,
      totaal,
      bedragPerTermijn: Number(item.bedragPerTermijn) || totaal / termijnen,
      intervalDagen,
      eersteTermijn: item.eersteTermijn,
      aangemaaktOp: item.aangemaaktOp || todayISO(),
      beeindigdOp: item.beeindigdOp,
      geaccepteerdOp:
        typeof item.geaccepteerdOp === "string" &&
        !Number.isNaN(Date.parse(item.geaccepteerdOp))
          ? item.geaccepteerdOp
          : undefined,
      betaalLink: normalisePaymentLink(item.betaalLink) ?? undefined,
      notitie: item.notitie,
    });
  }
  return plans;
}

export function seedState(): AppState {
  return {
    versie: STATE_VERSION,
    bedrijf: { ...LEEG_BEDRIJF },
    relaties: [],
    facturen: [],
    offertes: [],
    producten: [],
    herhalingen: [],
    banktransacties: [],
    herinneringen: [],
    betaalregelingen: [],
    autoAanmaningen: true,
    uitgaven: [],
    aangiftes: {},
    aangemaakt: todayISO(),
  };
}

// Accepteert de huidige staat en back-ups daarvan. Staten uit de demo-periode (versie 9 en
// lager) worden geweigerd, zodat de app met een lege administratie begint in plaats van met
// voorbeeldgegevens.
export function normalizeState(input: unknown): AppState | null {
  if (!input || typeof input !== "object") return null;
  const parsed = input as Partial<AppState> & { versie?: number };
  if (typeof parsed.versie !== "number" || !MIGRATABLE_VERSIONS.includes(parsed.versie)) {
    return null;
  }
  if (
    !parsed.bedrijf ||
    !Array.isArray(parsed.relaties) ||
    !Array.isArray(parsed.facturen) ||
    !Array.isArray(parsed.uitgaven)
  ) {
    return null;
  }

  // Een logo is één data-URL van een klein plaatje. Alleen die vorm komt door de controle; zo
  // kan een handmatig aangepaste back-up geen externe afbeelding of een enorm bestand meeslepen.
  const bedrijf = parsed.bedrijf;
  const logo =
    typeof bedrijf.logo === "string" &&
    /^data:image\/(png|jpe?g|webp);base64,/.test(bedrijf.logo) &&
    bedrijf.logo.length <= 700_000
      ? bedrijf.logo
      : "";
  // De compacte variant hoort bij het logo en is nooit groter dan wat er in een deellink past.
  const logoKlein = logo ? normalisePlanLogo(bedrijf.logoKlein) : "";

  return {
    ...(parsed as AppState),
    versie: STATE_VERSION,
    bedrijf: { ...bedrijf, logo, logoKlein },
    offertes: Array.isArray(parsed.offertes) ? parsed.offertes : seedQuotes(),
    producten: Array.isArray(parsed.producten) ? parsed.producten : seedProducts(),
    herhalingen: Array.isArray(parsed.herhalingen) ? parsed.herhalingen : seedRecurring(),
    banktransacties: Array.isArray(parsed.banktransacties)
      ? parsed.banktransacties
      : seedBankTransactions(),
    herinneringen: normalizeReminders(parsed.herinneringen),
    betaalregelingen: normalizePaymentPlans(parsed.betaalregelingen),
    autoAanmaningen: typeof parsed.autoAanmaningen === "boolean" ? parsed.autoAanmaningen : true,
    aangiftes: parsed.aangiftes ?? {},
  };
}

interface RecurringRunOptions {
  onlyId?: string;
  force?: boolean;
}

// Turns due recurring rules into concept invoices and advances their schedule.
export function applyRecurring(
  state: AppState,
  options: RecurringRunOptions = {}
): { state: AppState; created: Invoice[] } {
  const today = todayISO();
  const created: Invoice[] = [];

  const herhalingen = state.herhalingen.map((rule) => {
    if (options.onlyId && rule.id !== options.onlyId) return rule;
    if (!rule.actief) return rule;
    if (rule.eindDatum && rule.volgendeDatum > rule.eindDatum) {
      return { ...rule, actief: false };
    }

    let cursor = rule.volgendeDatum;
    const occurrences: string[] = [];

    if (options.force) {
      occurrences.push(cursor);
      cursor = advanceRecurringDate(cursor, rule.interval);
    } else {
      let guard = 0;
      while (cursor <= today && guard < 24) {
        if (rule.eindDatum && cursor > rule.eindDatum) break;
        occurrences.push(cursor);
        cursor = advanceRecurringDate(cursor, rule.interval);
        guard++;
      }
    }

    if (occurrences.length === 0) return rule;

    let lastInvoice: Invoice | undefined;
    for (const planned of occurrences) {
      const datum = options.force ? today : planned;
      const invoice: Invoice = {
        id: `inv-${uid()}`,
        nummer: nextInvoiceNumber([...state.facturen, ...created], Number(datum.slice(0, 4))),
        klantId: rule.klantId,
        datum,
        vervaldatum: addDays(datum, Number(rule.termijn) || 14),
        status: "concept",
        regels: rule.regels.map((regel) => ({ ...regel, id: uid() })),
        notitie: rule.notitie,
      };
      created.push(invoice);
      lastInvoice = invoice;
    }

    return {
      ...rule,
      volgendeDatum: cursor,
      actief: !rule.eindDatum || cursor <= rule.eindDatum,
      laatsteFactuurId: lastInvoice?.id ?? rule.laatsteFactuurId,
    };
  });

  if (created.length === 0) return { state, created };
  return {
    state: { ...state, facturen: [...created, ...state.facturen], herhalingen },
    created,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function newInvoiceDraft(state: AppState): InvoiceDraft {
  const vandaag = todayISO();
  const termijn = Number(state.bedrijf.betaaltermijn) || 14;
  return {
    id: null,
    nummer: nextInvoiceNumber(state.facturen, Number(vandaag.slice(0, 4))),
    klantId: state.relaties[0]?.id ?? "",
    datum: vandaag,
    vervaldatum: addDays(vandaag, termijn),
    status: "concept",
    regels: [{ id: `l-${Date.now()}`, omschrijving: "", aantal: 1, prijs: 0, btw: 21 }],
    notitie:
      "Bedankt voor de prettige samenwerking. Vragen over deze factuur? Mail gerust naar " +
      state.bedrijf.email +
      ".",
  };
}

export function nextQuoteNumber(quotes: Quote[], year: number): string {
  return nextDocumentNumber(quotes, year, "OFF-");
}

export function newQuoteDraft(state: AppState): QuoteDraft {
  const vandaag = todayISO();
  return {
    id: null,
    nummer: nextQuoteNumber(state.offertes, Number(vandaag.slice(0, 4))),
    klantId: state.relaties[0]?.id ?? "",
    datum: vandaag,
    geldigTot: addDays(vandaag, 30),
    status: "concept",
    regels: [{ id: `l-${Date.now()}`, omschrijving: "", aantal: 1, prijs: 0, btw: 21 }],
    notitie:
      "Deze offerte is vrijblijvend. Prijzen zijn exclusief btw en gelden zolang de offerte geldig is. " +
      "Akkoord? Mail gerust naar " +
      state.bedrijf.email +
      ".",
  };
}

export function vatReport(state: AppState, year: number, quarter: number): VatReport {
  const { start, end } = quarterRange(year, quarter);
  const facturen = state.facturen.filter((f) => f.status !== "concept" && inRange(f.datum, start, end));
  const uitgaven = state.uitgaven.filter((u) => inRange(u.datum, start, end));

  const base: RateTotals = { 21: 0, 9: 0, 0: 0 };
  const vat: RateTotals = { 21: 0, 9: 0, 0: 0 };
  for (const factuur of facturen) {
    for (const regel of factuur.regels) {
      const t = lineTotals(regel);
      const rate = t.rate;
      base[rate] += t.excl;
      vat[rate] += t.vat;
    }
  }

  const voorbelasting = sum(
    uitgaven.filter((u) => u.aftrekbaar),
    (u) => {
      const incl = Number(u.bedragIncl) || 0;
      const rate = Number(u.btwTarief) || 0;
      return round2(incl - incl / (1 + rate / 100));
    }
  );

  const verschuldigd = round2(vat[21] + vat[9]);
  const voor = round2(voorbelasting);
  const saldo = round2(verschuldigd - voor);

  return {
    year,
    quarter,
    start,
    end,
    facturen,
    uitgaven,
    base: { 21: round2(base[21]), 9: round2(base[9]), 0: round2(base[0]) },
    vat: { 21: round2(vat[21]), 9: round2(vat[9]), 0: 0 },
    verschuldigd,
    voorbelasting: voor,
    saldo,
    aangifte: state.aangiftes[`${year}-Q${quarter}`],
    omzetTotaal: invoiceTotals({ regels: facturen.flatMap((f) => f.regels) }),
  };
}

export function yearOptions(state: AppState): number[] {
  const years = new Set<number>([new Date().getFullYear(), 2026]);
  state.facturen.forEach((f) => years.add(Number(f.datum.slice(0, 4))));
  state.uitgaven.forEach((u) => years.add(Number(u.datum.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

export function openVatReminder(state: AppState): QuarterOption | null {
  const now = new Date();
  const candidates: QuarterOption[] = [];
  for (let year = now.getFullYear() - 1; year <= now.getFullYear(); year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      if (state.aangiftes[`${year}-Q${quarter}`]) continue;
      const deadline = vatDeadline(year, quarter);
      const days = daysUntil(deadline);
      if (days >= 0) candidates.push({ year, quarter, deadline, days });
    }
  }
  candidates.sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  return candidates[0] ?? null;
}
