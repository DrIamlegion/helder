// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

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
import { normalisePaymentLink } from "./planLink";
import type {
  AppState,
  BankTransaction,
  Company,
  Customer,
  Expense,
  Invoice,
  InvoiceDraft,
  InvoiceLine,
  InvoiceStatus,
  PaymentPlan,
  Product,
  QuarterOption,
  Quote,
  QuoteDraft,
  QuoteStatus,
  RateTotals,
  RecurringInvoice,
  Reminder,
  ReminderStatus,
  VatRate,
  VatReport,
} from "./types";

// Keep the original key so existing demo data survives the schema upgrade.
export const STORAGE_KEY = "helder.state.v2";
export const STATE_VERSION = 8;
const MIGRATABLE_VERSIONS = [2, 3, 4, 5, 6, 7, STATE_VERSION];

const COMPANY: Company = {
  naam: "Studio Noorderlicht",
  rechtsvorm: "Eenmanszaak",
  eigenaar: "Sanne de Vries",
  kvk: "87654321",
  btw: "NL001234567B01",
  iban: "NL12 RABO 0123 4567 89",
  email: "hallo@studionoorderlicht.nl",
  telefoon: "030 123 45 67",
  website: "studionoorderlicht.nl",
  adres: "Oudegracht 112",
  postcode: "3511 AW",
  plaats: "Utrecht",
  land: "Nederland",
  betaaltermijn: 14,
};

const RELATIES: Customer[] = [
  {
    id: "rel-molen",
    naam: "Brouwerij De Molen",
    contact: "Jeroen Bakker",
    email: "jeroen@brouwerijdemolen.nl",
    telefoon: "020 123 45 67",
    adres: "Funenkade 7",
    postcode: "1018 AL",
    plaats: "Amsterdam",
    btw: "NL812345678B01",
    kvk: "34216789",
  },
  {
    id: "rel-groenwerk",
    naam: "Groenwerk Tuinen",
    contact: "Marieke Smit",
    email: "marieke@groenwerk.nl",
    telefoon: "030 234 56 78",
    adres: "Weg naar Rhijnauwen 4",
    postcode: "3584 AD",
    plaats: "Utrecht",
    btw: "NL823456789B01",
    kvk: "35678901",
  },
  {
    id: "rel-koffie",
    naam: "Koffiebar Zwart",
    contact: "Daan Zwart",
    email: "daan@koffiebarzwart.nl",
    telefoon: "010 345 67 89",
    adres: "Nieuwe Binnenweg 88",
    postcode: "3014 GE",
    plaats: "Rotterdam",
    btw: "NL834567890B01",
    kvk: "36789012",
  },
  {
    id: "rel-water",
    naam: "Stichting Waterfront",
    contact: "Amara Osei",
    email: "amara@waterfront.nu",
    telefoon: "070 456 78 90",
    adres: "Zeekant 21",
    postcode: "2586 AP",
    plaats: "Den Haag",
    btw: "NL845678901B01",
    kvk: "37890123",
  },
  {
    id: "rel-lijn",
    naam: "Atelier Lijn",
    contact: "Lotte van Dijk",
    email: "lotte@atelierlijn.nl",
    telefoon: "023 567 89 01",
    adres: "Kleine Houtstraat 12",
    postcode: "2011 DH",
    plaats: "Haarlem",
    btw: "NL856789012B01",
    kvk: "38901234",
  },
  {
    id: "rel-gemeente",
    naam: "Gemeente Utrecht",
    contact: "Inkoop & Contracten",
    email: "inkoop@utrecht.nl",
    telefoon: "030 286 00 00",
    adres: "Stadsplateau 1",
    postcode: "3521 AZ",
    plaats: "Utrecht",
    btw: "NL001234567B01",
    kvk: "30280340",
  },
];

let lineSeq = 0;
const line = (omschrijving: string, aantal: number, prijs: number, btw: VatRate = 21): InvoiceLine => ({
  id: `l-${++lineSeq}`,
  omschrijving,
  aantal,
  prijs,
  btw,
});

function makeInvoice(
  nummer: string,
  klantId: string,
  datum: string,
  termijn: number,
  status: InvoiceStatus,
  regels: InvoiceLine[],
  extra: { notitie?: string; betaaldOp?: string } = {}
): Invoice {
  const due = new Date(`${datum}T12:00:00`);
  due.setDate(due.getDate() + termijn);
  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  return {
    id: `inv-${nummer}`,
    nummer,
    klantId,
    datum,
    vervaldatum: iso,
    status,
    regels,
    notitie:
      extra.notitie ||
      "Bedankt voor de prettige samenwerking. Vragen over deze factuur? Mail gerust naar hallo@studionoorderlicht.nl.",
    betaaldOp: status === "betaald" ? extra.betaaldOp || iso : undefined,
  };
}

const FACTUREN: Invoice[] = [
  makeInvoice("2026-0001", "rel-molen", "2026-01-09", 14, "betaald", [
    line("Brandidentiteit — brandbook en logopakket", 1, 2400),
    line("Drukwerk menukaarten", 1, 320, 9),
  ], { betaaldOp: "2026-01-20" }),
  makeInvoice("2026-0002", "rel-groenwerk", "2026-01-22", 14, "betaald", [
    line("Website ontwerp en bouw", 1, 1850),
  ], { betaaldOp: "2026-02-02" }),
  makeInvoice("2026-0003", "rel-koffie", "2026-02-06", 14, "betaald", [
    line("Interieurfotografie", 1, 950),
  ], { betaaldOp: "2026-02-19" }),
  makeInvoice("2026-0004", "rel-water", "2026-02-19", 30, "betaald", [
    line("Jaarverslag — ontwerp en opmaak", 1, 1600),
    line("Drukwerk jaarverslag", 1, 420, 9),
  ], { betaaldOp: "2026-03-18" }),
  makeInvoice("2026-0005", "rel-lijn", "2026-03-04", 14, "betaald", [
    line("Campagneconcept najaarscollectie", 1, 2750),
  ], { betaaldOp: "2026-03-16" }),
  makeInvoice("2026-0006", "rel-molen", "2026-03-21", 14, "betaald", [
    line("Verpakkingsontwerp limited edition", 1, 1200),
  ], { betaaldOp: "2026-04-01" }),
  makeInvoice("2026-0007", "rel-groenwerk", "2026-04-08", 14, "betaald", [
    line("Onderhoud website — kwartaal", 3, 150),
  ], { betaaldOp: "2026-04-20" }),
  makeInvoice("2026-0008", "rel-koffie", "2026-04-17", 14, "betaald", [
    line("Menuborden en raambelettering", 1, 780),
  ], { betaaldOp: "2026-04-29" }),
  makeInvoice("2026-0009", "rel-water", "2026-05-12", 30, "betaald", [
    line("Eventidentiteit Waterfront Live", 1, 1950),
  ], { betaaldOp: "2026-06-10" }),
  makeInvoice("2026-0010", "rel-molen", "2026-05-28", 14, "betaald", [
    line("Fotografie nieuwe bieren", 1, 1350),
  ], { betaaldOp: "2026-06-08" }),
  makeInvoice("2026-0011", "rel-lijn", "2026-06-09", 30, "betaald", [
    line("Webshop ontwerp en implementatie", 1, 2100),
  ], { betaaldOp: "2026-07-06" }),
  makeInvoice("2026-0012", "rel-gemeente", "2026-06-24", 30, "betaald", [
    line("Advies digitale dienstverlening — fase 1", 1, 3200),
  ], { betaaldOp: "2026-07-21" }),
  makeInvoice("2026-0013", "rel-groenwerk", "2026-07-07", 14, "betaald", [
    line("Tuinbrochure — ontwerp", 1, 1150),
    line("Drukwerk tuinbrochure", 1, 380, 9),
  ], { betaaldOp: "2026-07-17" }),
  makeInvoice("2026-0014", "rel-koffie", "2026-07-23", 14, "betaald", [
    line("Fotografie zomerkaart", 1, 640),
  ], { betaaldOp: "2026-08-03" }),
  makeInvoice("2026-0015", "rel-molen", "2026-08-11", 14, "betaald", [
    line("Etiketten herfstcollectie", 1, 1480),
  ], { betaaldOp: "2026-08-24" }),
  makeInvoice("2026-0016", "rel-water", "2026-08-26", 30, "betaald", [
    line("Campagne Waterfront Impact", 1, 2250),
  ], { betaaldOp: "2026-09-22" }),
  makeInvoice("2026-0017", "rel-lijn", "2026-09-08", 14, "betaald", [
    line("Interieurfotografie najaar", 1, 890),
  ], { betaaldOp: "2026-09-18" }),
  makeInvoice("2026-0018", "rel-gemeente", "2026-09-22", 30, "betaald", [
    line("Conceptontwikkeling — fase 2", 1, 2800),
  ], { betaaldOp: "2026-10-14" }),
  makeInvoice("2026-0019", "rel-groenwerk", "2026-10-02", 14, "verzonden", [
    line("Najaarsactie — campagnemiddelen", 1, 1650),
  ]),
  makeInvoice("2026-0020", "rel-molen", "2026-10-07", 30, "verzonden", [
    line("Fotografie wintercollectie", 1, 1250),
  ]),
  makeInvoice("2026-0021", "rel-koffie", "2026-10-13", 14, "concept", [
    line("Webshop — ontwerp en bouw", 1, 2950),
    line("Productfotografie", 1, 480),
  ]),
  makeInvoice("2026-0022", "rel-water", "2026-10-15", 30, "verzonden", [
    line("Impactrapport 2026 — ontwerp", 1, 1800),
  ]),
];

function makeQuote(
  nummer: string,
  klantId: string,
  datum: string,
  geldigTot: string,
  status: QuoteStatus,
  regels: InvoiceLine[],
  extra: { notitie?: string; factuurId?: string } = {}
): Quote {
  return {
    id: `off-${nummer}`,
    nummer,
    klantId,
    datum,
    geldigTot,
    status,
    regels,
    notitie:
      extra.notitie ||
      "Deze offerte is vrijblijvend. Prijzen zijn exclusief btw en gelden zolang de offerte geldig is.",
    factuurId: extra.factuurId,
  };
}

const OFFERTES: Quote[] = [
  makeQuote("OFF-2026-0001", "rel-water", "2026-09-01", "2026-10-01", "geaccepteerd", [
    line("Campagneconcept Waterfront Impact", 1, 2250),
  ]),
  makeQuote("OFF-2026-0002", "rel-molen", "2026-09-12", "2026-10-12", "geaccepteerd", [
    line("Etiketten herfstcollectie", 1, 1480),
  ]),
  makeQuote("OFF-2026-0003", "rel-groenwerk", "2026-09-24", "2026-10-24", "verzonden", [
    line("Tuinbrochure — ontwerp en drukwerk", 1, 1150),
    line("Drukwerk tuinbrochure", 1, 380, 9),
  ]),
  makeQuote("OFF-2026-0004", "rel-lijn", "2026-10-01", "2026-10-31", "verzonden", [
    line("Webshop ontwerp en implementatie", 1, 2100),
    line("Productfotografie", 1, 480),
  ]),
  makeQuote("OFF-2026-0005", "rel-koffie", "2026-10-08", "2026-11-07", "concept", [
    line("Menukaarten en raambelettering", 1, 780),
  ]),
  makeQuote("OFF-2026-0006", "rel-gemeente", "2026-08-20", "2026-09-19", "afgewezen", [
    line("Advies digitale dienstverlening — fase 2", 1, 3200),
  ]),
];

const PRODUCTEN: Product[] = [
  {
    id: "prod-branding",
    naam: "Brandidentiteit",
    omschrijving: "Brandbook, logo en visuele richtlijnen",
    prijs: 2400,
    btw: 21,
    eenheid: "project",
  },
  {
    id: "prod-website",
    naam: "Website ontwerp en bouw",
    omschrijving: "Ontwerp, bouw en oplevering van een website",
    prijs: 1850,
    btw: 21,
    eenheid: "project",
  },
  {
    id: "prod-onderhoud",
    naam: "Websiteonderhoud",
    omschrijving: "Updates, back-ups en kleine aanpassingen",
    prijs: 150,
    btw: 21,
    eenheid: "maand",
  },
  {
    id: "prod-fotografie",
    naam: "Fotografie",
    omschrijving: "Fotoshoot op locatie, inclusief nabewerking",
    prijs: 950,
    btw: 21,
    eenheid: "dagdeel",
  },
  {
    id: "prod-drukwerk",
    naam: "Drukwerk",
    omschrijving: "Menukaarten, brochures en ander drukwerk",
    prijs: 320,
    btw: 9,
    eenheid: "opdracht",
  },
  {
    id: "prod-advies",
    naam: "Advies",
    omschrijving: "Strategisch advies en begeleiding",
    prijs: 125,
    btw: 21,
    eenheid: "uur",
  },
];

const BANKTRANSACTIES: BankTransaction[] = [
  {
    id: "bank-seed-waterfront",
    datum: "2026-10-16",
    bedrag: 2178,
    tegenpartij: "Stichting Waterfront",
    omschrijving: "Betaling factuur 2026-0022",
    rekening: "NL12 RABO 0123 4567 89",
    status: "open",
  },
  {
    id: "bank-seed-molen",
    datum: "2026-10-15",
    bedrag: 1512.5,
    tegenpartij: "Brouwerij De Molen",
    omschrijving: "Betaling factuur 2026-0020",
    rekening: "NL12 RABO 0123 4567 89",
    status: "open",
  },
  {
    id: "bank-seed-odido",
    datum: "2026-10-10",
    bedrag: -45,
    tegenpartij: "Odido",
    omschrijving: "Telefoonabonnement",
    rekening: "NL12 RABO 0123 4567 89",
    status: "open",
  },
  {
    id: "bank-seed-losse-ontvangst",
    datum: "2026-10-08",
    bedrag: 1250,
    tegenpartij: "Onbekend",
    omschrijving: "Losse ontvangst",
    rekening: "NL12 RABO 0123 4567 89",
    status: "open",
  },
];

const HERHALINGEN: RecurringInvoice[] = [
  {
    id: "rec-onderhoud",
    naam: "Websiteonderhoud Groenwerk",
    klantId: "rel-groenwerk",
    termijn: 14,
    interval: "maandelijks",
    volgendeDatum: "2026-11-01",
    actief: true,
    regels: [line("Websiteonderhoud — maand", 1, 150)],
    notitie: "Maandelijks onderhoud aan de website: updates, back-ups en kleine aanpassingen.",
  },
  {
    id: "rec-fotografie",
    naam: "Kwartaalreportage Koffiebar Zwart",
    klantId: "rel-koffie",
    termijn: 14,
    interval: "kwartaal",
    volgendeDatum: "2027-01-15",
    actief: true,
    regels: [line("Fotografie — kwartaalreportage", 1, 640)],
    notitie: "Per kwartaal een reportage van de nieuwe kaart en het interieur.",
  },
];

let expenseSeq = 0;
const expense = (
  datum: string,
  leverancier: string,
  omschrijving: string,
  categorie: string,
  bedragIncl: number,
  btwTarief: VatRate,
  aftrekbaar = true
): Expense => ({
  id: `exp-${String(++expenseSeq).padStart(3, "0")}`,
  datum,
  leverancier,
  omschrijving,
  categorie,
  bedragIncl,
  btwTarief,
  aftrekbaar,
});

const UITGAVEN: Expense[] = [
  expense("2026-01-05", "Adobe", "Creative Cloud — jaarabonnement", "Software & abonnementen", 791.88, 21),
  expense("2026-01-12", "Vastgoed Beheer BV", "Kantoorhuur januari", "Huisvesting", 850, 0, false),
  expense("2026-02-03", "Amac", "MacBook Pro 14 inch", "Apparatuur", 2399, 21),
  expense("2026-02-18", "NS Zakelijk", "Treinreis Utrecht — Amsterdam", "Reiskosten", 84.5, 9),
  expense("2026-03-02", "Photo Academy", "Opleiding licht & kleur", "Opleiding", 595, 21),
  expense("2026-03-15", "Office Centre", "Kantoorartikelen en papier", "Kantoorkosten", 128.4, 21),
  expense("2026-04-01", "Vastgoed Beheer BV", "Kantoorhuur april", "Huisvesting", 850, 0, false),
  expense("2026-04-20", "Cloudhost", "Hosting en domeinnaam", "Software & abonnementen", 240, 21),
  expense("2026-05-07", "Google", "Advertenties portfolio", "Marketing", 400, 21),
  expense("2026-05-21", "Restaurant De Kas", "Lunch opdrachtgever", "Representatie", 186.5, 21, false),
  expense("2026-06-11", "CameraNU", "Objectief 35mm", "Apparatuur", 1149, 21),
  expense("2026-07-01", "Vastgoed Beheer BV", "Kantoorhuur juli", "Huisvesting", 850, 0, false),
  expense("2026-07-19", "NS International", "Treinreis Utrecht — Berlijn", "Reiskosten", 156.8, 9),
  expense("2026-08-04", "Helder Boekhouding", "Abonnement boekhoudsoftware", "Software & abonnementen", 29.95, 21),
  expense("2026-08-22", "Dutch Design Week", "Tickets designbeurs", "Marketing", 350, 21),
  expense("2026-09-03", "Coolblue", "Printer voor proefdrukken", "Apparatuur", 429, 21),
  expense("2026-09-17", "Odido", "Telefoonabonnement", "Kantoorkosten", 45, 21),
  expense("2026-10-06", "Foto Speciaal", "Fotopapier en inkt", "Kantoorkosten", 96.75, 21),
  expense("2026-10-14", "Centraal Beheer", "Beroepsaansprakelijkheid", "Overig", 210, 0, false),
];

const AANGIFTES = {
  "2026-Q1": { ingediendOp: "2026-04-24" },
  "2026-Q2": { ingediendOp: "2026-07-28" },
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

export function seedQuotes(): Quote[] {
  return OFFERTES.map((quote) => ({ ...quote, regels: quote.regels.map((l) => ({ ...l })) }));
}

export function seedProducts(): Product[] {
  return PRODUCTEN.map((product) => ({ ...product }));
}

export function seedBankTransactions(): BankTransaction[] {
  return BANKTRANSACTIES.map((transaction) => ({ ...transaction }));
}

export function seedRecurring(): RecurringInvoice[] {
  return HERHALINGEN.map((rule) => ({
    ...rule,
    regels: rule.regels.map((regel) => ({ ...regel })),
  }));
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
    bedrijf: { ...COMPANY },
    relaties: RELATIES.map((r) => ({ ...r })),
    facturen: FACTUREN.map((f) => ({ ...f, regels: f.regels.map((l) => ({ ...l })) })),
    offertes: seedQuotes(),
    producten: seedProducts(),
    herhalingen: seedRecurring(),
    banktransacties: seedBankTransactions(),
    herinneringen: [],
    betaalregelingen: [],
    autoAanmaningen: true,
    uitgaven: UITGAVEN.map((u) => ({ ...u })),
    aangiftes: { ...AANGIFTES },
    aangemaakt: "2026-01-01",
  };
}

// Accepts both current state and backups/storage from the previous schema version.
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
  return {
    ...(parsed as AppState),
    versie: STATE_VERSION,
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
