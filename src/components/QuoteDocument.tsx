// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { eur, fmtDate, initials, invoiceTotals, lineTotals, quoteState } from "../lib";
import type { Company, Customer, Quote } from "../types";
import { QuoteBadge } from "./QuoteBadge";

interface QuoteDocumentProps {
  quote: Quote;
  company: Company;
  customer?: Customer;
}

export function QuoteDocument({ quote, company, customer }: QuoteDocumentProps) {
  const totals = invoiceTotals(quote);
  const display = quoteState(quote);
  const rateRows = Object.entries(totals.perRate)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([rate, data]) => (
      <div className="row" key={rate}>
        <span>
          Btw {rate}% over {eur(data.base)}
        </span>
        <span className="v">{eur(data.vat)}</span>
      </div>
    ));

  return (
    <div className="paper print-page">
      <div className="paper-head">
        <div className="paper-brand">
          <span className="mark">{initials(company.naam)}</span>
          <span>
            <strong>{company.naam}</strong>
            <span>
              {company.adres} · {company.postcode} {company.plaats}
            </span>
          </span>
        </div>
        <div className="right" style={{ textAlign: "right" }}>
          <div
            className="tiny muted"
            style={{ letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}
          >
            Offerte
          </div>
          <div
            className="mono"
            style={{ fontSize: 17, fontWeight: 650, letterSpacing: "-.01em", marginTop: 2 }}
          >
            {quote.nummer}
          </div>
          <QuoteBadge state={display} />
        </div>
      </div>

      <h2>Offerte</h2>
      <div className="paper-meta">
        Offertedatum {fmtDate(quote.datum)} &nbsp;·&nbsp; Geldig tot {fmtDate(quote.geldigTot)}
      </div>

      <div className="paper-addresses">
        <div>
          <div className="label">Van</div>
          <strong>{company.naam}</strong>
          <br />
          {company.adres}
          <br />
          {company.postcode} {company.plaats}
          <br />
          {company.land}
          <br />
          <br />
          <span className="muted">
            KVK {company.kvk}
            <br />
            BTW {company.btw}
          </span>
        </div>
        <div>
          <div className="label">Aan</div>
          <strong>{customer?.naam || "—"}</strong>
          <br />
          {customer?.contact ? (
            <>
              {customer.contact}
              <br />
            </>
          ) : null}
          {customer?.adres ? (
            <>
              {customer.adres}
              <br />
            </>
          ) : null}
          {customer?.postcode || customer?.plaats ? (
            <>
              {customer?.postcode || ""} {customer?.plaats || ""}
              <br />
            </>
          ) : null}
          Nederland
          {customer?.btw ? (
            <>
              <br />
              <br />
              <span className="muted">BTW {customer.btw}</span>
            </>
          ) : null}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Omschrijving</th>
            <th className="num">Aantal</th>
            <th className="num">Prijs</th>
            <th className="num">Btw</th>
            <th className="num">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {quote.regels.map((regel) => {
            const line = lineTotals(regel);
            return (
              <tr key={regel.id}>
                <td>{regel.omschrijving || "—"}</td>
                <td className="num">{Number(regel.aantal)}</td>
                <td className="num">{eur(regel.prijs)}</td>
                <td className="num">{regel.btw}%</td>
                <td className="num">{eur(line.excl)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="paper-totals">
        <div className="row">
          <span>Subtotaal excl. btw</span>
          <span className="v">{eur(totals.excl)}</span>
        </div>
        {rateRows}
        <div className="row total">
          <span>Totaal</span>
          <span className="v">{eur(totals.incl)}</span>
        </div>
      </div>

      {quote.notitie ? <div className="paper-note">{quote.notitie}</div> : null}
      <div className="paper-note" style={{ borderTop: 0, paddingTop: 0, marginTop: 14 }}>
        {display === "geaccepteerd" ? (
          <>Deze offerte is geaccepteerd. We nemen de opdracht graag in planning.</>
        ) : display === "afgewezen" ? (
          <>Deze offerte is afgewezen. Neem gerust contact op als je iets wilt aanpassen.</>
        ) : (
          <>
            Deze offerte is geldig tot <strong>{fmtDate(quote.geldigTot)}</strong>. Akkoord? Laat
            het weten via {company.email} of {company.telefoon}.
          </>
        )}
      </div>

      <div className="paper-foot">
        <span>
          {company.naam} · {company.email} · {company.telefoon} · {company.website}
        </span>
        <span>Pagina 1 / 1</span>
      </div>
    </div>
  );
}
