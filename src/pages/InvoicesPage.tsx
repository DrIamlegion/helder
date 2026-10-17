// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { StateBadge } from "../components/StateBadge";
import { useTitle } from "../hooks";
import {
  csvEscape,
  daysBetween,
  download,
  eur,
  fmtDate,
  invoiceState,
  invoiceTotals,
  stateLabel,
  todayISO,
} from "../lib";
import { useAppStore } from "../store";
import type { InvoiceDisplayState } from "../types";

type Filter = "alle" | "open" | "betaald" | "concept";

interface InvoiceRow {
  id: string;
  nummer: string;
  klantNaam: string;
  datum: string;
  vervaldatum: string;
  display: InvoiceDisplayState;
  dueText: string;
  amount: number;
  search: string;
}

const ALLOWED_FILTERS: Filter[] = ["alle", "open", "betaald", "concept"];

export function InvoicesPage() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>(() => {
    const value = searchParams.get("status");
    return ALLOWED_FILTERS.includes(value as Filter) ? (value as Filter) : "alle";
  });

  useTitle("Facturen");

  const klantFilter = searchParams.get("klant") ?? "";
  const klant = state.relaties.find((r) => r.id === klantFilter);

  const rows = useMemo<InvoiceRow[]>(() => {
    const sorted = [...state.facturen].sort((a, b) =>
      a.datum === b.datum ? b.nummer.localeCompare(a.nummer) : a.datum < b.datum ? 1 : -1
    );
    return sorted
      .filter((invoice) => !klantFilter || invoice.klantId === klantFilter)
      .map((invoice) => {
        const relatie = state.relaties.find((r) => r.id === invoice.klantId);
        const display = invoiceState(invoice);
        const totals = invoiceTotals(invoice);
        const diff = daysBetween(todayISO(), invoice.vervaldatum);
        const dueText =
          display === "betaald"
            ? "Betaald"
            : display === "concept"
              ? "Nog niet verstuurd"
              : diff < 0
                ? `${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dag" : "dagen"} te laat`
                : diff === 0
                  ? "Vervalt vandaag"
                  : `over ${diff} ${diff === 1 ? "dag" : "dagen"}`;
        return {
          id: invoice.id,
          nummer: invoice.nummer,
          klantNaam: relatie?.naam || "Onbekende klant",
          datum: invoice.datum,
          vervaldatum: invoice.vervaldatum,
          display,
          dueText,
          amount: totals.incl,
          search: `${invoice.nummer} ${relatie?.naam || ""} ${fmtDate(invoice.datum)}`.toLowerCase(),
        };
      });
  }, [state.facturen, state.relaties, klantFilter]);

  const term = search.trim().toLowerCase();
  const visible = rows.filter((row) => {
    const statusOk =
      filter === "alle" ||
      (filter === "open"
        ? row.display === "verzonden" || row.display === "vervallen"
        : row.display === filter);
    return statusOk && (!term || row.search.includes(term));
  });
  const visibleTotal = visible.reduce((total, row) => total + row.amount, 0);

  const openAmount = rows
    .filter((row) => row.display === "verzonden" || row.display === "vervallen")
    .reduce((total, row) => total + row.amount, 0);

  function exportCsv() {
    const header = ["Nummer", "Klant", "Datum", "Vervaldatum", "Status", "Excl. btw", "Btw", "Incl. btw"];
    const lines = state.facturen.map((factuur) => {
      const relatie = state.relaties.find((r) => r.id === factuur.klantId);
      const totals = invoiceTotals(factuur);
      return [
        factuur.nummer,
        relatie?.naam || "",
        factuur.datum,
        factuur.vervaldatum,
        stateLabel(invoiceState(factuur)),
        totals.excl.toFixed(2),
        totals.vat.toFixed(2),
        totals.incl.toFixed(2),
      ]
        .map(csvEscape)
        .join(";");
    });
    download("facturen.csv", "\uFEFF" + [header.join(";"), ...lines].join("\n"), "text/csv");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Facturen</h2>
          <p>
            {klant
              ? `Alle facturen van ${klant.naam}`
              : "Factuurnummering, betaalstatus en vervaldata op één plek."}
          </p>
        </div>
        <div className="actions">
          <Link className="btn" to="/herhalingen">
            <Icon name="refresh" size={15} /> Terugkerend
          </Link>
          <button className="btn" type="button" onClick={exportCsv}>
            <Icon name="download" size={15} /> Exporteren
          </button>
          <Link className="btn btn-primary" to="/facturen/nieuw">
            <Icon name="plus" size={15} /> Nieuwe factuur
          </Link>
        </div>
      </div>

      {klant ? (
        <div className="toolbar">
          <span className="chip">
            <Icon name="users" size={12} /> {klant.naam}{" "}
            <Link to="/facturen" className="chip-x" aria-label="Filter wissen">
              <Icon name="x" size={11} />
            </Link>
          </span>
        </div>
      ) : null}

      <div className="card">
        <div className="list-toolbar">
          <div className="search">
            <Icon name="search" size={15} />
            <input
              className="input"
              type="search"
              placeholder="Zoek op nummer of klant…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Facturen zoeken"
            />
          </div>
          <div className="seg" role="group" aria-label="Filter op status">
            <button type="button" className={filter === "alle" ? "on" : ""} onClick={() => setFilter("alle")}>
              Alle
            </button>
            <button type="button" className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>
              Openstaand
            </button>
            <button type="button" className={filter === "betaald" ? "on" : ""} onClick={() => setFilter("betaald")}>
              Betaald
            </button>
            <button type="button" className={filter === "concept" ? "on" : ""} onClick={() => setFilter("concept")}>
              Concept
            </button>
          </div>
          <span className="grow" />
          <span className="small muted nowrap">
            {visible.length} {visible.length === 1 ? "factuur" : "facturen"}
          </span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Factuur</th>
                <th>Datum</th>
                <th>Vervaldatum</th>
                <th>Status</th>
                <th className="num">Bedrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const path = `/facturen/${row.id}`;
                return (
                  <tr
                    className="clickable"
                    key={row.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Factuur ${row.nummer} van ${row.klantNaam}`}
                    onClick={() => navigate(path)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(path);
                      }
                    }}
                  >
                    <td>
                      <div className="cell-main">
                        <span className="doc-icon">
                          <Icon name="invoice" size={15} />
                        </span>
                        <span>
                          <span className="strong">{row.nummer}</span>
                          <span className="cell-sub">{row.klantNaam}</span>
                        </span>
                      </div>
                    </td>
                    <td className="muted nowrap">{fmtDate(row.datum, "medium")}</td>
                    <td className="nowrap">
                      <div>{fmtDate(row.vervaldatum, "medium")}</div>
                      <div className={`cell-sub ${row.display === "vervallen" ? "text-red" : ""}`}>
                        {row.dueText}
                      </div>
                    </td>
                    <td>
                      <StateBadge state={row.display} />
                    </td>
                    <td className="num strong">{eur(row.amount)}</td>
                    <td className="chev">
                      <Icon name="chevronRight" size={15} />
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
                <Icon name="search" size={19} />
              </div>
              <h4>Geen facturen gevonden</h4>
              <p>Pas je zoekopdracht of filter aan om meer resultaten te zien.</p>
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            {visible.length} van {rows.length} facturen · {eur(visibleTotal)}
          </span>
          <span className="small">
            <span className="muted">Openstaand:</span> <strong>{eur(openAmount)}</strong>
          </span>
        </div>
      </div>
    </>
  );
}
