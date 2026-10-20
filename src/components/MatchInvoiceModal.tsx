// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { matchingInvoices } from "../bank";
import { eur, fmtDate } from "../lib";
import { useAppStore } from "../store";
import type { BankTransaction } from "../types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

export function MatchInvoiceModal({
  transaction,
  onClose,
}: {
  transaction: BankTransaction;
  onClose: () => void;
}) {
  const { state, matchBankTransaction } = useAppStore();
  const toast = useToast();
  const candidates = matchingInvoices(transaction, state.facturen, state.relaties);
  const [selectedId, setSelectedId] = useState(candidates[0]?.invoice.id ?? "");

  function confirm() {
    const candidate = candidates.find((item) => item.invoice.id === selectedId);
    if (!candidate) return;
    matchBankTransaction(transaction.id, candidate.invoice.id);
    toast(`Betaling gekoppeld aan factuur ${candidate.invoice.nummer}`);
    onClose();
  }

  return (
    <Modal
      title="Betaling koppelen"
      subtitle={`${transaction.tegenpartij} · ${eur(transaction.bedrag)} op ${fmtDate(transaction.datum, "medium")}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Annuleren
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={confirm}
            disabled={!selectedId}
          >
            <Icon name="check" size={14} /> Koppel betaling
          </button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <div className="empty" style={{ padding: "20px 0" }}>
          <div className="empty-icon">
            <Icon name="search" size={19} />
          </div>
          <h4>Geen passende factuur</h4>
          <p>
            Er is geen openstaande factuur met exact dit bedrag. Controleer het bedrag of negeer
            deze mutatie.
          </p>
        </div>
      ) : (
        <>
          <p className="small muted mb-12">
            Openstaande facturen met hetzelfde totaalbedrag. Koppelen markeert de factuur als
            betaald op {fmtDate(transaction.datum, "medium")}.
          </p>
          <div className="match-list">
            {candidates.map((candidate) => (
              <label
                key={candidate.invoice.id}
                className={`match-row ${selectedId === candidate.invoice.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="match-invoice"
                  checked={selectedId === candidate.invoice.id}
                  onChange={() => setSelectedId(candidate.invoice.id)}
                />
                <span className="match-main">
                  <span className="strong">{candidate.invoice.nummer}</span>
                  <span className="cell-sub">{candidate.klantNaam}</span>
                </span>
                <span className="muted small nowrap">
                  Vervalt {fmtDate(candidate.invoice.vervaldatum, "medium")}
                </span>
                <span className="num strong">{eur(candidate.amount)}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
