// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ConfirmDialog, Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import {
  copyText,
  daysBetween,
  eur,
  fmtDate,
  fmtDateTime,
  invoiceState,
  invoiceTotals,
  sum,
  todayISO,
} from "../lib";
import {
  activePaymentPlan,
  activePaymentPlans,
  intervalKort,
  paymentPlanSchedule,
  planAchterstand,
  planVoortgang,
  volgendeTermijn,
} from "../paymentPlans";
import {
  acceptanceMatches,
  parseAcceptance,
  planLinkData,
  planShareUrl,
} from "../planLink";
import {
  plannedReminder,
  reminderLetterPath,
  reminderLevelInfo,
  REMINDER_LEVELS,
} from "../reminders";
import { useAppStore } from "../store";
import type { PaymentPlan, Reminder } from "../types";

export function RemindersPage() {
  const { state, dismissReminder, removeReminder, endPaymentPlan, acceptPaymentPlan } =
    useAppStore();
  const toast = useToast();
  const [confirming, setConfirming] = useState<Reminder | null>(null);
  const [endingPlan, setEndingPlan] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<PaymentPlan | null>(null);
  const [acceptCode, setAcceptCode] = useState("");
  const [acceptError, setAcceptError] = useState("");
  const today = todayISO();
  const year = new Date().getFullYear();

  useTitle("Aanmaningen");

  const reminders = [...state.herinneringen].sort((a, b) =>
    a.aangemaaktOp === b.aangemaaktOp
      ? (a.id < b.id ? 1 : -1)
      : a.aangemaaktOp < b.aangemaaktOp
        ? 1
        : -1
  );
  const plannen = activePaymentPlans(state.betaalregelingen);
  const sentLetters = reminders.filter((reminder) => reminder.status === "verzonden");
  const proposals = reminders.filter(
    (reminder) => reminder.status === "concept" && !reminder.genegeerdOp
  );

  const rows = state.facturen
    .filter((invoice) => invoiceState(invoice) === "vervallen")
    .map((invoice) => {
      const klant = state.relaties.find((relatie) => relatie.id === invoice.klantId);
      const plan = plannedReminder(invoice, state.herinneringen, today);
      return {
        invoice,
        klantNaam: klant?.naam || "Onbekende klant",
        bedrag: invoiceTotals(invoice).incl,
        dagenTeLaat: daysBetween(invoice.vervaldatum, today),
        plan,
        regeling: activePaymentPlan(state.betaalregelingen, invoice.id),
      };
    })
    .sort((a, b) => b.dagenTeLaat - a.dagenTeLaat);

  const proposalRows = proposals
    .map((reminder) => {
      const invoice = state.facturen.find((item) => item.id === reminder.factuurId);
      const klant = state.relaties.find((relatie) => relatie.id === invoice?.klantId);
      return {
        reminder,
        invoice,
        klantNaam: klant?.naam || "Onbekende klant",
        bedrag: invoice ? invoiceTotals(invoice).incl : 0,
        dagenTeLaat: invoice ? daysBetween(invoice.vervaldatum, today) : 0,
      };
    })
    .sort((a, b) => b.dagenTeLaat - a.dagenTeLaat);

  const overdueAmount = sum(rows, (row) => row.bedrag);
  const withoutLetter = rows.filter(
    (row) => !row.regeling && row.plan.verstuurd.length === 0 && !row.plan.concept
  );
  const withoutLetterAmount = sum(withoutLetter, (row) => row.bedrag);
  const sentThisYear = sentLetters.filter((reminder) =>
    (reminder.verzondenOp || reminder.aangemaaktOp).startsWith(String(year))
  );
  const highest = sentLetters.reduce((max, reminder) => Math.max(max, reminder.niveau), 0);

  function undo(reminder: Reminder) {
    removeReminder(reminder.id);
    setConfirming(null);
    toast("Brief uit de administratie verwijderd");
  }

  function stopPlan(planId: string) {
    setEndingPlan(null);
    endPaymentPlan(planId);
    toast("Betaalregeling stopgezet — Helder kan weer aanmanen");
  }

  async function sharePlan(plan: PaymentPlan) {
    const invoice = state.facturen.find((item) => item.id === plan.factuurId);
    if (!invoice) return;
    const klantNaam =
      state.relaties.find((relatie) => relatie.id === invoice.klantId)?.naam || "de klant";
    const link = planShareUrl(planLinkData(plan, invoice, klantNaam, state.bedrijf));
    const ok = await copyText(link);
    toast(
      ok
        ? `Deellink voor ${invoice.nummer} gekopieerd — stuur hem naar ${klantNaam}`
        : "Kopiëren lukte niet; open de brief en kopieer de link daar"
    );
  }

  function startAcceptance(plan: PaymentPlan) {
    setAccepting(plan);
    setAcceptCode("");
    setAcceptError("");
  }

  // Alleen een code die bij deze regeling en deze termijnen hoort, legt het akkoord vast.
  function submitAcceptance() {
    if (!accepting) return;
    const acceptance = parseAcceptance(acceptCode);
    if (!acceptance) {
      setAcceptError("Dit is geen geldige bevestigingscode. Controleer of je de hele code hebt geplakt.");
      return;
    }
    if (acceptance.planId !== accepting.id) {
      setAcceptError("Deze code hoort bij een andere betaalregeling.");
      return;
    }
    if (!acceptanceMatches(acceptance, accepting)) {
      setAcceptError(
        "De code past niet bij deze termijnen. De afspraak is gewijzigd; vraag een nieuwe bevestiging."
      );
      return;
    }
    const moment = Date.parse(acceptance.acceptedAt);
    if (moment > Date.now() + 24 * 60 * 60 * 1000) {
      setAcceptError("Het tijdstip van het akkoord ligt in de toekomst. Controleer de code.");
      return;
    }
    acceptPaymentPlan(accepting.id, acceptance.acceptedAt);
    toast(`Akkoord vastgelegd op ${fmtDateTime(acceptance.acceptedAt)}`);
    setAccepting(null);
    setAcceptCode("");
    setAcceptError("");
  }

  function dismiss(reminder: Reminder) {
    dismissReminder(reminder.id);
    toast(`${reminderLevelInfo(reminder.niveau).label} afgewezen — Helder stelt dit niveau niet opnieuw voor`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Aanmaningen</h2>
          <p>Herinner klanten aan vervallen facturen en houd bij welke brief je al hebt verstuurd.</p>
        </div>
        <div className="actions">
          <Link className="btn" to="/facturen">
            <Icon name="invoice" size={15} /> Naar facturen
          </Link>
          <Link className="btn btn-primary" to="/rapporten">
            <Icon name="briefcase" size={15} /> Openstaand bekijken
          </Link>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="alert" /> Vervallen facturen
          </div>
          <div className="kpi-value">{rows.length}</div>
          <div className="kpi-meta">
            <span>{eur(overdueAmount, { cents: false })} over de vervaldatum</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="bell" /> Klaargezet
          </div>
          <div className="kpi-value">{proposals.length}</div>
          <div className="kpi-meta">
            <span>
              {proposals.length === 0
                ? "Helder heeft niets klaargezet"
                : "controleer en verstuur de brieven"}
            </span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="clock" /> Nog niet herinnerd
          </div>
          <div className="kpi-value">{withoutLetter.length}</div>
          <div className="kpi-meta">
            <span>{eur(withoutLetterAmount, { cents: false })} wacht op een eerste brief</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="send" /> Brieven verstuurd in {year}
          </div>
          <div className="kpi-value">{sentThisYear.length}</div>
          <div className="kpi-meta">
            <span>
              {highest === 0
                ? "Nog geen aanmaningen verstuurd"
                : `Hoogste niveau: ${reminderLevelInfo(highest as 1 | 2 | 3).label.toLowerCase()}`}
            </span>
          </div>
        </div>
      </div>

      <div className="alert alert-info mt-16 mb-16">
        <Icon name="info" size={16} />
        <span>
          Helder zet zelf een brief klaar zodra een factuur{" "}
          <strong>{14} dagen</strong> over de vervaldatum is, en daarna een zwaarder niveau na 30 en
          60 dagen — met minimaal twee weken rust tussen twee brieven. Je controleert elke brief
          voordat hij de deur uit gaat.
        </span>
      </div>

      {proposalRows.length > 0 ? (
        <div className="card mb-16">
          <div className="card-head">
            <div>
              <h3>Klaargezet door Helder</h3>
              <div className="sub">Controleer de brief en verstuur hem, of wijs het voorstel af</div>
            </div>
            <div className="right">
              <span className="chip">{proposals.length} voorstel</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Factuur</th>
                  <th>Niveau</th>
                  <th>Klaargezet</th>
                  <th className="num">Bedrag</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {proposalRows.map((row) => {
                  const info = reminderLevelInfo(row.reminder.niveau);
                  return (
                    <tr key={row.reminder.id}>
                      <td>
                        <div className="cell-main">
                          <span className="doc-icon">
                            <Icon name="bell" size={15} />
                          </span>
                          <span>
                            {row.invoice ? (
                              <Link className="strong" to={`/facturen/${row.invoice.id}`}>
                                {row.invoice.nummer}
                              </Link>
                            ) : (
                              <span className="strong">Onbekende factuur</span>
                            )}
                            <span className="cell-sub">{row.klantNaam}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${info.badge}`}>{info.label}</span>
                        <div className="cell-sub">
                          {row.dagenTeLaat} {row.dagenTeLaat === 1 ? "dag" : "dagen"} te laat
                        </div>
                      </td>
                      <td className="nowrap">
                        <div>{fmtDate(row.reminder.aangemaaktOp, "medium")}</div>
                        <div className="cell-sub">
                          {row.reminder.automatisch ? "automatisch voorgesteld" : "handmatig"}
                        </div>
                      </td>
                      <td className="num strong">{eur(row.bedrag)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-sm"
                            type="button"
                            onClick={() => dismiss(row.reminder)}
                            title="Voorstel afwijzen"
                          >
                            Afwijzen
                          </button>
                          {row.invoice ? (
                            <Link
                              className="btn btn-sm btn-primary"
                              to={`/herinneringen/${row.invoice.id}?niveau=${row.reminder.niveau}&concept=${row.reminder.id}`}
                            >
                              <Icon name="mail" size={13} /> Brief
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="list-foot">
            <span className="small muted">
              Automatisch klaarzetten staat {state.autoAanmaningen ? "aan" : "uit"}.
            </span>
            <Link className="link small" to="/instellingen">
              Aanpassen in instellingen <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </div>
      ) : null}

      {plannen.length > 0 ? (
        <div className="card mb-16">
          <div className="card-head">
            <div>
              <h3>Betaalregelingen</h3>
              <div className="sub">Aanmaningen staan gepauzeerd zolang de termijnen lopen</div>
            </div>
            <div className="right">
              <span className="chip">{plannen.length} actief</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Factuur</th>
                  <th>Regeling</th>
                  <th>Volgende termijn</th>
                  <th>Voortgang</th>
                  <th>Akkoord klant</th>
                  <th className="num">Openstaand</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plannen.map((plan) => {
                  const invoice = state.facturen.find((item) => item.id === plan.factuurId);
                  const klant = state.relaties.find((relatie) => relatie.id === invoice?.klantId);
                  const vervallen = paymentPlanSchedule(plan).filter(
                    (termijn) => termijn.datum <= today
                  ).length;
                  const volgende = volgendeTermijn(plan, today);
                  const achterstand = planAchterstand(plan, today);
                  return (
                    <tr key={plan.id}>
                      <td>
                        <div className="cell-main">
                          <span className="doc-icon">
                            <Icon name="calendar" size={15} />
                          </span>
                          <span>
                            {invoice ? (
                              <Link className="strong" to={`/facturen/${invoice.id}`}>
                                {invoice.nummer}
                              </Link>
                            ) : (
                              <span className="strong">Onbekende factuur</span>
                            )}
                            <span className="cell-sub">{klant?.naam || "Onbekende klant"}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="strong">
                          {plan.termijnen} × {eur(plan.bedragPerTermijn)}
                        </div>
                        <div className="cell-sub">
                          {intervalKort(plan.intervalDagen).toLowerCase()} · eerste termijn{" "}
                          {fmtDate(plan.eersteTermijn, "medium")}
                        </div>
                        <div className="cell-sub">
                          {plan.betaalLink ? "iDEAL-betaallink klaar" : "geen betaallink"}
                        </div>
                      </td>
                      <td className="nowrap">
                        {volgende ? (
                          <>
                            <div>{fmtDate(volgende.datum, "medium")}</div>
                            <div className="cell-sub">{eur(volgende.bedrag)}</div>
                          </>
                        ) : (
                          <span className="badge badge-green">Alle termijnen vervallen</span>
                        )}
                        {achterstand > 0 ? (
                          <div className="cell-sub text-red">
                            {achterstand} {achterstand === 1 ? "dag" : "dagen"} over de termijn
                          </div>
                        ) : null}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${planVoortgang(plan, today)}%` }}
                          />
                        </div>
                        <div className="cell-sub">
                          {vervallen} van {plan.termijnen} termijnen vervallen ·{" "}
                          {eur(plan.totaal)} totaal
                        </div>
                      </td>
                      <td>
                        {plan.geaccepteerdOp ? (
                          <>
                            <span className="badge badge-green">
                              <Icon name="check" size={11} /> Geaccepteerd
                            </span>
                            <div className="cell-sub">{fmtDateTime(plan.geaccepteerdOp)}</div>
                          </>
                        ) : (
                          <>
                            <span className="badge badge-amber">Wacht op klant</span>
                            <div className="cell-sub">deellink nog niet bevestigd</div>
                          </>
                        )}
                      </td>
                      <td className="num">{invoice ? eur(invoiceTotals(invoice).incl) : "—"}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-sm"
                            type="button"
                            onClick={() => sharePlan(plan)}
                            title="Deelbare link naar de acceptatiepagina"
                          >
                            <Icon name="copy" size={12} /> Deellink
                          </button>
                          {plan.geaccepteerdOp ? null : (
                            <button
                              className="btn btn-sm"
                              type="button"
                              onClick={() => startAcceptance(plan)}
                            >
                              Akkoord
                            </button>
                          )}
                          <button
                            className="btn btn-sm"
                            type="button"
                            onClick={() => setEndingPlan(plan.id)}
                          >
                            Stopzetten
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="list-foot">
            <span className="small muted">
              Met Deellink stuurt de klant naar het aflosschema; zijn bevestigingscode plak je hier
              terug als akkoord. Een iDEAL-betaallink op de brief opent na het akkoord de
              betaalpagina. Helder controleert niet of er echt betaald is.
            </span>
            <span className="small muted">Stopzetten hervat de aanmaningen.</span>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Vervallen facturen</h3>
            <div className="sub">Gesorteerd op het aantal dagen te laat</div>
          </div>
          <div className="right">
            <span className="chip">{eur(overdueAmount)}</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Factuur</th>
                <th>Vervaldatum</th>
                <th>Status</th>
                <th>Laatste brief</th>
                <th className="num">Bedrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const laatste = row.plan.laatste;
                const info = reminderLevelInfo(
                  row.plan.concept?.niveau ?? (laatste ? laatste.niveau : row.plan.niveau)
                );
                const stap = row.regeling
                  ? `betaalregeling loopt: ${row.regeling.termijnen} termijnen`
                  : row.plan.concept
                    ? "klaargezet door Helder"
                    : !laatste
                      ? "nog niets verstuurd"
                      : laatste.niveau >= 3
                        ? "hoogste niveau verstuurd"
                        : `volgende: ${reminderLevelInfo(row.plan.niveau).label.toLowerCase()}`;
                return (
                  <tr key={row.invoice.id}>
                    <td>
                      <div className="cell-main">
                        <span className="doc-icon">
                          <Icon name="invoice" size={15} />
                        </span>
                        <span>
                          <Link className="strong" to={`/facturen/${row.invoice.id}`}>
                            {row.invoice.nummer}
                          </Link>
                          <span className="cell-sub">{row.klantNaam}</span>
                        </span>
                      </div>
                    </td>
                    <td className="nowrap">
                      <div>{fmtDate(row.invoice.vervaldatum, "medium")}</div>
                      <div className="cell-sub text-red">
                        {row.dagenTeLaat} {row.dagenTeLaat === 1 ? "dag" : "dagen"} te laat
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${info.badge}`}>{info.label}</span>
                      <div className="cell-sub">{stap}</div>
                    </td>
                    <td className="nowrap">
                      {laatste ? (
                        <>
                          <div>{fmtDate(laatste.verzondenOp || laatste.aangemaaktOp, "medium")}</div>
                          <div className="cell-sub">
                            {reminderLevelInfo(laatste.niveau).label.toLowerCase()}
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num strong">{eur(row.bedrag)}</td>
                    <td>
                      <div className="row-actions">
                        {row.regeling ? (
                          <span className="chip">
                            <Icon name="calendar" size={12} /> Regeling loopt
                          </span>
                        ) : (
                          <Link
                            className="btn btn-sm"
                            to={reminderLetterPath(row.invoice.id, row.plan)}
                            title={`${reminderLevelInfo(row.plan.concept?.niveau ?? row.plan.niveau).label} opstellen`}
                          >
                            <Icon name="mail" size={13} />
                            {row.plan.concept ? "Brief" : laatste ? "Volgende brief" : "Brief"}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="table-empty">
            <div className="empty">
              <div className="empty-icon">
                <Icon name="checkCircle" size={19} />
              </div>
              <h4>Geen vervallen facturen</h4>
              <p>Alle verstuurde facturen zijn op tijd betaald. Niets te herinneren.</p>
              <Link className="btn btn-primary" to="/facturen">
                Naar facturen
              </Link>
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            {withoutLetter.length} van {rows.length} vervallen facturen{" "}
            {withoutLetter.length === 1 ? "heeft" : "hebben"} nog geen brief gekregen.
          </span>
          <span className="small muted">Bedragen zijn inclusief btw.</span>
        </div>
      </div>

      <div className="card mt-16">
        <div className="card-head">
          <div>
            <h3>Verzonden brieven</h3>
            <div className="sub">Wat er al naar buiten is gegaan</div>
          </div>
          <div className="right">
            <span className="chip">{sentLetters.length} in totaal</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Verzonden</th>
                <th>Factuur</th>
                <th>Niveau</th>
                <th className="num">Bedrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sentLetters.map((reminder) => {
                const invoice = state.facturen.find((item) => item.id === reminder.factuurId);
                const klant = state.relaties.find((relatie) => relatie.id === invoice?.klantId);
                const info = reminderLevelInfo(reminder.niveau);
                return (
                  <tr key={reminder.id}>
                    <td className="nowrap">
                      {fmtDate(reminder.verzondenOp || reminder.aangemaaktOp, "medium")}
                    </td>
                    <td>
                      {invoice ? (
                        <>
                          <Link className="strong" to={`/facturen/${invoice.id}`}>
                            {invoice.nummer}
                          </Link>
                          <div className="cell-sub">{klant?.naam || "Onbekende klant"}</div>
                        </>
                      ) : (
                        <span className="muted">Factuur verwijderd</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${info.badge}`}>{info.label}</span>
                    </td>
                    <td className="num">{invoice ? eur(invoiceTotals(invoice).incl) : "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn danger"
                          type="button"
                          title="Brief uit administratie verwijderen"
                          aria-label="Brief uit administratie verwijderen"
                          onClick={() => setConfirming(reminder)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sentLetters.length === 0 ? (
          <div className="table-empty">
            <div className="empty">
              <div className="empty-icon">
                <Icon name="bell" size={19} />
              </div>
              <h4>Nog geen brieven verstuurd</h4>
              <p>
                Open een vervallen factuur hierboven en stel een betaalherinnering of aanmaning op.
                Zodra je die als verzonden markeert, verschijnt hij hier.
              </p>
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            Niveaus: {REMINDER_LEVELS.map((level) => level.label).join(" · ")}
          </span>
          <span className="small muted">Verwijderen ontkoppelt de brief van deze administratie.</span>
        </div>
      </div>

      {accepting ? (
        <Modal
          title="Online akkoord vastleggen"
          subtitle="Plak de bevestigingscode die de klant je stuurde"
          onClose={() => setAccepting(null)}
          footer={
            <>
              <button className="btn" type="button" onClick={() => setAccepting(null)}>
                Annuleren
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={!acceptCode.trim()}
                onClick={submitAcceptance}
              >
                <Icon name="check" size={14} /> Akkoord vastleggen
              </button>
            </>
          }
        >
          {(() => {
            const invoice = state.facturen.find((item) => item.id === accepting.factuurId);
            const klant = state.relaties.find((relatie) => relatie.id === invoice?.klantId);
            return (
              <>
                <p className="small" style={{ color: "var(--ink-2)", lineHeight: 1.65 }}>
                  De regeling voor <strong>{invoice?.nummer ?? "deze factuur"}</strong>{" "}
                  {klant?.naam ? `van ${klant.naam}` : ""} loopt sinds{" "}
                  {fmtDate(accepting.aangemaaktOp, "medium")}. De klant opent de deellink,
                  accepteert het schema en stuurt de bevestigingscode terug. Het tijdstip in de code
                  wordt als akkoord vastgelegd.
                </p>
                <div className="field mt-16">
                  <label htmlFor="accept-code">Bevestigingscode</label>
                  <textarea
                    id="accept-code"
                    className="textarea mono"
                    rows={3}
                    placeholder="AKK1-…"
                    value={acceptCode}
                    onChange={(event) => {
                      setAcceptCode(event.target.value);
                      setAcceptError("");
                    }}
                  />
                  {acceptError ? (
                    <p className="small text-red" style={{ marginTop: 6 }}>
                      {acceptError}
                    </p>
                  ) : (
                    <p className="hint">
                      De code is alleen geldig voor deze regeling en dit aflosschema.
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </Modal>
      ) : null}

      {endingPlan ? (
        <ConfirmDialog
          title="Betaalregeling stopzetten?"
          message="De afspraak verdwijnt uit dit overzicht en de factuur telt weer mee voor nieuwe aanmaningen. Je kunt altijd een nieuwe regeling vastleggen."
          confirmLabel="Stopzetten"
          onConfirm={() => stopPlan(endingPlan)}
          onCancel={() => setEndingPlan(null)}
        />
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title="Brief verwijderen?"
          message="De brief verdwijnt uit het overzicht. De factuur zelf blijft ongewijzigd; je kunt daarna opnieuw een brief opstellen."
          confirmLabel="Verwijderen"
          onConfirm={() => undo(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </>
  );
}
