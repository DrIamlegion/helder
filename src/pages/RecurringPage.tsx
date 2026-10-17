// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import {
  eur,
  fmtDate,
  intervalLabel,
  intervalPerYear,
  invoiceTotals,
  todayISO,
} from "../lib";
import { useAppStore } from "../store";
import type { RecurringInvoice } from "../types";

export function RecurringPage() {
  const { state, saveRecurring, deleteRecurring, runRecurringNow } = useAppStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<RecurringInvoice | null>(null);

  useTitle("Terugkerende facturen");

  const rows = [...state.herhalingen]
    .sort((a, b) =>
      a.actief === b.actief
        ? a.volgendeDatum < b.volgendeDatum
          ? -1
          : 1
        : a.actief
          ? -1
          : 1
    )
    .map((rule) => ({
      rule,
      klant: state.relaties.find((relatie) => relatie.id === rule.klantId),
      totals: invoiceTotals(rule),
    }));

  const active = rows.filter((row) => row.rule.actief);
  const next = active[0];
  const yearly = active.reduce(
    (total, row) => total + row.totals.incl * intervalPerYear(row.rule.interval),
    0
  );

  function toggle(rule: RecurringInvoice) {
    const created = saveRecurring({ ...rule, actief: !rule.actief });
    toast(
      rule.actief
        ? "Herhaling gepauzeerd"
        : created > 0
          ? `Herhaling geactiveerd · ${created} conceptfactuur aangemaakt`
          : "Herhaling geactiveerd"
    );
  }

  function runNow(rule: RecurringInvoice) {
    const created = runRecurringNow(rule.id);
    toast(
      created > 0
        ? "Conceptfactuur aangemaakt — je vindt hem bij Facturen"
        : "Deze herhaling is niet actief"
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteRecurring(deleting.id);
    toast("Herhaling verwijderd");
    setDeleting(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Terugkerende facturen</h2>
          <p>Plan vaste facturen en laat Helder automatisch concepten klaarzetten.</p>
        </div>
        <div className="actions">
          <Link className="btn btn-primary" to="/herhalingen/nieuw">
            <Icon name="plus" size={15} /> Nieuwe herhaling
          </Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="refresh" /> Actieve herhalingen
          </div>
          <div className="kpi-value">{active.length}</div>
          <div className="kpi-meta">
            <span>
              {state.herhalingen.length - active.length} gepauzeerd
            </span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="calendar" /> Eerstvolgende
          </div>
          <div className="kpi-value" style={{ fontSize: 21 }}>
            {next ? fmtDate(next.rule.volgendeDatum, "medium") : "—"}
          </div>
          <div className="kpi-meta">
            <span>{next ? next.rule.naam : "Geen actieve herhalingen"}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="euro" /> Jaarlijkse waarde
          </div>
          <div className="kpi-value">{eur(yearly, { cents: false })}</div>
          <div className="kpi-meta">
            <span>op basis van het huidige interval</span>
          </div>
        </div>
      </div>

      <div className="alert alert-info mb-16">
        <Icon name="info" size={16} />
        <span>
          Op de geplande datum maakt Helder automatisch een conceptfactuur. Je controleert en
          verstuurt hem daarna zelf — er gaat niets ongezien de deur uit.
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Herhaling</th>
                <th>Klant</th>
                <th>Interval</th>
                <th>Volgende factuur</th>
                <th>Status</th>
                <th className="num">Bedrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ rule, klant, totals }) => (
                <tr key={rule.id}>
                  <td>
                    <div className="cell-main">
                      <span className="doc-icon">
                        <Icon name="refresh" size={15} />
                      </span>
                      <span>
                        <Link className="strong link" to={`/herhalingen/${rule.id}/bewerken`}>
                          {rule.naam}
                        </Link>
                        <span className="cell-sub">
                          {rule.regels.length} {rule.regels.length === 1 ? "regel" : "regels"} ·{" "}
                          {rule.termijn} dagen betaaltermijn
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="muted">{klant?.naam || "Onbekende klant"}</td>
                  <td>{intervalLabel(rule.interval)}</td>
                  <td className="nowrap">
                    <div>{fmtDate(rule.volgendeDatum, "medium")}</div>
                    <div className="cell-sub">
                      {!rule.actief
                        ? "Gepauzeerd — geen concepten"
                        : rule.eindDatum
                          ? `Loopt tot ${fmtDate(rule.eindDatum, "medium")}`
                          : rule.volgendeDatum <= todayISO()
                            ? "Concept wordt aangemaakt"
                            : "Automatisch concept"}
                    </div>
                  </td>
                  <td>
                    <button
                      className={`badge badge-button ${rule.actief ? "badge-green" : "badge-gray"}`}
                      type="button"
                      onClick={() => toggle(rule)}
                      title={rule.actief ? "Herhaling pauzeren" : "Herhaling activeren"}
                    >
                      {rule.actief ? "Actief" : "Gepauzeerd"}
                    </button>
                  </td>
                  <td className="num strong">
                    {eur(totals.incl)}
                    <span className="cell-sub">per keer</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        type="button"
                        onClick={() => runNow(rule)}
                        title="Nu een conceptfactuur aanmaken"
                        aria-label={`Nu factureren voor ${rule.naam}`}
                      >
                        <Icon name="send" size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        type="button"
                        onClick={() => navigate(`/herhalingen/${rule.id}/bewerken`)}
                        title="Herhaling bewerken"
                        aria-label={`${rule.naam} bewerken`}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        type="button"
                        onClick={() => setDeleting(rule)}
                        title="Herhaling verwijderen"
                        aria-label={`${rule.naam} verwijderen`}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="table-empty">
            <div className="empty">
              <div className="empty-icon">
                <Icon name="refresh" size={19} />
              </div>
              <h4>Nog geen terugkerende facturen</h4>
              <p>Plan een vaste factuur, bijvoorbeeld voor onderhoud of een abonnement.</p>
              <Link className="btn btn-primary" to="/herhalingen/nieuw">
                <Icon name="plus" size={15} /> Nieuwe herhaling
              </Link>
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            {rows.length} {rows.length === 1 ? "herhaling" : "herhalingen"} ·{" "}
            {active.length} actief
          </span>
          <span className="small muted">Concepten verschijnen bij Facturen met status Concept.</span>
        </div>
      </div>

      {deleting ? (
        <ConfirmDialog
          title={`${deleting.naam} verwijderen?`}
          message="De planning wordt verwijderd. Al automatisch aangemaakte conceptfacturen blijven bestaan."
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
