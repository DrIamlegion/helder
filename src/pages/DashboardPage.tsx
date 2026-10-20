// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { StateBadge } from "../components/StateBadge";
import { openVatReminder, vatReport } from "../data";
import { useTitle } from "../hooks";
import {
  daysBetween,
  eur,
  fmtDate,
  fmtDateLong,
  invoiceState,
  invoiceTotals,
  monthShort,
  quarterRange,
  relativeDue,
  sum,
  todayISO,
} from "../lib";
import { useAppStore } from "../store";
import type { Invoice } from "../types";

const round2 = (n: number) => Math.round(n * 100) / 100;

function expenseExcl(u: { bedragIncl: number; btwTarief: number }) {
  const incl = Number(u.bedragIncl) || 0;
  const rate = Number(u.btwTarief) || 0;
  return round2(incl / (1 + rate / 100));
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

interface MonthPoint {
  key: string;
  label: string;
  revenue: number;
  cost: number;
}

function monthlySeries(invoices: Invoice[], expenses: { datum: string; bedragIncl: number; btwTarief: number }[], monthCount = 6): MonthPoint[] {
  const now = new Date();
  const months: MonthPoint[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: monthShort(date.getMonth()),
      revenue: 0,
      cost: 0,
    });
  }
  for (const factuur of invoices) {
    if (factuur.status === "concept") continue;
    const bucket = months.find((m) => m.key === factuur.datum.slice(0, 7));
    if (bucket) bucket.revenue += invoiceTotals(factuur).excl;
  }
  for (const uitgave of expenses) {
    const bucket = months.find((m) => m.key === uitgave.datum.slice(0, 7));
    if (bucket) bucket.cost += expenseExcl(uitgave);
  }
  months.forEach((m) => {
    m.revenue = round2(m.revenue);
    m.cost = round2(m.cost);
  });
  return months;
}

export function DashboardPage() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  useTitle("Overzicht");

  const today = todayISO();
  const year = new Date().getFullYear();
  const quarter = Math.floor(new Date().getMonth() / 3) + 1;
  const qRange = quarterRange(year, quarter);

  const quarterInvoices = state.facturen.filter(
    (f) => f.status !== "concept" && f.datum >= qRange.start && f.datum <= qRange.end
  );
  const quarterRevenue = sum(quarterInvoices, (f) => invoiceTotals(f).excl);

  const elapsed = daysBetween(qRange.start, today) + 1;
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevYear = quarter === 1 ? year - 1 : year;
  const prevRange = quarterRange(prevYear, prevQuarter);
  const prevCutoff = new Date(new Date(`${prevRange.start}T12:00:00`).getTime() + elapsed * 86400000);
  const prevCutoffISO = `${prevCutoff.getFullYear()}-${String(prevCutoff.getMonth() + 1).padStart(2, "0")}-${String(prevCutoff.getDate()).padStart(2, "0")}`;
  const prevRevenue = sum(
    state.facturen.filter(
      (f) => f.status !== "concept" && f.datum >= prevRange.start && f.datum <= prevCutoffISO
    ),
    (f) => invoiceTotals(f).excl
  );
  const growth = prevRevenue > 0 ? Math.round(((quarterRevenue - prevRevenue) / prevRevenue) * 100) : null;

  const openInvoices = state.facturen.filter((f) =>
    ["verzonden", "vervallen"].includes(invoiceState(f))
  );
  const openAmount = sum(openInvoices, (f) => invoiceTotals(f).incl);
  const overdue = openInvoices.filter((f) => invoiceState(f) === "vervallen");
  const overdueAmount = sum(overdue, (f) => invoiceTotals(f).incl);

  const ytdRevenue = sum(
    state.facturen.filter((f) => f.status !== "concept" && f.datum.startsWith(String(year))),
    (f) => invoiceTotals(f).excl
  );
  const ytdCosts = sum(
    state.uitgaven.filter((u) => u.datum.startsWith(String(year))),
    expenseExcl
  );
  const result = ytdRevenue - ytdCosts;

  const vat = vatReport(state, year, quarter);
  const openVat = openVatReminder(state);
  const proposals = state.herinneringen.filter(
    (reminder) => reminder.status === "concept" && !reminder.genegeerdOp
  );
  const recent = [...state.facturen]
    .sort((a, b) => (a.datum === b.datum ? b.nummer.localeCompare(a.nummer) : a.datum < b.datum ? 1 : -1))
    .slice(0, 5);

  const paidCount = state.facturen.filter((f) => f.status === "betaald").length;
  const sentCount = state.facturen.filter((f) => f.status !== "concept").length;
  const paidShare = sentCount ? Math.round((paidCount / sentCount) * 100) : 100;

  const months = monthlySeries(state.facturen, state.uitgaven);
  const max = Math.max(1000, ...months.map((m) => Math.max(m.revenue, m.cost)));
  const scale = (value: number) => Math.max(value > 0 ? 2 : 0, (value / max) * 100);
  const totalRevenue = sum(months, (m) => m.revenue);
  const totalCost = sum(months, (m) => m.cost);

  return (
    <>
      <div className="hello">
        <div>
          <h2>
            {greeting()}, {state.bedrijf.eigenaar.split(" ")[0]}
          </h2>
          <p>
            {fmtDateLong(today)} ·{" "}
            <span className="muted">
              {openInvoices.length} openstaande {openInvoices.length === 1 ? "factuur" : "facturen"},
              waarvan {overdue.length} te laat
            </span>
          </p>
        </div>
        <span className="chip">
          <Icon name="checkCircle" size={12} /> Automatisch opgeslagen
        </span>
      </div>

      <div className="kpi-grid">
        <Link className="card kpi" to="/facturen">
          <div className="kpi-label">
            <Icon name="euro" /> Omzet dit kwartaal
          </div>
          <div className="kpi-value">{eur(quarterRevenue, { cents: false })}</div>
          <div className="kpi-meta">
            {growth === null ? (
              <span>Eerste omzet dit kwartaal</span>
            ) : (
              <>
                <span className={`trend ${growth < 0 ? "down" : ""}`}>
                  <Icon name={growth < 0 ? "arrowDownRight" : "arrowUpRight"} size={12} />{" "}
                  {growth > 0 ? "+" : ""}
                  {growth}%
                </span>
                <span>
                  t.o.v. {prevYear}-Q{prevQuarter}
                </span>
              </>
            )}
          </div>
        </Link>

        <Link className="card kpi" to="/facturen">
          <div className="kpi-label">
            <Icon name="invoice" /> Openstaand
          </div>
          <div className="kpi-value">{eur(openAmount, { cents: false })}</div>
          <div className="kpi-meta">
            <span>
              {openInvoices.length} {openInvoices.length === 1 ? "factuur" : "facturen"}
            </span>
            {overdue.length > 0 ? (
              <>
                <span className="dot-sep">·</span>
                <span style={{ color: "var(--red)", fontWeight: 560 }}>
                  {eur(overdueAmount, { cents: false })} te laat
                </span>
              </>
            ) : null}
          </div>
        </Link>

        <Link className="card kpi" to="/btw">
          <div className="kpi-label">
            <Icon name="percent" /> Btw dit kwartaal
          </div>
          <div className="kpi-value">{eur(vat.saldo)}</div>
          <div className="kpi-meta">
            <span>{vat.saldo < 0 ? "Terug te ontvangen" : "Te betalen"}</span>
            <span className="dot-sep">·</span>
            <span>
              Q{quarter} {year}
            </span>
          </div>
        </Link>

        <Link className="card kpi" to="/uitgaven">
          <div className="kpi-label">
            <Icon name="sparkles" /> Resultaat dit jaar
          </div>
          <div className={`kpi-value ${result < 0 ? "neg" : ""}`}>
            {eur(result, { cents: false })}
          </div>
          <div className="kpi-meta">
            <span>{eur(ytdRevenue, { cents: false })} omzet</span>
            <span className="dot-sep">·</span>
            <span>{eur(ytdCosts, { cents: false })} kosten</span>
          </div>
        </Link>
      </div>

      <div className="dash-grid">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Omzet en kosten</h3>
                <div className="sub">Laatste 6 maanden, excl. btw</div>
              </div>
              <div className="right">
                <span className="legend">
                  <i className="rev" />
                  Omzet
                </span>
                <span className="legend">
                  <i className="cost" />
                  Kosten
                </span>
              </div>
            </div>
            <div className="chart-body">
              <div className="chart-plot">
                {months.map((month, index) => (
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
                    <span className={`chart-month ${index === months.length - 1 ? "on" : ""}`}>
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-foot">
              <span>
                Omzet laatste 6 maanden <strong>{eur(totalRevenue, { cents: false })}</strong>
              </span>
              <span>
                Kosten <strong>{eur(totalCost, { cents: false })}</strong>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Recente facturen</h3>
              <div className="right">
                <Link className="btn btn-ghost btn-sm" to="/facturen">
                  Alles bekijken <Icon name="arrowRight" size={13} />
                </Link>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Factuur</th>
                    <th>Datum</th>
                    <th>Status</th>
                    <th className="num">Bedrag</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((factuur) => {
                    const klant = state.relaties.find((r) => r.id === factuur.klantId);
                    const path = `/facturen/${factuur.id}`;
                    return (
                      <tr
                        className="clickable"
                        key={factuur.id}
                        tabIndex={0}
                        role="link"
                        aria-label={`Factuur ${factuur.nummer} van ${klant?.naam || "onbekende klant"}`}
                        onClick={() => navigate(path)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(path);
                          }
                        }}
                      >
                        <td>
                          <div className="strong">{factuur.nummer}</div>
                          <div className="cell-sub">{klant?.naam || "Onbekende klant"}</div>
                        </td>
                        <td className="muted nowrap">{fmtDate(factuur.datum, "medium")}</td>
                        <td>
                          <StateBadge state={invoiceState(factuur)} />
                        </td>
                        <td className="num strong">{eur(invoiceTotals(factuur).incl)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Openstaand</h3>
              <div className="right">
                <span className="chip">{paidShare}% betaald dit jaar</span>
              </div>
            </div>
            <div className="card-body" style={{ paddingBottom: 14 }}>
              <div className="amount-lg">{eur(openAmount)}</div>
              <div className="bar-track mt-12">
                <div
                  className="bar-fill"
                  style={{
                    width: `${paidShare}%`,
                    background: "linear-gradient(90deg,#0e8f68,#4cc79c)",
                  }}
                />
              </div>
              <div className="small muted mt-8">
                {openInvoices.length} facturen · {overdue.length} vervallen
              </div>
            </div>
            <div className="mini-list">
              {openInvoices.slice(0, 3).map((factuur) => {
                const klant = state.relaties.find((r) => r.id === factuur.klantId);
                const late = invoiceState(factuur) === "vervallen";
                return (
                  <Link className="mini-row" key={factuur.id} to={`/facturen/${factuur.id}`}>
                    <span className="mini-icon">
                      <Icon name="invoice" size={14} />
                    </span>
                    <span className="mini-main">
                      <span className="mini-title">{klant?.naam || "Onbekend"}</span>
                      <span className="mini-sub" style={late ? { color: "var(--red)" } : undefined}>
                        {relativeDue(factuur)}
                      </span>
                    </span>
                    <span className="mini-amount">{eur(invoiceTotals(factuur).incl)}</span>
                  </Link>
                );
              })}
              {openInvoices.length === 0 ? (
                <div className="empty" style={{ padding: "24px 16px" }}>
                  <p style={{ margin: 0 }}>Geen openstaande facturen.</p>
                </div>
              ) : null}
            </div>
            <div className="card-body" style={{ paddingTop: 12, paddingBottom: 16 }}>
              <Link className="link small" to="/facturen">
                Alle facturen <Icon name="arrowRight" size={12} />
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Snel aan de slag</h3>
            </div>
            <div className="quick-actions">
              <Link className="quick" to="/facturen/nieuw">
                <Icon name="plus" /> Nieuwe factuur <span className="kbd">N</span>
              </Link>
              <Link className="quick" to="/offertes/nieuw">
                <Icon name="fileText" /> Offerte maken <span className="kbd">O</span>
              </Link>
              <Link className="quick" to="/uitgaven?nieuw=1">
                <Icon name="receipt" /> Uitgave boeken
              </Link>
              <Link className="quick" to="/btw">
                <Icon name="percent" /> Btw-aangifte <span className="kbd">B</span>
              </Link>
              <Link className="quick" to="/klanten?nieuw=1">
                <Icon name="users" /> Klant toevoegen
              </Link>
              <Link className="quick" to="/producten?nieuw=1">
                <Icon name="package" /> Product toevoegen
              </Link>
            </div>
          </div>

          {proposals.length > 0 ? (
            <Link className="card vat-teaser" to="/aanmaningen">
              <span
                className="mini-icon"
                style={{ background: "#eaf1f9", borderColor: "#d5e4f3", color: "var(--blue)" }}
              >
                <Icon name="bell" size={15} />
              </span>
              <span className="grow">
                <strong>
                  {proposals.length} aanmaning{proposals.length === 1 ? "" : "en"} klaargezet
                </strong>
                <span className="small muted">
                  Helder stelde {proposals.length === 1 ? "een brief" : "brieven"} op voor vervallen
                  facturen. Controleer en verstuur {proposals.length === 1 ? "hem" : "ze"}.
                </span>
              </span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : null}

          {openVat ? (
            <Link className="card vat-teaser" to="/btw">
              <span
                className="mini-icon"
                style={{ background: "#fff4e2", borderColor: "#f2e0bf", color: "#a97016" }}
              >
                <Icon name="alert" size={15} />
              </span>
              <span className="grow">
                <strong>Btw-aangifte Q{openVat.quarter} staat open</strong>
                <span className="small muted">
                  {openVat.days === 0
                    ? "De deadline is vandaag"
                    : `Nog ${openVat.days} ${openVat.days === 1 ? "dag" : "dagen"} tot de deadline`}
                </span>
              </span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
