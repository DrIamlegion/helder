// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

export interface Company {
  naam: string;
  /** Eén eigen logo als data-URL (PNG, JPG of WebP); leeg als er geen logo is. */
  logo: string;
  /** Compacte versie van het logo voor de deelbare betaallink; leeg zonder logo. */
  logoKlein: string;
  rechtsvorm: string;
  eigenaar: string;
  kvk: string;
  btw: string;
  iban: string;
  email: string;
  telefoon: string;
  website: string;
  adres: string;
  postcode: string;
  plaats: string;
  land: string;
  betaaltermijn: number;
}

export interface Customer {
  id: string;
  naam: string;
  contact: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  btw: string;
  kvk: string;
}

export type VatRate = 21 | 9 | 0;

export interface InvoiceLine {
  id: string;
  omschrijving: string;
  aantal: number;
  prijs: number;
  btw: VatRate;
}

export type InvoiceStatus = "concept" | "verzonden" | "betaald";

export interface Invoice {
  id: string;
  nummer: string;
  klantId: string;
  datum: string;
  vervaldatum: string;
  status: InvoiceStatus;
  regels: InvoiceLine[];
  notitie: string;
  betaaldOp?: string;
}

export interface InvoiceDraft {
  id: string | null;
  nummer: string;
  klantId: string;
  datum: string;
  vervaldatum: string;
  status: InvoiceStatus;
  regels: InvoiceLine[];
  notitie: string;
  betaaldOp?: string;
}

export type QuoteStatus = "concept" | "verzonden" | "geaccepteerd" | "afgewezen";

export type QuoteDisplayState = QuoteStatus | "verlopen";

export interface Quote {
  id: string;
  nummer: string;
  klantId: string;
  datum: string;
  geldigTot: string;
  status: QuoteStatus;
  regels: InvoiceLine[];
  notitie: string;
  factuurId?: string;
}

export interface QuoteDraft {
  id: string | null;
  nummer: string;
  klantId: string;
  datum: string;
  geldigTot: string;
  status: QuoteStatus;
  regels: InvoiceLine[];
  notitie: string;
  factuurId?: string;
}

export type RecurringInterval = "wekelijks" | "maandelijks" | "kwartaal" | "jaarlijks";

export interface RecurringInvoice {
  id: string;
  naam: string;
  klantId: string;
  termijn: number;
  interval: RecurringInterval;
  volgendeDatum: string;
  eindDatum?: string;
  actief: boolean;
  regels: InvoiceLine[];
  notitie: string;
  laatsteFactuurId?: string;
}

export type BankTransactionStatus = "open" | "gekoppeld" | "genegeerd";

export interface BankTransaction {
  id: string;
  datum: string;
  bedrag: number;
  tegenpartij: string;
  omschrijving: string;
  rekening?: string;
  status: BankTransactionStatus;
  factuurId?: string;
}

export type ReminderLevel = 1 | 2 | 3;

export type ReminderStatus = "concept" | "verzonden";

// Een brief die Helder zelf klaarzet staat op "concept" tot je hem verstuurt.
export interface Reminder {
  id: string;
  factuurId: string;
  niveau: ReminderLevel;
  status: ReminderStatus;
  aangemaaktOp: string;
  verzondenOp?: string;
  automatisch?: boolean;
  genegeerdOp?: string;
}

// Een betaalregeling pauzeert verdere aanmaningen zolang de klant de termijnen betaalt.
export interface PaymentPlan {
  id: string;
  factuurId: string;
  termijnen: number;
  totaal: number;
  bedragPerTermijn: number;
  intervalDagen: number;
  eersteTermijn: string;
  aangemaaktOp: string;
  beeindigdOp?: string;
  // Tijdstip waarop de klant de deelbare link accepteerde (ISO-datetime).
  geaccepteerdOp?: string;
  // Hosted betaallink (iDEAL) waarmee de klant de eerste termijn direct kan voldoen.
  betaalLink?: string;
  notitie?: string;
}

export interface Product {
  id: string;
  naam: string;
  omschrijving: string;
  prijs: number;
  btw: VatRate;
  eenheid: string;
}

export interface Expense {
  id: string;
  datum: string;
  leverancier: string;
  omschrijving: string;
  categorie: string;
  bedragIncl: number;
  btwTarief: VatRate;
  aftrekbaar: boolean;
}

export interface VatSubmission {
  ingediendOp: string;
}

export interface AppState {
  versie: number;
  bedrijf: Company;
  relaties: Customer[];
  facturen: Invoice[];
  offertes: Quote[];
  producten: Product[];
  herhalingen: RecurringInvoice[];
  banktransacties: BankTransaction[];
  herinneringen: Reminder[];
  betaalregelingen: PaymentPlan[];
  autoAanmaningen: boolean;
  uitgaven: Expense[];
  aangiftes: Record<string, VatSubmission>;
  aangemaakt: string;
}

export type InvoiceDisplayState = "concept" | "verzonden" | "betaald" | "vervallen";

export interface RateTotals {
  21: number;
  9: number;
  0: number;
}

export interface InvoiceTotals {
  excl: number;
  vat: number;
  incl: number;
  perRate: Record<number, { base: number; vat: number }>;
}

export interface VatReport {
  year: number;
  quarter: number;
  start: string;
  end: string;
  facturen: Invoice[];
  uitgaven: Expense[];
  base: RateTotals;
  vat: RateTotals;
  verschuldigd: number;
  voorbelasting: number;
  saldo: number;
  aangifte?: VatSubmission;
  omzetTotaal: InvoiceTotals;
}

export interface QuarterOption {
  year: number;
  quarter: number;
  deadline: string;
  days: number;
}
