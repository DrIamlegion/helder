// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { invoiceState, invoiceTotals } from "./lib";
import type { BankTransaction, Customer, Invoice } from "./types";

export interface ParsedBankRow {
  datum: string;
  bedrag: number;
  tegenpartij: string;
  omschrijving: string;
  rekening?: string;
}

export interface BankCsvResult {
  rows: ParsedBankRow[];
  errors: string[];
}

type ColumnKey = keyof ParsedBankRow;

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  datum: ["datum", "date", "boekdatum", "transactiedatum", "valutadatum"],
  bedrag: ["bedrag", "amount", "mutatie", "transactiebedrag", "bedragbij"],
  tegenpartij: [
    "tegenpartij",
    "naam",
    "name",
    "begunstigde",
    "tegenrekeninghouder",
    "naamtegenpartij",
  ],
  omschrijving: [
    "omschrijving",
    "description",
    "mededelingen",
    "mededeling",
    "details",
    "betalingskenmerk",
  ],
  rekening: ["rekening", "iban", "account", "tegenrekening"],
};

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) count++;
  }
  return count;
}

function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function parseDate(value: string): string | null {
  const cleaned = value.trim().split(/[T ]/)[0];
  let year = 0;
  let month = 0;
  let day = 0;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const dotted = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(cleaned);
    if (!dotted) return null;
    day = Number(dotted[1]);
    month = Number(dotted[2]);
    year = Number(dotted[3]);
    if (year < 100) year += 2000;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseAmount(value: string): number | null {
  let text = value.replace(/[€$£\s\u00a0]/g, "").replace(/[^\d,.\-+]/g, "");
  if (!text) return null;

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const parts = text.split(",");
    if (parts.length > 2) {
      text = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    } else {
      text = text.replace(",", ".");
    }
  } else if (lastDot > -1 && text.split(".").length > 2) {
    const parts = text.split(".");
    text = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }

  const amount = Number(text);
  if (!Number.isFinite(amount)) return null;
  return negative ? -Math.abs(amount) : amount;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameScore(a: string, b: string): number {
  const wordsA = new Set(normalizeName(a).split(" ").filter((word) => word.length > 2));
  const wordsB = new Set(normalizeName(b).split(" ").filter((word) => word.length > 2));
  let score = 0;
  for (const word of wordsA) if (wordsB.has(word)) score++;
  return score;
}

export function parseBankCsv(input: string): BankCsvResult {
  const text = input.replace(/^\uFEFF/, "");
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { rows: [], errors: ["Het bestand is leeg."] };
  }

  const headerLine = lines[0];
  const delimiter =
    countDelimiter(headerLine, ";") >= countDelimiter(headerLine, ",") ? ";" : ",";
  const table = splitRows(text, delimiter);
  if (table.length < 2) {
    return { rows: [], errors: ["Geen datarijen gevonden onder de kopregel."] };
  }

  const headers = table[0].map(normalizeHeader);
  const columns: Partial<Record<ColumnKey, number>> = {};
  for (const key of Object.keys(HEADER_ALIASES) as ColumnKey[]) {
    const index = headers.findIndex((header) => HEADER_ALIASES[key].includes(header));
    if (index >= 0) columns[key] = index;
  }

  if (columns.datum === undefined || columns.bedrag === undefined) {
    return {
      rows: [],
      errors: [
        "Geen datum- en bedragkolom gevonden. Gebruik bijvoorbeeld de kolommen Datum, Bedrag, Tegenpartij en Omschrijving.",
      ],
    };
  }

  const rows: ParsedBankRow[] = [];
  for (let index = 1; index < table.length; index++) {
    if (rows.length >= 1000) {
      errors.push("Maximaal 1000 transacties per bestand; de rest is overgeslagen.");
      break;
    }
    const cells = table[index];
    const datum = parseDate(cells[columns.datum] ?? "");
    const bedrag = parseAmount(cells[columns.bedrag] ?? "");
    if (!datum) {
      errors.push(`Rij ${index + 1}: ongeldige datum.`);
      continue;
    }
    if (bedrag === null) {
      errors.push(`Rij ${index + 1}: ongeldig bedrag.`);
      continue;
    }
    rows.push({
      datum,
      bedrag: Math.round(bedrag * 100) / 100,
      tegenpartij:
        (columns.tegenpartij !== undefined ? cells[columns.tegenpartij] : "")?.trim() ||
        "Onbekende tegenpartij",
      omschrijving:
        (columns.omschrijving !== undefined ? cells[columns.omschrijving] : "")?.trim() || "",
      rekening:
        columns.rekening !== undefined ? cells[columns.rekening]?.trim() || undefined : undefined,
    });
  }

  return { rows, errors: errors.slice(0, 8) };
}

function hashKey(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash).toString(36);
}

export function toBankTransaction(row: ParsedBankRow): BankTransaction {
  const key = [
    row.datum,
    row.bedrag.toFixed(2),
    normalizeName(row.tegenpartij),
    normalizeName(row.omschrijving),
  ].join("|");
  return {
    id: `bank-${row.datum.replace(/-/g, "")}-${hashKey(key)}`,
    datum: row.datum,
    bedrag: row.bedrag,
    tegenpartij: row.tegenpartij,
    omschrijving: row.omschrijving,
    rekening: row.rekening,
    status: "open",
  };
}

export interface MatchingCandidate {
  invoice: Invoice;
  klantNaam: string;
  amount: number;
}

// Only exact amounts are offered, so matching never marks a partially paid invoice as paid.
export function matchingInvoices(
  transaction: BankTransaction,
  invoices: Invoice[],
  customers: Customer[]
): MatchingCandidate[] {
  if (transaction.bedrag <= 0) return [];
  return invoices
    .filter((invoice) => ["verzonden", "vervallen"].includes(invoiceState(invoice)))
    .map((invoice) => {
      const klant = customers.find((customer) => customer.id === invoice.klantId);
      return {
        invoice,
        klantNaam: klant?.naam || "Onbekende klant",
        amount: invoiceTotals(invoice).incl,
      };
    })
    .filter((candidate) => Math.abs(candidate.amount - transaction.bedrag) < 0.02)
    .sort((a, b) => {
      const score = nameScore(transaction.tegenpartij, b.klantNaam) -
        nameScore(transaction.tegenpartij, a.klantNaam);
      return score !== 0 ? score : a.invoice.vervaldatum < b.invoice.vervaldatum ? -1 : 1;
    });
}

export const SAMPLE_BANK_CSV = `Datum;Bedrag;Tegenpartij;Omschrijving;Rekening
2026-10-14;1996,50;Groenwerk Tuinen;Betaling factuur 2026-0019;NL12 RABO 0123 4567 89
2026-10-13;-29,95;Helder Boekhouding;Abonnement boekhoudsoftware;NL12 RABO 0123 4567 89
2026-10-12;640,00;Koffiebar Zwart;Losse ontvangst;NL12 RABO 0123 4567 89
`;
