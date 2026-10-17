// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Icon } from "../components/Icon";
import { useTitle } from "../hooks";
import { addDays, copyText, eur, fmtDate, fmtDateTime, initials } from "../lib";
import { intervalKort, termijnBedragen } from "../paymentPlans";
import { buildAcceptance, decodePlanLink, paymentLinkHost } from "../planLink";
import { useParams } from "react-router-dom";

// Openbare pagina voor de klant: de afspraak staat in de link zelf, dus er is geen
// server of inlog nodig. Het akkoord gaat terug als bevestigingscode.
export function PlanAcceptPage() {
  const { token } = useParams<{ token: string }>();
  // Een andere link in hetzelfde tabblad is een andere klant: begin met een schone pagina.
  return <PlanAcceptView key={token} token={token} />;
}

function PlanAcceptView({ token }: { token: string | undefined }) {
  const data = decodePlanLink(token);
  const [akkoord, setAkkoord] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [gekopieerd, setGekopieerd] = useState(false);
  const [betaalGestart, setBetaalGestart] = useState(false);

  useTitle("Betaalregeling");

  if (!data) {
    return (
      <div className="public-page">
        <header className="public-top">
          <span className="mark">H</span>
          <div>
            <strong>Helder</strong>
            <span>Betaalregeling</span>
          </div>
        </header>
        <main className="public-card">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="alert" size={19} />
            </div>
            <h4>Deze link werkt niet</h4>
            <p>
              De link is onvolledig of verouderd. Vraag de afzender om een nieuwe link of neem
              contact op via de gegevens in de brief.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const schema = termijnBedragen(data.totaal, data.termijnen).map((bedrag, index) => ({
    nummer: index + 1,
    datum: addDays(data.eersteTermijn, index * data.intervalDagen),
    bedrag,
  }));
  const schemaTotaal = schema.reduce((som, termijn) => som + termijn.bedrag, 0);
  const code = acceptedAt
    ? buildAcceptance(
        {
          id: data.planId,
          termijnen: data.termijnen,
          totaal: data.totaal,
          intervalDagen: data.intervalDagen,
          eersteTermijn: data.eersteTermijn,
        },
        acceptedAt
      )
    : "";
  const mailto = `mailto:${data.bedrijf.email}?subject=${encodeURIComponent(
    `Akkoord betaalregeling factuur ${data.nummer}`
  )}&body=${encodeURIComponent(
    `Hallo,\n\nIk ga akkoord met de betaalregeling voor factuur ${data.nummer}: ` +
      `${data.termijnen} termijnen van ${eur(data.bedragPerTermijn)}, ` +
      `eerste termijn ${fmtDate(data.eersteTermijn)}.\n\n` +
      `Bevestigingscode: ${code}\n\nMet vriendelijke groet,\n${data.klant}`
  )}`;

  async function kopieer() {
    const ok = await copyText(code);
    setGekopieerd(ok);
  }

  return (
    <div className="public-page">
      <header className="public-top">
        <span className="mark">{initials(data.bedrijf.naam)}</span>
        <div>
          <strong>{data.bedrijf.naam}</strong>
          <span>Betaalregeling · factuur {data.nummer}</span>
        </div>
      </header>

      <main className="public-card">
        <div className="public-intro">
          <div className="public-chips">
            <span className="chip">
              <Icon name="calendar" size={12} /> Voorstel in termijnen
            </span>
            {data.betaalLink ? (
              <span className="chip chip-brand">
                <Icon name="creditCard" size={12} /> iDEAL na je akkoord
              </span>
            ) : null}
          </div>
          <h1>Betaalregeling voor factuur {data.nummer}</h1>
          <p>
            Beste {data.klant}, {data.bedrijf.naam} stelt voor het openstaande bedrag in{" "}
            {data.termijnen} termijnen te betalen. Hieronder staat het volledige aflosschema.
          </p>
        </div>

        <div className="letter-plan accept-plan">
          <div className="letter-plan-head">
            <strong>
              {data.termijnen} termijnen van {eur(data.bedragPerTermijn)}
            </strong>
            <span>
              {intervalKort(data.intervalDagen)} · eerste termijn{" "}
              {fmtDate(data.eersteTermijn)}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Termijn</th>
                <th>Vervaldatum</th>
                <th className="num">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {schema.map((termijn) => (
                <tr key={termijn.nummer}>
                  <td>Termijn {termijn.nummer}</td>
                  <td>{fmtDate(termijn.datum)}</td>
                  <td className="num">{eur(termijn.bedrag)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Totaal</td>
                <td className="num">{eur(schemaTotaal)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="letter-plan-note">
            Zolang je deze termijnen op tijd betaalt, pauzeren de aanmaningen en vervallen de
            incassokosten en de wettelijke rente. Je betaalt op {data.bedrijf.iban} ten name van{" "}
            {data.bedrijf.naam}, onder vermelding van {data.nummer}.
          </p>
        </div>

        {acceptedAt ? (
          <div className="accept-done">
            <div className="accept-done-head">
              <span className="empty-icon">
                <Icon name="checkCircle" size={19} />
              </span>
              <div>
                <h3>Akkoord vastgelegd</h3>
                <p>
                  Je ging op <strong>{fmtDateTime(acceptedAt)}</strong> akkoord met{" "}
                  {data.termijnen} termijnen voor factuur {data.nummer}.
                </p>
              </div>
            </div>
            {data.betaalLink ? (
              <div className="accept-pay">
                <div className="accept-pay-head">
                  <span className="ideal-mark" aria-hidden="true">
                    iDEAL
                  </span>
                  <div>
                    <strong>Betaal meteen de eerste termijn van {eur(schema[0].bedrag)}</strong>
                    <p className="tiny muted">
                      Je betaalt veilig in je eigen bankomgeving via{" "}
                      {paymentLinkHost(data.betaalLink)}. De rest van de termijnen betaal je op de
                      afgesproken data.
                    </p>
                  </div>
                </div>
                <a
                  className="btn btn-primary accept-pay-btn"
                  href={data.betaalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setBetaalGestart(true)}
                >
                  <Icon name="creditCard" size={15} /> Betaal {eur(schema[0].bedrag)} met iDEAL
                </a>
                <p className="tiny muted accept-pay-note">
                  {betaalGestart
                    ? "De betaalpagina is in een nieuw tabblad geopend. Je kunt hem hier altijd opnieuw openen."
                    : `Liever zelf overmaken? Gebruik ${data.bedrijf.iban} o.v.v. ${data.nummer}.`}
                </p>
                <span className="accept-pay-url">{data.betaalLink}</span>
              </div>
            ) : (
              <p className="small muted">
                Maak de eerste termijn van {eur(schema[0].bedrag)} over op {data.bedrijf.iban} onder
                vermelding van {data.nummer}.
              </p>
            )}
            <p className="small muted">
              Stuur de bevestigingscode terug naar {data.bedrijf.email}, dan legt{" "}
              {data.bedrijf.naam} je akkoord vast in de administratie.
            </p>
            <div className="code-box">
              <code>{code}</code>
              <button className="btn btn-sm" type="button" onClick={kopieer}>
                <Icon name="copy" size={13} /> {gekopieerd ? "Gekopieerd" : "Kopieer"}
              </button>
            </div>
            <div className="accept-actions no-print">
              <a className="btn btn-primary" href={mailto}>
                <Icon name="mail" size={14} /> Stuur de bevestiging
              </a>
              <button className="btn" type="button" onClick={() => window.print()}>
                <Icon name="printer" size={14} /> Print bevestiging
              </button>
            </div>
          </div>
        ) : (
          <div className="accept-confirm no-print">
            <label className="accept-check">
              <input
                type="checkbox"
                checked={akkoord}
                onChange={(event) => setAkkoord(event.target.checked)}
              />
              <span>
                Ik ga akkoord met {data.termijnen} termijnen van {eur(data.bedragPerTermijn)} volgens
                dit aflosschema.
              </span>
            </label>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!akkoord}
              onClick={() => setAcceptedAt(new Date().toISOString())}
            >
              <Icon name="check" size={14} /> Akkoord geven
            </button>
            <p className="tiny muted">
              Je akkoord wordt met tijdstip vastgelegd. Er is geen account nodig.
              {data.betaalLink ? " Daarna betaal je de eerste termijn direct met iDEAL." : ""}
            </p>
          </div>
        )}
      </main>

      <p className="public-foot">
        Vragen over deze regeling? Neem contact op via{" "}
        <a href={`mailto:${data.bedrijf.email}`}>{data.bedrijf.email}</a>
        {data.bedrijf.telefoon ? ` of bel ${data.bedrijf.telefoon}` : ""}.
      </p>
    </div>
  );
}
