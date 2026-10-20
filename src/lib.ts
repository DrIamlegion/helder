// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import type {
  Expense,
  Invoice,
  InvoiceDisplayState,
  InvoiceLine,
  InvoiceTotals,
  Quote,
  QuoteDisplayState,
  RecurringInterval,
  VatRate,
} from "./types";

const NL = "nl-NL";

export const uid = (): string =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function eur(
  amount: number,
  opts: { cents?: boolean; sign?: boolean } = {}
): string {
  const { cents = true, sign = false } = opts;
  const value = Number(amount) || 0;
  const formatted = new Intl.NumberFormat(NL, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
  if (sign && value > 0) return "+" + formatted;
  return formatted;
}

const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso) ?? new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return toISO(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISO(iso) ?? new Date();
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISO(target);
}

export const RECURRING_INTERVALS: { value: RecurringInterval; label: string; perYear: number }[] = [
  { value: "wekelijks", label: "Wekelijks", perYear: 52 },
  { value: "maandelijks", label: "Maandelijks", perYear: 12 },
  { value: "kwartaal", label: "Per kwartaal", perYear: 4 },
  { value: "jaarlijks", label: "Jaarlijks", perYear: 1 },
];

export function intervalLabel(interval: RecurringInterval): string {
  return RECURRING_INTERVALS.find((item) => item.value === interval)?.label ?? "Maandelijks";
}

export function intervalPerYear(interval: RecurringInterval): number {
  return RECURRING_INTERVALS.find((item) => item.value === interval)?.perYear ?? 12;
}

export function advanceRecurringDate(iso: string, interval: RecurringInterval): string {
  if (interval === "wekelijks") return addDays(iso, 7);
  if (interval === "maandelijks") return addMonths(iso, 1);
  if (interval === "kwartaal") return addMonths(iso, 3);
  return addMonths(iso, 12);
}

export type DateStyle = "short" | "medium" | "long" | "month";

export function fmtDate(iso: string, style: DateStyle = "long"): string {
  const date = parseISO(iso);
  if (!date) return "—";
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  if (style === "short") return `${d} ${MONTHS_SHORT[m]}`;
  if (style === "medium") return `${d} ${MONTHS_SHORT[m]} ${y}`;
  if (style === "month") return `${MONTHS[m]} ${y}`;
  return `${d} ${MONTHS[m]} ${y}`;
}

// Tijdstip van een online akkoord, in de lokale tijd van de gebruiker.
export function fmtDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(NL, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function fmtDateLong(iso: string): string {
  const date = parseISO(iso);
  if (!date) return "";
  const weekday = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"][date.getDay()];
  return `${weekday} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthShort(monthIndex: number): string {
  return MONTHS_SHORT[monthIndex];
}

export function daysBetween(a: string, b: string): number {
  const d1 = parseISO(a);
  const d2 = parseISO(b);
  if (!d1 || !d2) return 0;
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function quarterRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start: toISO(start), end: toISO(end) };
}

export function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

// Dutch VAT return deadline: the last day of the month after the quarter ends.
export function vatDeadline(year: number, quarter: number): string {
  return toISO(new Date(year, quarter * 3 + 1, 0));
}

export function daysUntil(iso: string): number {
  return daysBetween(todayISO(), iso);
}

export function sum<T>(list: T[], fn: (item: T) => number = (item) => Number(item)): number {
  return list.reduce((total, item) => total + (Number(fn(item)) || 0), 0);
}

// Kopieert naar het klembord en valt terug op een verborgen tekstveld als de API ontbreekt.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Val terug op de klassieke manier.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function initials(name: string): string {
  return String(name || "")
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export const VAT_RATES: VatRate[] = [21, 9, 0];

export function lineTotals(line: InvoiceLine): { excl: number; vat: number; incl: number; rate: VatRate } {
  const qty = Number(line.aantal) || 0;
  const price = Number(line.prijs) || 0;
  const excl = Math.round(qty * price * 100) / 100;
  const rate = (Number(line.btw) === 9 ? 9 : Number(line.btw) === 0 ? 0 : 21) as VatRate;
  const vat = Math.round(excl * rate) / 100;
  return { excl, vat, incl: excl + vat, rate };
}

export function invoiceTotals(invoice: Pick<Invoice, "regels">): InvoiceTotals {
  const lines = invoice.regels ?? [];
  let excl = 0;
  let vat = 0;
  const perRate: Record<number, { base: number; vat: number }> = {};
  for (const line of lines) {
    const t = lineTotals(line);
    excl += t.excl;
    vat += t.vat;
    if (!perRate[t.rate]) perRate[t.rate] = { base: 0, vat: 0 };
    perRate[t.rate].base += t.excl;
    perRate[t.rate].vat += t.vat;
  }
  return {
    excl: Math.round(excl * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    incl: Math.round((excl + vat) * 100) / 100,
    perRate,
  };
}

// Stored status is concept | verzonden | betaald. "Vervallen" is derived from the due date.
export function invoiceState(invoice: Invoice): InvoiceDisplayState {
  if (invoice.status === "betaald") return "betaald";
  if (invoice.status === "concept") return "concept";
  if (invoice.vervaldatum && invoice.vervaldatum < todayISO()) return "vervallen";
  return "verzonden";
}

export function stateLabel(state: InvoiceDisplayState): string {
  return { betaald: "Betaald", concept: "Concept", verzonden: "Verzonden", vervallen: "Vervallen" }[state];
}

// A quote is only "verlopen" while it is still awaiting an answer.
export function quoteState(quote: Quote): QuoteDisplayState {
  if (quote.status === "verzonden" && quote.geldigTot && quote.geldigTot < todayISO()) {
    return "verlopen";
  }
  return quote.status;
}

export function quoteStateLabel(state: QuoteDisplayState): string {
  return {
    concept: "Concept",
    verzonden: "Verzonden",
    geaccepteerd: "Geaccepteerd",
    afgewezen: "Afgewezen",
    verlopen: "Verlopen",
  }[state];
}

export function relativeDue(invoice: Invoice): string {
  const state = invoiceState(invoice);
  if (state === "betaald") return `Betaald op ${fmtDate(invoice.betaaldOp || invoice.vervaldatum, "medium")}`;
  if (state === "concept") return "Nog niet verstuurd";
  const diff = daysBetween(todayISO(), invoice.vervaldatum);
  if (diff < 0) return `${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dag" : "dagen"} te laat`;
  if (diff === 0) return "Vervalt vandaag";
  return `Vervalt over ${diff} ${diff === 1 ? "dag" : "dagen"}`;
}

export function nextDocumentNumber(
  documents: { nummer: string }[],
  year: number,
  prefix = ""
): string {
  const yearPrefix = `${prefix}${year}-`;
  const highest = documents
    .filter((doc) => String(doc.nummer).startsWith(yearPrefix))
    .reduce(
      (max, doc) => Math.max(max, Number(String(doc.nummer).slice(yearPrefix.length)) || 0),
      0
    );
  return `${yearPrefix}${String(highest + 1).padStart(4, "0")}`;
}

export function nextInvoiceNumber(invoices: Invoice[], year: number): string {
  return nextDocumentNumber(invoices, year);
}

export function download(filename: string, text: string, type = "text/plain"): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseAmount(value: string): number {
  let cleaned = String(value ?? "").replace(/[^\d.,-]/g, "");
  if (cleaned.includes(",")) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

export function expenseParts(expense: Pick<Expense, "bedragIncl" | "btwTarief">): {
  incl: number;
  excl: number;
  vat: number;
  rate: number;
} {
  const incl = Number(expense.bedragIncl) || 0;
  const rate = Number(expense.btwTarief) || 0;
  const excl = Math.round((incl / (1 + rate / 100)) * 100) / 100;
  return { incl: Math.round(incl * 100) / 100, excl, vat: Math.round((incl - excl) * 100) / 100, rate };
}
