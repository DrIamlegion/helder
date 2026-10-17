// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/Modal";
import { QuoteBadge } from "../components/QuoteBadge";
import { QuoteDocument } from "../components/QuoteDocument";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import {
  addDays,
  eur,
  fmtDate,
  invoiceTotals,
  nextInvoiceNumber,
  quoteState,
  todayISO,
  uid,
} from "../lib";
import { useAppStore } from "../store";
import type { Invoice, Quote } from "../types";

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, saveQuote, deleteQuote, saveInvoice } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const quote = state.offertes.find((item) => item.id === id);
  const klant = state.relaties.find((relatie) => relatie.id === quote?.klantId);
  const totals = quote ? invoiceTotals(quote) : null;
  const display = quote ? quoteState(quote) : "concept";
  const linkedInvoice = quote?.factuurId
    ? state.facturen.find((invoice) => invoice.id === quote.factuurId)
    : undefined;

  useTitle(quote ? `Offerte ${quote.nummer}` : "Offerte");

  if (!quote || !totals) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="alert" size={19} />
          </div>
          <h4>Niet gevonden</h4>
          <p>Deze offerte bestaat niet meer.</p>
          <Link className="btn btn-primary" to="/offertes">
            Naar offertes
          </Link>
        </div>
      </div>
    );
  }

  const setStatus = (status: Quote["status"], message: string) => {
    saveQuote({ ...quote, status });
    toast(message);
  };

  const convert = () => {
    if (linkedInvoice) {
      navigate(`/facturen/${linkedInvoice.id}`);
      return;
    }
    const vandaag = todayISO();
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      nummer: nextInvoiceNumber(state.facturen, new Date().getFullYear()),
      klantId: quote.klantId,
      datum: vandaag,
      vervaldatum: addDays(vandaag, Number(state.bedrijf.betaaltermijn) || 14),
      status: "concept",
      regels: quote.regels.map((regel) => ({ ...regel, id: uid() })),
      notitie: `Naar aanleiding van offerte ${quote.nummer}. Bedankt voor de opdracht!`,
    };
    saveInvoice(invoice);
    saveQuote({ ...quote, status: "geaccepteerd", factuurId: invoice.id });
    toast(`Factuur ${invoice.nummer} aangemaakt`);
    navigate(`/facturen/${invoice.id}`);
  };

  const remove = () => {
    deleteQuote(quote.id);
    toast("Offerte verwijderd");
    navigate("/offertes");
  };

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link className="back-link" to="/offertes">
            <Icon name="arrowLeft" size={13} /> Offertes
          </Link>
          <h2>
            Offerte {quote.nummer} <QuoteBadge state={display} />
          </h2>
          <p>
            {klant?.naam || "Onbekende klant"} · {fmtDate(quote.datum)} · {eur(totals.incl)}
          </p>
        </div>
        <div className="actions">
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            onClick={() => setConfirmingDelete(true)}
            title="Offerte verwijderen"
            aria-label="Offerte verwijderen"
          >
            <Icon name="trash" size={16} />
          </button>
          <Link className="btn" to={`/offertes/${quote.id}/bewerken`}>
            <Icon name="edit" size={14} /> Bewerken
          </Link>
          <button className="btn" type="button" onClick={() => window.print()}>
            <Icon name="printer" size={14} /> Print / PDF
          </button>

          {linkedInvoice ? (
            <Link className="btn" to={`/facturen/${linkedInvoice.id}`}>
              <Icon name="invoice" size={14} /> Factuur {linkedInvoice.nummer}
            </Link>
          ) : null}

          {display === "concept" ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setStatus("verzonden", "Offerte gemarkeerd als verzonden")}
            >
              <Icon name="send" size={14} /> Markeer als verzonden
            </button>
          ) : display === "verzonden" || display === "verlopen" ? (
            <>
              <button
                className="btn"
                type="button"
                onClick={() => setStatus("afgewezen", "Offerte gemarkeerd als afgewezen")}
              >
                <Icon name="x" size={14} /> Afwijzen
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setStatus("geaccepteerd", "Offerte geaccepteerd")}
              >
                <Icon name="check" size={14} /> Markeer geaccepteerd
              </button>
            </>
          ) : display === "geaccepteerd" && !linkedInvoice ? (
            <button className="btn btn-primary" type="button" onClick={convert}>
              <Icon name="invoice" size={14} /> Maak factuur
            </button>
          ) : display === "afgewezen" ? (
            <button
              className="btn"
              type="button"
              onClick={() => setStatus("concept", "Offerte heropend als concept")}
            >
              <Icon name="refresh" size={14} /> Heropenen
            </button>
          ) : null}
        </div>
      </div>

      <div className="paper-wrap">
        <QuoteDocument quote={quote} company={state.bedrijf} customer={klant} />
      </div>

      {confirmingDelete ? (
        <ConfirmDialog
          title={`Offerte ${quote.nummer} verwijderen?`}
          message="De offerte en haar regels worden definitief uit deze administratie verwijderd. Een al gemaakte factuur blijft bestaan."
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </>
  );
}
