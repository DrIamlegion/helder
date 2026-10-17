// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { QuoteBadge } from "../components/QuoteBadge";
import { useTitle } from "../hooks";
import { eur, fmtDate, invoiceTotals, quoteState } from "../lib";
import { useAppStore } from "../store";
import type { QuoteDisplayState } from "../types";

type Filter = "alle" | "open" | "geaccepteerd" | "concept" | "afgewezen";

interface QuoteRow {
  id: string;
  nummer: string;
  klantNaam: string;
  datum: string;
  geldigTot: string;
  display: QuoteDisplayState;
  amount: number;
  search: string;
}

export function QuotesPage() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");

  useTitle("Offertes");

  const year = new Date().getFullYear();

  const rows = useMemo<QuoteRow[]>(() => {
    const sorted = [...state.offertes].sort((a, b) =>
      a.datum === b.datum ? b.nummer.localeCompare(a.nummer) : a.datum < b.datum ? 1 : -1
    );
    return sorted.map((quote) => {
      const relatie = state.relaties.find((r) => r.id === quote.klantId);
      return {
        id: quote.id,
        nummer: quote.nummer,
        klantNaam: relatie?.naam || "Onbekende klant",
        datum: quote.datum,
        geldigTot: quote.geldigTot,
        display: quoteState(quote),
        amount: invoiceTotals(quote).incl,
        search: `${quote.nummer} ${relatie?.naam || ""}`.toLowerCase(),
      };
    });
  }, [state.offertes, state.relaties]);

  const open = rows.filter((row) => row.display === "verzonden" || row.display === "verlopen");
  const accepted = rows.filter((row) => row.display === "geaccepteerd" && row.datum.startsWith(String(year)));
  const rejected = rows.filter((row) => row.display === "afgewezen");
  const decided = accepted.length + rejected.length;
  const conversion = decided > 0 ? Math.round((accepted.length / decided) * 100) : 0;

  const term = search.trim().toLowerCase();
  const visible = rows.filter((row) => {
    const statusOk =
      filter === "alle" ||
      (filter === "open"
        ? row.display === "verzonden" || row.display === "verlopen"
        : row.display === filter);
    return statusOk && (!term || row.search.includes(term));
  });
  const visibleTotal = visible.reduce((total, row) => total + row.amount, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Offertes</h2>
          <p>Van eerste voorstel tot opdracht — en met één klik door naar de factuur.</p>
        </div>
        <div className="actions">
          <Link className="btn btn-primary" to="/offertes/nieuw">
            <Icon name="plus" size={15} /> Nieuwe offerte
          </Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="send" /> Open offertes
          </div>
          <div className="kpi-value">{eur(open.reduce((total, row) => total + row.amount, 0), { cents: false })}</div>
          <div className="kpi-meta">
            <span>
              {open.length} {open.length === 1 ? "offerte" : "offertes"} wachten op antwoord
            </span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="checkCircle" /> Geaccepteerd {year}
          </div>
          <div className="kpi-value">
            {eur(accepted.reduce((total, row) => total + row.amount, 0), { cents: false })}
          </div>
          <div className="kpi-meta">
            <span>
              {accepted.length} {accepted.length === 1 ? "opdracht" : "opdrachten"} gegund
            </span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="percent" /> Conversie
          </div>
          <div className="kpi-value">{conversion}%</div>
          <div className="kpi-meta">
            <span>{decided > 0 ? `${accepted.length} van ${decided} beslissingen` : "Nog geen beslissingen"}</span>
          </div>
        </div>
      </div>

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
              aria-label="Offertes zoeken"
            />
          </div>
          <div className="seg" role="group" aria-label="Filter op status">
            <button type="button" className={filter === "alle" ? "on" : ""} onClick={() => setFilter("alle")}>
              Alle
            </button>
            <button type="button" className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>
              Open
            </button>
            <button
              type="button"
              className={filter === "geaccepteerd" ? "on" : ""}
              onClick={() => setFilter("geaccepteerd")}
            >
              Geaccepteerd
            </button>
            <button type="button" className={filter === "concept" ? "on" : ""} onClick={() => setFilter("concept")}>
              Concept
            </button>
            <button type="button" className={filter === "afgewezen" ? "on" : ""} onClick={() => setFilter("afgewezen")}>
              Afgewezen
            </button>
          </div>
          <span className="grow" />
          <span className="small muted nowrap">
            {visible.length} {visible.length === 1 ? "offerte" : "offertes"}
          </span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Offerte</th>
                <th>Datum</th>
                <th>Geldig tot</th>
                <th>Status</th>
                <th className="num">Bedrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const path = `/offertes/${row.id}`;
                return (
                  <tr
                    className="clickable"
                    key={row.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Offerte ${row.nummer} van ${row.klantNaam}`}
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
                          <Icon name="fileText" size={15} />
                        </span>
                        <span>
                          <span className="strong">{row.nummer}</span>
                          <span className="cell-sub">{row.klantNaam}</span>
                        </span>
                      </div>
                    </td>
                    <td className="muted nowrap">{fmtDate(row.datum, "medium")}</td>
                    <td className="nowrap">
                      <div>{fmtDate(row.geldigTot, "medium")}</div>
                      <div className={`cell-sub ${row.display === "verlopen" ? "text-red" : ""}`}>
                        {row.display === "concept"
                          ? "Nog niet verstuurd"
                          : row.display === "verlopen"
                            ? "Geldigheid verstreken"
                            : row.display === "geaccepteerd"
                              ? "Akkoord ontvangen"
                              : row.display === "afgewezen"
                                ? "Niet doorgegaan"
                                : "Wacht op antwoord"}
                      </div>
                    </td>
                    <td>
                      <QuoteBadge state={row.display} />
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
              <h4>Geen offertes gevonden</h4>
              <p>Pas je zoekopdracht of filter aan om meer resultaten te zien.</p>
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            {visible.length} van {rows.length} offertes · {eur(visibleTotal)}
          </span>
          <span className="small">
            <span className="muted">Openstaand:</span>{" "}
            <strong>{eur(open.reduce((total, row) => total + row.amount, 0))}</strong>
          </span>
        </div>
      </div>
    </>
  );
}
