// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { vatReport, yearOptions } from "../data";
import { useTitle } from "../hooks";
import {
  csvEscape,
  daysBetween,
  daysUntil,
  download,
  eur,
  expenseParts,
  invoiceState,
  invoiceTotals,
  monthShort,
  sum,
  todayISO,
  vatDeadline,
} from "../lib";
import { useAppStore } from "../store";
import type { Expense, Invoice } from "../types";

const round2 = (value: number) => Math.round(value * 100) / 100;

interface MonthPoint {
  key: string;
  label: string;
  revenue: number;
  cost: number;
}

function monthlySeries(
  invoices: Invoice[],
  expenses: Expense[],
  year: number
): MonthPoint[] {
  const months: MonthPoint[] = [];
  for (let month = 0; month < 12; month++) {
    months.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: monthShort(month),
      revenue: 0,
      cost: 0,
    });
  }
  for (const invoice of invoices) {
    if (invoice.status === "concept") continue;
    const bucket = months.find((month) => month.key === invoice.datum.slice(0, 7));
    if (bucket) bucket.revenue += invoiceTotals(invoice).excl;
  }
  for (const expense of expenses) {
    const bucket = months.find((month) => month.key === expense.datum.slice(0, 7));
    if (bucket) bucket.cost += expenseParts(expense).excl;
  }
  months.forEach((month) => {
    month.revenue = round2(month.revenue);
    month.cost = round2(month.cost);
  });
  return months;
}

const AGING_BUCKETS = [
  { label: "Niet vervallen", min: Number.NEGATIVE_INFINITY, max: 0 },
  { label: "1–30 dagen", min: 1, max: 30 },
  { label: "31–60 dagen", min: 31, max: 60 },
  { label: "61–90 dagen", min: 61, max: 90 },
  { label: "Meer dan 90 dagen", min: 91, max: Number.POSITIVE_INFINITY },
];

interface AgingRow {
  label: string;
  count: number;
  amount: number;
  share: number;
}

export function ReportsPage() {
  const { state } = useAppStore();
  const toast = useToast();
  const years = yearOptions(state);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const today = todayISO();

  useTitle("Rapporten");

  const yearInvoices = state.facturen.filter(
    (invoice) => invoice.status !== "concept" && invoice.datum.startsWith(String(year))
  );
  const yearExpenses = state.uitgaven.filter((expense) => expense.datum.startsWith(String(year)));

  const revenue = round2(sum(yearInvoices, (invoice) => invoiceTotals(invoice).excl));
  const costs = round2(sum(yearExpenses, (expense) => expenseParts(expense).excl));
  const result = round2(revenue - costs);
  const margin = revenue > 0 ? Math.round((result / revenue) * 100) : null;

  const openInvoices = state.facturen.filter((invoice) =>
    ["verzonden", "vervallen"].includes(invoiceState(invoice))
  );
  const openAmount = round2(sum(openInvoices, (invoice) => invoiceTotals(invoice).incl));
  const overdueAmount = round2(
    sum(
      openInvoices.filter((invoice) => invoiceState(invoice) === "vervallen"),
      (invoice) => invoiceTotals(invoice).incl
    )
  );

  const months = monthlySeries(state.facturen, state.uitgaven, year);
  const chartMax = Math.max(1000, ...months.map((month) => Math.max(month.revenue, month.cost)));
  const scale = (value: number) => Math.max(value > 0 ? 2 : 0, (value / chartMax) * 100);

  const agingRows: AgingRow[] = AGING_BUCKETS.map((bucket) => {
    const matching = openInvoices.filter((invoice) => {
      const days = daysBetween(invoice.vervaldatum, today);
      return days >= bucket.min && days <= bucket.max;
    });
    const amount = round2(sum(matching, (invoice) => invoiceTotals(invoice).incl));
    return {
      label: bucket.label,
      count: matching.length,
      amount,
      share: openAmount > 0 ? (amount / openAmount) * 100 : 0,
    };
  });

  const customerTotals = new Map<string, { revenue: number; amount: number; count: number }>();
  for (const invoice of yearInvoices) {
    const current = customerTotals.get(invoice.klantId) ?? { revenue: 0, amount: 0, count: 0 };
    current.revenue += invoiceTotals(invoice).excl;
    current.count += 1;
    customerTotals.set(invoice.klantId, current);
  }
  for (const invoice of openInvoices) {
    const current = customerTotals.get(invoice.klantId);
    if (current) current.amount += invoiceTotals(invoice).incl;
  }
  const customerRows = state.relaties
    .map((customer) => ({
      id: customer.id,
      naam: customer.naam,
      ...(customerTotals.get(customer.id) ?? { revenue: 0, amount: 0, count: 0 }),
    }))
    .filter((row) => row.revenue > 0 || row.amount > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const topCustomers = customerRows.slice(0, 8);
  const otherCustomers = customerRows.slice(8);
  const otherRevenue = round2(sum(otherCustomers, (row) => row.revenue));
  const otherOpen = round2(sum(otherCustomers, (row) => row.amount));
  const topMax = Math.max(1, ...topCustomers.map((row) => row.revenue));

  const quarters = [1, 2, 3, 4].map((quarter) => {
    const report = vatReport(state, year, quarter);
    const submission = state.aangiftes[`${year}-Q${quarter}`];
    const deadline = vatDeadline(year, quarter);
    const late = !submission && daysUntil(deadline) < 0;
    return {
      quarter,
      omzet: report.omzetTotaal.excl,
      verschuldigd: report.verschuldigd,
      voorbelasting: report.voorbelasting,
      saldo: report.saldo,
      deadline,
      submission,
      late,
    };
  });

  function exportCsv() {
    const rows: string[][] = [
      ["Rapport", "Boekjaar", String(year)],
      [],
      ["Samenvatting", "Bedrag"],
      ["Omzet excl. btw", revenue.toFixed(2)],
      ["Kosten excl. btw", costs.toFixed(2)],
      ["Resultaat", result.toFixed(2)],
      ["Openstaand incl. btw", openAmount.toFixed(2)],
      ["Waarvan vervallen", overdueAmount.toFixed(2)],
      [],
      ["Omzet per maand", "Omzet excl. btw", "Kosten excl. btw"],
      ...months.map((month) => [month.label, month.revenue.toFixed(2), month.cost.toFixed(2)]),
      [],
      ["Ouderdomsanalyse", "Aantal", "Bedrag incl. btw"],
      ...agingRows.map((row) => [row.label, String(row.count), row.amount.toFixed(2)]),
      [],
      ["Top klanten", "Omzet excl. btw", "Facturen", "Openstaand incl. btw"],
      ...topCustomers.map((row) => [
        row.naam,
        row.revenue.toFixed(2),
        String(row.count),
        row.amount.toFixed(2),
      ]),
      ...(otherCustomers.length > 0
        ? [["Overige klanten", otherRevenue.toFixed(2), "", otherOpen.toFixed(2)]]
        : []),
      [],
      ["Btw per kwartaal", "Omzet excl. btw", "Verschuldigd", "Voorbelasting", "Saldo", "Status"],
      ...quarters.map((quarter) => [
        `Q${quarter.quarter}`,
        quarter.omzet.toFixed(2),
        quarter.verschuldigd.toFixed(2),
        quarter.voorbelasting.toFixed(2),
        quarter.saldo.toFixed(2),
        quarter.submission ? "Ingediend" : quarter.late ? "Te laat" : "Open",
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\r\n");
    download(`helder-rapport-${year}.csv`, "\uFEFF" + csv, "text/csv");
    toast(`Rapport ${year} gedownload`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Rapporten</h2>
          <p>Omzet, openstaand en btw per boekjaar — klaar om te delen met je accountant.</p>
        </div>
        <div className="actions">
          <select
            className="select"
            style={{ width: 118 }}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Boekjaar"
          >
            {years.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
          <button className="btn" type="button" onClick={exportCsv}>
            <Icon name="download" size={15} /> Exporteer CSV
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="euro" /> Omzet {year}
          </div>
          <div className="kpi-value">{eur(revenue, { cents: false })}</div>
          <div className="kpi-meta">
            <span>{yearInvoices.length} facturen excl. btw</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="receipt" /> Kosten {year}
          </div>
          <div className="kpi-value">{eur(costs, { cents: false })}</div>
          <div className="kpi-meta">
            <span>{yearExpenses.length} uitgaven excl. btw</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="sparkles" /> Resultaat
          </div>
          <div className={`kpi-value ${result < 0 ? "neg" : ""}`}>
            {eur(result, { cents: false })}
          </div>
          <div className="kpi-meta">
            <span>{margin === null ? "Nog geen omzet" : `${margin}% marge`}</span>
          </div>
        </div>
        <Link className="card kpi" to="/facturen">
          <div className="kpi-label">
            <Icon name="invoice" /> Openstaand
          </div>
          <div className="kpi-value">{eur(openAmount, { cents: false })}</div>
          <div className="kpi-meta">
            <span>{openInvoices.length} facturen</span>
            {overdueAmount > 0 ? (
              <>
                <span className="dot-sep">·</span>
                <span style={{ color: "var(--red)", fontWeight: 560 }}>
                  {eur(overdueAmount, { cents: false })} te laat
                </span>
              </>
            ) : null}
          </div>
        </Link>
      </div>

      <div className="card mt-16">
        <div className="card-head">
          <div>
            <h3>Omzet en kosten per maand</h3>
            <div className="sub">{year} · excl. btw</div>
          </div>
          <div className="right">
            <span className="legend">
              <i className="rev" /> Omzet
            </span>
            <span className="legend">
              <i className="cost" /> Kosten
            </span>
          </div>
        </div>
        <div className="chart-body">
          <div className="chart-plot">
            {months.map((month) => (
              <div className="chart-col" key={month.key}>
                <div className="chart-pair">
                  <span
                    className="chart-bar2 rev"
                    style={{ height: `${scale(month.revenue)}%` }}
                    title={`Omzet ${month.label}: ${eur(month.revenue)}`}
                  />
                  <span
                    className="chart-bar2 cost"
                    style={{ height: `${scale(month.cost)}%` }}
                    title={`Kosten ${month.label}: ${eur(month.cost)}`}
                  />
                </div>
                <span className="chart-month">{month.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-foot">
          <span>
            Omzet <strong>{eur(revenue, { cents: false })}</strong>
          </span>
          <span>
            Kosten <strong>{eur(costs, { cents: false })}</strong>
          </span>
          <span>
            Resultaat <strong>{eur(result, { cents: false })}</strong>
          </span>
        </div>
      </div>

      <div className="report-grid mt-16">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Ouderdomsanalyse</h3>
              <div className="sub">Alle openstaande facturen, naar dagen te laat</div>
            </div>
            <div className="right">
              <span className="chip">{eur(openAmount)}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th className="num">Facturen</th>
                  <th className="num">Bedrag</th>
                  <th>Aandeel</th>
                </tr>
              </thead>
              <tbody>
                {agingRows.map((row) => (
                  <tr key={row.label}>
                    <td className="strong">{row.label}</td>
                    <td className="num muted">{row.count}</td>
                    <td className="num strong">{eur(row.amount)}</td>
                    <td style={{ minWidth: 120 }}>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.max(row.share > 0 ? 2 : 0, row.share)}%`,
                            background: row.label === "Niet vervallen" ? "var(--brand)" : "var(--amber)",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="list-foot">
            <span className="small muted">
              {openInvoices.length} openstaande {openInvoices.length === 1 ? "factuur" : "facturen"}
            </span>
            <Link className="link small" to="/facturen">
              Naar facturen <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3>Top klanten</h3>
              <div className="sub">Omzet {year} excl. btw</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th className="num">Omzet</th>
                  <th className="num">Open</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="strong" to={`/facturen?klant=${row.id}`}>
                        {row.naam}
                      </Link>
                      <div className="bar-track mt-8" style={{ maxWidth: 150 }}>
                        <div
                          className="bar-fill"
                          style={{ width: `${Math.max(2, (row.revenue / topMax) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="num strong">{eur(row.revenue, { cents: false })}</td>
                    <td className={`num ${row.amount > 0 ? "" : "muted"}`}>
                      {row.amount > 0 ? eur(row.amount, { cents: false }) : "—"}
                    </td>
                  </tr>
                ))}
                {topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Nog geen omzet in {year}.
                    </td>
                  </tr>
                ) : null}
                {otherCustomers.length > 0 ? (
                  <tr>
                    <td className="muted">Overige klanten ({otherCustomers.length})</td>
                    <td className="num">{eur(otherRevenue, { cents: false })}</td>
                    <td className="num muted">
                      {otherOpen > 0 ? eur(otherOpen, { cents: false }) : "—"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="list-foot">
            <span className="small muted">Open bedrag is inclusief btw.</span>
            <Link className="link small" to="/klanten">
              Alle klanten <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </div>
      </div>

      <div className="card mt-16">
        <div className="card-head">
          <div>
            <h3>Btw per kwartaal</h3>
            <div className="sub">Verschuldigd, voorbelasting en saldo {year}</div>
          </div>
          <div className="right">
            <Link className="btn btn-ghost btn-sm" to="/btw">
              Btw-aangifte <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kwartaal</th>
                <th className="num">Omzet excl.</th>
                <th className="num">Verschuldigd</th>
                <th className="num">Voorbelasting</th>
                <th className="num">Saldo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quarters.map((quarter) => (
                <tr key={quarter.quarter}>
                  <td>
                    <div className="strong">Q{quarter.quarter}</div>
                    <div className="cell-sub">deadline {fmtShort(quarter.deadline)}</div>
                  </td>
                  <td className="num">{eur(quarter.omzet)}</td>
                  <td className="num">{eur(quarter.verschuldigd)}</td>
                  <td className="num">{eur(quarter.voorbelasting)}</td>
                  <td className={`num strong ${quarter.saldo < 0 ? "text-green" : ""}`}>
                    {eur(quarter.saldo)}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        quarter.submission
                          ? "badge-green"
                          : quarter.late
                            ? "badge-red"
                            : "badge-gray"
                      }`}
                    >
                      {quarter.submission ? "Ingediend" : quarter.late ? "Te laat" : "Open"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="list-foot">
          <span className="small muted">
            Een negatief saldo betekent terug te ontvangen. Dit rapport is geen fiscale aangifte.
          </span>
          <span className="small muted">Bedragen in euro's</span>
        </div>
      </div>
    </>
  );
}

function fmtShort(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${monthShort((month || 1) - 1)}`;
}
