// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/Modal";
import { Icon } from "../components/Icon";
import { InvoiceDocument } from "../components/InvoiceDocument";
import { StateBadge } from "../components/StateBadge";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import {
  addDays,
  eur,
  fmtDate,
  fmtDateTime,
  invoiceState,
  invoiceTotals,
  nextInvoiceNumber,
  todayISO,
  uid,
} from "../lib";
import {
  activePaymentPlan,
  intervalKort,
  volgendeTermijn,
} from "../paymentPlans";
import { plannedReminder, reminderLetterPath, reminderLevelInfo } from "../reminders";
import { useAppStore } from "../store";
import type { Invoice } from "../types";

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, saveInvoice, deleteInvoice } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const invoice = state.facturen.find((f) => f.id === id);
  const klant = state.relaties.find((r) => r.id === invoice?.klantId);
  const totals = invoice ? invoiceTotals(invoice) : null;
  const display = invoice ? invoiceState(invoice) : "concept";

  useTitle(invoice ? `Factuur ${invoice.nummer}` : "Factuur");

  if (!invoice || !totals) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="alert" size={19} />
          </div>
          <h4>Niet gevonden</h4>
          <p>Deze factuur bestaat niet meer.</p>
          <Link className="btn btn-primary" to="/facturen">
            Naar facturen
          </Link>
        </div>
      </div>
    );
  }

  const plan = plannedReminder(invoice, state.herinneringen);
  const regeling = activePaymentPlan(state.betaalregelingen, invoice.id);
  const volgende = regeling ? volgendeTermijn(regeling) : undefined;

  const setStatus = (status: Invoice["status"], message: string) => {
    saveInvoice({
      ...invoice,
      status,
      betaaldOp: status === "betaald" ? todayISO() : undefined,
    });
    toast(message);
  };

  const duplicate = () => {
    const copy: Invoice = {
      ...invoice,
      id: `inv-${Date.now()}`,
      nummer: nextInvoiceNumber(state.facturen, new Date().getFullYear()),
      datum: todayISO(),
      vervaldatum: addDays(todayISO(), state.bedrijf.betaaltermijn || 14),
      status: "concept",
      betaaldOp: undefined,
      regels: invoice.regels.map((regel) => ({ ...regel, id: uid() })),
    };
    saveInvoice(copy);
    toast(`Kopie aangemaakt als ${copy.nummer}`);
    navigate(`/facturen/${copy.id}/bewerken`);
  };

  const remove = () => {
    deleteInvoice(invoice.id);
    toast("Factuur verwijderd");
    navigate("/facturen");
  };

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link className="back-link" to="/facturen">
            <Icon name="arrowLeft" size={13} /> Facturen
          </Link>
          <h2>
            Factuur {invoice.nummer} <StateBadge state={display} />
          </h2>
          <p>
            {klant?.naam || "Onbekende klant"} · {fmtDate(invoice.datum)} · {eur(totals.incl)}
          </p>
        </div>
        <div className="actions">
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            onClick={() => setConfirmingDelete(true)}
            title="Factuur verwijderen"
            aria-label="Factuur verwijderen"
          >
            <Icon name="trash" size={16} />
          </button>
          <button className="btn" type="button" onClick={duplicate}>
            <Icon name="copy" size={14} /> Dupliceren
          </button>
          <Link className="btn" to={`/facturen/${invoice.id}/bewerken`}>
            <Icon name="edit" size={14} /> Bewerken
          </Link>
          <button className="btn" type="button" onClick={() => window.print()}>
            <Icon name="printer" size={14} /> Print / PDF
          </button>
          {display === "betaald" ? (
            <button className="btn" type="button" onClick={() => setStatus("verzonden", "Factuur staat weer open")}>
              <Icon name="refresh" size={14} /> Markeer onbetaald
            </button>
          ) : display === "concept" ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setStatus("verzonden", "Factuur gemarkeerd als verzonden")}
            >
              <Icon name="send" size={14} /> Markeer als verzonden
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setStatus("betaald", "Factuur gemarkeerd als betaald")}
            >
              <Icon name="check" size={14} /> Markeer betaald
            </button>
          )}
        </div>
      </div>

      <div className="paper-wrap">
        <InvoiceDocument invoice={invoice} company={state.bedrijf} customer={klant} />
      </div>

      {display !== "concept" ? (
        <div className="card mt-16 no-print">
          <div className="card-head">
            <div>
              <h3>Herinneringen en aanmaningen</h3>
              <div className="sub">
                {regeling
                  ? `Betaalregeling loopt: ${regeling.termijnen} termijnen van ${eur(regeling.bedragPerTermijn)}`
                  : plan.concept
                    ? `${reminderLevelInfo(plan.concept.niveau).label} klaargezet door Helder`
                    : plan.verstuurd.length === 0
                      ? "Er is nog geen brief voor deze factuur verstuurd."
                      : `${plan.verstuurd.length} brief${plan.verstuurd.length === 1 ? "" : "ven"} verstuurd`}
              </div>
            </div>
            <div className="right">
              {regeling ? (
                <span className="chip">
                  <Icon name="calendar" size={12} /> Aanmaningen gepauzeerd
                </span>
              ) : display === "vervallen" ? (
                <Link className="btn btn-sm" to={reminderLetterPath(invoice.id, plan)}>
                  <Icon name="send" size={13} />{" "}
                  {reminderLevelInfo(plan.concept?.niveau ?? plan.niveau).label}{" "}
                  {plan.concept ? "bekijken" : "opstellen"}
                </Link>
              ) : (
                <span className="chip">
                  <Icon name="clock" size={12} /> Nog niet vervallen
                </span>
              )}
            </div>
          </div>
          <div className="mini-list">
            {regeling ? (
              <div className="mini-row" key={regeling.id}>
                <span className="mini-icon">
                  <Icon name="calendar" size={14} />
                </span>
                <span className="mini-main">
                  <span className="mini-title">
                    Betaalregeling: {regeling.termijnen} × {eur(regeling.bedragPerTermijn)}
                  </span>
                  <span className="mini-sub">
                    {intervalKort(regeling.intervalDagen).toLowerCase()} ·{" "}
                    {volgende
                      ? `volgende termijn ${fmtDate(volgende.datum, "medium")}`
                      : "alle termijnen zijn vervallen"}
                    {regeling.geaccepteerdOp
                      ? ` · akkoord ${fmtDateTime(regeling.geaccepteerdOp)}`
                      : " · wacht op akkoord van de klant"}
                  </span>
                </span>
                <span className="badge badge-green">
                  {regeling.geaccepteerdOp ? "Geaccepteerd" : "Regeling"}
                </span>
              </div>
            ) : null}
            {plan.concept ? (
              <div className="mini-row" key={plan.concept.id}>
                <span className="mini-icon">
                  <Icon name="clock" size={14} />
                </span>
                <span className="mini-main">
                  <span className="mini-title">
                    {reminderLevelInfo(plan.concept.niveau).label} klaargezet
                  </span>
                  <span className="mini-sub">
                    Klaargezet op {fmtDate(plan.concept.aangemaaktOp, "medium")} · nog niet verstuurd
                  </span>
                </span>
                <span className="badge badge-amber">Klaargezet</span>
              </div>
            ) : null}
            {plan.verstuurd.length === 0 && !plan.concept ? (
              <div className="empty" style={{ padding: "22px 16px" }}>
                <p style={{ margin: 0 }}>
                  {display === "vervallen"
                    ? "Maak een herinnering of aanmaning zodra je de klant aan de betaling wilt helpen herinneren."
                    : "Zodra de factuur over de vervaldatum is, kun je hier een herinnering opstellen."}
                </p>
              </div>
            ) : (
              [...plan.verstuurd].reverse().map((sent) => (
                <div className="mini-row" key={sent.id}>
                  <span className="mini-icon">
                    <Icon name="bell" size={14} />
                  </span>
                  <span className="mini-main">
                    <span className="mini-title">{reminderLevelInfo(sent.niveau).label}</span>
                    <span className="mini-sub">
                      Verzonden op {fmtDate(sent.verzondenOp || sent.aangemaaktOp, "medium")}
                    </span>
                  </span>
                  <span className={`badge ${reminderLevelInfo(sent.niveau).badge}`}>
                    Niveau {sent.niveau}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="list-foot">
            <span className="small muted">
              {display === "vervallen"
                ? `Voorgesteld niveau: ${reminderLevelInfo(plan.niveau).label} (${plan.dagenTeLaat} ${plan.dagenTeLaat === 1 ? "dag" : "dagen"} te laat)`
                : "Deze factuur staat nog binnen de betaaltermijn."}
            </span>
            <Link className="link small" to="/aanmaningen">
              Alle aanmaningen <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </div>
      ) : null}

      {confirmingDelete ? (
        <ConfirmDialog
          title={`Factuur ${invoice.nummer} verwijderen?`}
          message="De factuur en haar regels worden definitief uit deze administratie verwijderd. Dit kan niet ongedaan worden gemaakt."
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </>
  );
}
