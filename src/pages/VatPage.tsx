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
  daysUntil,
  download,
  eur,
  fmtDate,
  vatDeadline,
} from "../lib";
import { useAppStore } from "../store";
import type { AppState } from "../types";

const QUARTER_NAMES = ["jan – mrt", "apr – jun", "jul – sep", "okt – dec"];

function defaultSelection(state: AppState): { year: number; quarter: number } {
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let year = currentYear - 1; year <= currentYear; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      if (!state.aangiftes[`${year}-Q${quarter}`] && daysUntil(vatDeadline(year, quarter)) >= 0) {
        return { year, quarter };
      }
    }
  }
  return { year: currentYear, quarter: Math.floor(now.getMonth() / 3) + 1 };
}

function deadlineText(year: number, quarter: number) {
  const deadline = vatDeadline(year, quarter);
  const days = daysUntil(deadline);
  if (days < 0) return { deadline, label: "Deadline verstreken", late: true };
  if (days === 0) return { deadline, label: "Deadline is vandaag", late: true };
  return { deadline, label: `Nog ${days} ${days === 1 ? "dag" : "dagen"}`, late: false };
}

export function VatPage() {
  const { state, markVat } = useAppStore();
  const toast = useToast();
  const initial = defaultSelection(state);
  const [year, setYear] = useState(initial.year);
  const [quarter, setQuarter] = useState(initial.quarter);

  useTitle("Btw-aangifte");

  const years = yearOptions(state);
  const report = vatReport(state, year, quarter);
  const deadline = deadlineText(year, quarter);
  const submitted = Boolean(report.aangifte);
  const toPay = report.saldo > 0;
  const saldoLabel = submitted
    ? "Aangifte ingediend"
    : toPay
      ? "Te betalen"
      : report.saldo < 0
        ? "Terug te ontvangen"
        : "Niets te betalen";

  function submit() {
    markVat(year, quarter, true);
    toast(`Btw-aangifte Q${quarter} gemarkeerd als ingediend`);
  }

  function unsubmit() {
    markVat(year, quarter, false);
    toast("Indiening ongedaan gemaakt");
  }

  function exportCsv() {
    const lines = [
      ["Rubriek", "Omschrijving", "Grondslag", "Btw"],
      ["1a", "Leveringen en diensten belast met 21%", report.base[21].toFixed(2), report.vat[21].toFixed(2)],
      ["1b", "Leveringen en diensten belast met 9%", report.base[9].toFixed(2), report.vat[9].toFixed(2)],
      ["1c", "Omzet met 0% of niet bij jou belast", report.base[0].toFixed(2), "0.00"],
      ["5a", "Verschuldigde omzetbelasting", "", report.verschuldigd.toFixed(2)],
      ["5b", "Voorbelasting", "", report.voorbelasting.toFixed(2)],
      ["5c", "Saldo", "", report.saldo.toFixed(2)],
    ].map((row) => row.map(csvEscape).join(";"));
    download(
      `btw-aangifte-${year}-Q${quarter}.csv`,
      "\uFEFF" + lines.join("\n"),
      "text/csv"
    );
    toast("Btw-overzicht geëxporteerd");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Btw-aangifte</h2>
          <p>Bereken je kwartaalcijfers en controleer ze vóór je ze doorgeeft.</p>
        </div>
        <div className="actions">
          <select
            className="select"
            style={{ width: 120 }}
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
            <Icon name="download" size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="q-grid">
        {[1, 2, 3, 4].map((option) => {
          const optionReport = vatReport(state, year, option);
          const done = Boolean(optionReport.aangifte);
          return (
            <button
              className={`q-btn ${option === quarter ? "on" : ""}`}
              type="button"
              key={option}
              onClick={() => setQuarter(option)}
            >
              <div className="q-name">
                Q{option} <span className="muted" style={{ fontWeight: 500 }}>{year}</span>
              </div>
              <div className="q-sub">{QUARTER_NAMES[option - 1]}</div>
              <div className="q-state">
                <span className={`badge ${done ? "badge-green" : "badge-gray"}`}>
                  {done ? "Ingediend" : "Open"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="vat-hero">
        <div>
          <div className="label">
            {saldoLabel} · Q{quarter} {year}
          </div>
          <div className="amount">{eur(Math.abs(report.saldo))}</div>
          <div className="desc">
            Saldo van verschuldigde btw ({eur(report.verschuldigd)}) en voorbelasting (
            {eur(report.voorbelasting)}) over {QUARTER_NAMES[quarter - 1]} {year}.
          </div>
        </div>
        <div className="right">
          {submitted ? (
            <span className="pill">
              <Icon name="checkCircle" size={12} /> Ingediend op {fmtDate(report.aangifte!.ingediendOp)}
            </span>
          ) : (
            <>
              <span className="pill">
                <Icon name="calendar" size={12} /> Deadline {fmtDate(deadline.deadline)}
              </span>
              <span className="pill">
                <Icon name="clock" size={12} /> {deadline.label}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="vat-layout mt-16">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Berekening</h3>
              <div className="sub">Bedragen excl. btw, tenzij anders vermeld</div>
            </div>
            <div className="right">
              <span className={`badge ${submitted ? "badge-green" : "badge-amber"}`}>
                {submitted ? "Ingediend" : "Concept-aangifte"}
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table vat-table">
              <thead>
                <tr>
                  <th />
                  <th>Rubriek</th>
                  <th className="num">Grondslag</th>
                  <th className="num">Btw</th>
                </tr>
              </thead>
              <tbody>
                <tr className="section">
                  <td colSpan={4}>Omzet</td>
                </tr>
                <tr>
                  <td className="code">1a</td>
                  <td>Leveringen en diensten belast met 21%</td>
                  <td className="num">{eur(report.base[21])}</td>
                  <td className="num">{eur(report.vat[21])}</td>
                </tr>
                <tr>
                  <td className="code">1b</td>
                  <td>Leveringen en diensten belast met 9%</td>
                  <td className="num">{eur(report.base[9])}</td>
                  <td className="num">{eur(report.vat[9])}</td>
                </tr>
                <tr>
                  <td className="code">1c</td>
                  <td>Omzet met 0% of niet bij jou belast</td>
                  <td className="num">{eur(report.base[0])}</td>
                  <td className="num">{eur(0)}</td>
                </tr>
                <tr className="total-row">
                  <td className="code">5a</td>
                  <td>Verschuldigde omzetbelasting</td>
                  <td className="num" />
                  <td className="num">{eur(report.verschuldigd)}</td>
                </tr>
                <tr className="section">
                  <td colSpan={4}>Inkoop</td>
                </tr>
                <tr>
                  <td className="code">5b</td>
                  <td>Voorbelasting over inkopen en kosten</td>
                  <td className="num muted">{report.uitgaven.length} uitgaven</td>
                  <td className="num">− {eur(report.voorbelasting)}</td>
                </tr>
                <tr className="grand">
                  <td className="code">5c</td>
                  <td>
                    Saldo —{" "}
                    {toPay ? "te betalen" : report.saldo < 0 ? "terug te ontvangen" : "nul"}
                  </td>
                  <td className="num" />
                  <td className="num">{eur(Math.abs(report.saldo))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="vat-foot">
            <Icon name="info" size={14} />
            <span>
              Dit is een hulpmiddel, geen officiële aangifte. Controleer de cijfers altijd in Mijn
              Belastingdienst.
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card card-pad">
            <div className="row-between">
              <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Aangifte Q{quarter}</h3>
              <span className={`badge ${submitted ? "badge-green" : "badge-gray"}`}>
                {submitted ? "Ingediend" : "Open"}
              </span>
            </div>
            <p className="small muted mt-8">
              {submitted ? (
                <>Je hebt deze aangifte op {fmtDate(report.aangifte!.ingediendOp)} gemarkeerd als ingediend.</>
              ) : deadline.late ? (
                "De wettelijke deadline is verstreken. Dien je aangifte zo snel mogelijk in."
              ) : (
                `Je hebt nog ${Math.max(0, daysUntil(deadline.deadline))} dagen om deze aangifte in te dienen.`
              )}
            </p>
            <div className="divider mt-16" />
            <div className="row-between mt-12 small">
              <span className="muted">Deadline</span>
              <strong>{fmtDate(deadline.deadline)}</strong>
            </div>
            <div className="row-between mt-8 small">
              <span className="muted">Omzet in kwartaal</span>
              <strong>{eur(report.omzetTotaal.excl)}</strong>
            </div>
            <div className="row-between mt-8 small">
              <span className="muted">Btw over omzet</span>
              <strong>{eur(report.verschuldigd)}</strong>
            </div>
            {submitted ? (
              <button className="btn mt-16" style={{ width: "100%" }} type="button" onClick={unsubmit}>
                Indiening ongedaan maken
              </button>
            ) : (
              <button className="btn btn-primary mt-16" style={{ width: "100%" }} type="button" onClick={submit}>
                <Icon name="check" size={15} /> Markeer als ingediend
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Onderbouwing</h3>
            </div>
            <div className="mini-list">
              <Link className="mini-row" to="/facturen?status=open">
                <span className="mini-icon">
                  <Icon name="invoice" size={14} />
                </span>
                <span className="mini-main">
                  <span className="mini-title">{report.facturen.length} verkoopfacturen</span>
                  <span className="mini-sub">
                    {fmtDate(report.start, "medium")} – {fmtDate(report.end, "medium")}
                  </span>
                </span>
                <span className="mini-amount">{eur(report.omzetTotaal.excl, { cents: false })}</span>
              </Link>
              <Link className="mini-row" to="/uitgaven">
                <span className="mini-icon">
                  <Icon name="receipt" size={14} />
                </span>
                <span className="mini-main">
                  <span className="mini-title">{report.uitgaven.length} uitgaven</span>
                  <span className="mini-sub">btw terug te vorderen</span>
                </span>
                <span className="mini-amount">{eur(report.voorbelasting)}</span>
              </Link>
            </div>
          </div>

          <div className="alert alert-info">
            <Icon name="info" size={16} />
            <span>
              Werk je met de KOR of verlegde btw? Die situaties zijn in deze demo nog niet
              meegenomen.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
