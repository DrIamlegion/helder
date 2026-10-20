// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link } from "react-router-dom";
import { SAMPLE_BANK_CSV } from "../bank";
import { BankImportModal } from "../components/BankImportModal";
import { Icon } from "../components/Icon";
import { MatchInvoiceModal } from "../components/MatchInvoiceModal";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import { download, eur, fmtDate, invoiceState, invoiceTotals } from "../lib";
import { useAppStore } from "../store";
import type { BankTransaction } from "../types";

type Filter = "alle" | "open" | "gekoppeld" | "genegeerd";

const STATUS_LABEL: Record<BankTransaction["status"], string> = {
  open: "Te koppelen",
  gekoppeld: "Gekoppeld",
  genegeerd: "Genegeerd",
};

const STATUS_BADGE: Record<BankTransaction["status"], string> = {
  open: "badge-amber",
  gekoppeld: "badge-green",
  genegeerd: "badge-gray",
};

export function BankPage() {
  const {
    state,
    unmatchBankTransaction,
    setBankTransactionStatus,
  } = useAppStore();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("alle");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [matching, setMatching] = useState<BankTransaction | null>(null);

  useTitle("Bank");

  const transactions = [...state.banktransacties].sort((a, b) =>
    a.datum === b.datum ? (a.id < b.id ? 1 : -1) : a.datum < b.datum ? 1 : -1
  );
  const openTransactions = transactions.filter((transaction) => transaction.status === "open");
  const matched = transactions.filter((transaction) => transaction.status === "gekoppeld");
  const incoming = openTransactions.filter((transaction) => transaction.bedrag > 0);

  const openInvoices = state.facturen.filter((invoice) =>
    ["verzonden", "vervallen"].includes(invoiceState(invoice))
  );
  const openInvoiceTotal = openInvoices.reduce(
    (total, invoice) => total + invoiceTotals(invoice).incl,
    0
  );
  const matchedIncoming = matched.reduce(
    (total, transaction) => total + (transaction.bedrag > 0 ? transaction.bedrag : 0),
    0
  );

  const term = search.trim().toLowerCase();
  const visible = transactions.filter((transaction) => {
    const statusOk = filter === "alle" || transaction.status === filter;
    return (
      statusOk &&
      (!term ||
        `${transaction.tegenpartij} ${transaction.omschrijving}`
          .toLowerCase()
          .includes(term))
    );
  });

  function downloadSample() {
    download("voorbeeld-bankafschrift.csv", "\uFEFF" + SAMPLE_BANK_CSV, "text/csv");
    toast("Voorbeeld-CSV gedownload");
  }

  function ignore(transaction: BankTransaction) {
    setBankTransactionStatus(transaction.id, "genegeerd");
    toast("Transactie genegeerd");
  }

  function reopen(transaction: BankTransaction) {
    setBankTransactionStatus(transaction.id, "open");
    toast("Transactie staat weer open");
  }

  function unmatch(transaction: BankTransaction) {
    unmatchBankTransaction(transaction.id);
    toast("Koppeling ongedaan gemaakt");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Bank</h2>
          <p>Importeer je afschrift en koppel ontvangsten aan openstaande facturen.</p>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={downloadSample}>
            <Icon name="download" size={15} /> Voorbeeld-CSV
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={15} /> Importeer afschrift
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="bank" /> Te koppelen
          </div>
          <div className="kpi-value">{openTransactions.length}</div>
          <div className="kpi-meta">
            <span>
              {incoming.length} inkomend · {openTransactions.length - incoming.length} uitgaand
            </span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="invoice" /> Openstaande facturen
          </div>
          <div className="kpi-value">{eur(openInvoiceTotal, { cents: false })}</div>
          <div className="kpi-meta">
            <span>
              {openInvoices.length} {openInvoices.length === 1 ? "factuur" : "facturen"} wachten op
              betaling
            </span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="checkCircle" /> Via bank ontvangen
          </div>
          <div className="kpi-value">{eur(matchedIncoming, { cents: false })}</div>
          <div className="kpi-meta">
            <span>{matched.length} mutaties gekoppeld</span>
          </div>
        </div>
      </div>

      <div className="alert alert-info mb-16">
        <Icon name="info" size={16} />
        <span>
          Koppelen kan alleen bij een openstaande factuur met exact hetzelfde bedrag. Uitgaande
          mutaties kun je negeren of later als uitgave boeken.
        </span>
      </div>

      <div className="card">
        <div className="list-toolbar">
          <div className="search">
            <Icon name="search" size={15} />
            <input
              className="input"
              type="search"
              placeholder="Zoek op tegenpartij of omschrijving…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Bankmutaties zoeken"
            />
          </div>
          <div className="seg" role="group" aria-label="Filter op status">
            <button type="button" className={filter === "alle" ? "on" : ""} onClick={() => setFilter("alle")}>
              Alle
            </button>
            <button type="button" className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>
              Te koppelen
            </button>
            <button
              type="button"
              className={filter === "gekoppeld" ? "on" : ""}
              onClick={() => setFilter("gekoppeld")}
            >
              Gekoppeld
            </button>
            <button
              type="button"
              className={filter === "genegeerd" ? "on" : ""}
              onClick={() => setFilter("genegeerd")}
            >
              Genegeerd
            </button>
          </div>
          <span className="grow" />
          <span className="small muted nowrap">
            {visible.length} {visible.length === 1 ? "mutatie" : "mutaties"}
          </span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Tegenpartij</th>
                <th>Bedrag</th>
                <th>Status</th>
                <th>Factuur</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((transaction) => {
                const invoice = transaction.factuurId
                  ? state.facturen.find((item) => item.id === transaction.factuurId)
                  : undefined;
                return (
                  <tr key={transaction.id}>
                    <td className="muted nowrap">{fmtDate(transaction.datum, "medium")}</td>
                    <td>
                      <div className="cell-main">
                        <span className="doc-icon">
                          <Icon name="bank" size={15} />
                        </span>
                        <span>
                          <span className="strong">{transaction.tegenpartij}</span>
                          {transaction.omschrijving ? (
                            <span className="cell-sub">{transaction.omschrijving}</span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className={`num strong ${transaction.bedrag > 0 ? "text-green" : ""}`}>
                      {transaction.bedrag >= 0 ? "+" : "−"} {eur(Math.abs(transaction.bedrag))}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[transaction.status]}`}>
                        {STATUS_LABEL[transaction.status]}
                      </span>
                    </td>
                    <td>
                      {invoice ? (
                        <Link className="link" to={`/facturen/${invoice.id}`}>
                          {invoice.nummer}
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {transaction.status === "open" && transaction.bedrag > 0 ? (
                          <button
                            className="btn btn-sm"
                            type="button"
                            onClick={() => setMatching(transaction)}
                          >
                            Koppel
                          </button>
                        ) : null}
                        {transaction.status === "open" && transaction.bedrag < 0 ? (
                          <button
                            className="btn btn-sm"
                            type="button"
                            onClick={() => ignore(transaction)}
                          >
                            Negeren
                          </button>
                        ) : null}
                        {transaction.status === "gekoppeld" ? (
                          <button
                            className="icon-btn"
                            type="button"
                            title="Koppeling ongedaan maken"
                            aria-label="Koppeling ongedaan maken"
                            onClick={() => unmatch(transaction)}
                          >
                            <Icon name="refresh" size={15} />
                          </button>
                        ) : null}
                        {transaction.status === "genegeerd" ? (
                          <button className="btn btn-sm" type="button" onClick={() => reopen(transaction)}>
                            Heropenen
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 ? (
          <div className="table-empty">
            <div className="empty">
              <div className="empty-icon">
                <Icon name="bank" size={19} />
              </div>
              <h4>{transactions.length === 0 ? "Nog geen bankmutaties" : "Niets gevonden"}</h4>
              <p>
                {transactions.length === 0
                  ? "Importeer een CSV-afschrift om ontvangsten aan facturen te koppelen."
                  : "Pas je zoekopdracht of filter aan om meer resultaten te zien."}
              </p>
              {transactions.length === 0 ? (
                <button className="btn btn-primary" type="button" onClick={() => setImportOpen(true)}>
                  <Icon name="upload" size={15} /> Importeer afschrift
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            {visible.length} van {transactions.length} mutaties ·{" "}
            {transactions.length > 0
              ? `saldo ${eur(transactions.reduce((total, item) => total + item.bedrag, 0))}`
              : "geen import"}
          </span>
          <span className="small muted">Koppelingen zijn direct zichtbaar bij de factuur.</span>
        </div>
      </div>

      {importOpen ? <BankImportModal onClose={() => setImportOpen(false)} /> : null}
      {matching ? (
        <MatchInvoiceModal transaction={matching} onClose={() => setMatching(null)} />
      ) : null}
    </>
  );
}
