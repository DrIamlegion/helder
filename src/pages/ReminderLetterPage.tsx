// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import { copyText, eur, fmtDate, initials, invoiceState, invoiceTotals, todayISO, uid } from "../lib";
import {
  normalisePaymentLink,
  paymentLinkHost,
  planLinkData,
  planShareUrl,
} from "../planLink";
import {
  intervalKort,
  newPaymentPlan,
  PLAN_INTERVALLEN,
  activePaymentPlan,
} from "../paymentPlans";
import {
  plannedReminder,
  reminderLetter,
  reminderLevelInfo,
  REMINDER_LEVELS,
} from "../reminders";
import { useAppStore } from "../store";
import type { ReminderLevel } from "../types";

function isLevel(value: number): value is ReminderLevel {
  return value === 1 || value === 2 || value === 3;
}

export function ReminderLetterPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { state, sendReminder, savePaymentPlan, setPlanPaymentLink } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();

  const invoice = state.facturen.find((item) => item.id === id);
  const plan = invoice ? plannedReminder(invoice, state.herinneringen) : null;
  const requested = Number(params.get("niveau"));
  const [niveau, setNiveau] = useState<ReminderLevel>(
    isLevel(requested) ? requested : plan?.concept?.niveau ?? plan?.niveau ?? 1
  );
  // Loopt er al een regeling, dan tonen we die termijnen en hergebruiken we het id: de link op
  // een herdrukte brief hoort dan bij dezelfde afspraak.
  const actieveRegeling = invoice
    ? activePaymentPlan(state.betaalregelingen, invoice.id)
    : undefined;
  const [termijnen, setTermijnen] = useState(actieveRegeling?.termijnen ?? 3);
  const [intervalDagen, setIntervalDagen] = useState(actieveRegeling?.intervalDagen ?? 30);
  // Deelbare link en opgeslagen regeling delen hetzelfde id, zodat het akkoord van de klant
  // later bij precies deze afspraak hoort.
  const planId = useMemo(
    () => actieveRegeling?.id ?? `plan-${uid()}`,
    [id, actieveRegeling?.id]
  );
  // De betaallink staat naast de deellink: de klant betaalt er de eerste termijn mee.
  const [betaalLink, setBetaalLink] = useState(actieveRegeling?.betaalLink ?? "");
  const [linkFout, setLinkFout] = useState("");

  useTitle(invoice ? `Brief ${invoice.nummer}` : "Betaalbrief");

  if (!invoice) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="alert" size={19} />
          </div>
          <h4>Factuur niet gevonden</h4>
          <p>Deze factuur bestaat niet meer, dus er valt niets te herinneren.</p>
          <Link className="btn btn-primary" to="/aanmaningen">
            Naar aanmaningen
          </Link>
        </div>
      </div>
    );
  }

  const display = invoiceState(invoice);
  const klant = state.relaties.find((relatie) => relatie.id === invoice.klantId);
  const bedrijf = state.bedrijf;
  // Ook zonder ?concept= in de URL hoort een klaargezet voorstel bij deze brief: stuur je hem,
  // dan wordt dat voorstel verzonden in plaats van dat er een dubbel record ontstaat.
  const conceptId = params.get("concept");
  const concept =
    (conceptId
      ? state.herinneringen.find(
          (reminder) =>
            reminder.id === conceptId &&
            reminder.factuurId === invoice.id &&
            reminder.status === "concept"
        )
      : undefined) ??
    state.herinneringen.find(
      (reminder) =>
        reminder.factuurId === invoice.id &&
        reminder.status === "concept" &&
        !reminder.genegeerdOp
    );

  function changeLevel(next: ReminderLevel) {
    setNiveau(next);
    // Behoud een klaargezet voorstel in de URL, ook als je tijdelijk een ander niveau bekijkt.
    setParams({ ...Object.fromEntries(params.entries()), niveau: String(next) }, { replace: true });
  }

  function markSent() {
    const reminder = sendReminder(invoice!.id, niveau, concept?.id);
    toast(`${reminderLevelInfo(reminder.niveau).label} voor ${invoice!.nummer} geregistreerd`);
    navigate("/aanmaningen");
  }

  // De brief gaat de deur uit en de afspraak staat meteen vast: vanaf nu pauzeren de aanmaningen.
  function sendWithPlan() {
    if (!regeling) return;
    sendReminder(invoice!.id, niveau, concept?.id);
    savePaymentPlan(
      newPaymentPlan(invoice!, {
        id: planId,
        termijnen,
        intervalDagen,
        eersteTermijn: regeling.eersteTermijn,
        betaalLink: normalisePaymentLink(betaalLink) ?? undefined,
        notitie: `Voorgesteld op de laatste aanmaning van ${fmtDate(todayISO(), "medium")}`,
      })
    );
    toast(
      `Laatste aanmaning en betaalregeling van ${termijnen} termijnen vastgelegd voor ${invoice!.nummer}`
    );
    navigate("/aanmaningen");
  }

  if (display === "concept" || display === "betaald") {
    return (
      <>
        <div className="page-head">
          <div>
            <Link className="back-link" to={`/facturen/${invoice.id}`}>
              <Icon name="arrowLeft" size={13} /> Factuur {invoice.nummer}
            </Link>
            <h2>Geen brief nodig</h2>
            <p>
              {display === "betaald"
                ? "Deze factuur is betaald; er valt niets te herinneren."
                : "Deze factuur is nog een concept. Markeer hem eerst als verzonden."}
            </p>
          </div>
          <div className="actions">
            <Link className="btn btn-primary" to={`/facturen/${invoice.id}`}>
              <Icon name="invoice" size={15} /> Naar de factuur
            </Link>
          </div>
        </div>
        <div className="alert alert-info">
          <Icon name="info" size={16} />
          <span>
            Alleen verzonden en vervallen facturen komen in het aanmaningsoverzicht terecht.
          </span>
        </div>
      </>
    );
  }

  const letter = reminderLetter(state, invoice, niveau, todayISO(), { termijnen, intervalDagen });
  const info = reminderLevelInfo(niveau);
  const totals = invoiceTotals(invoice);
  const regeling = letter.regeling;
  const bestaandeRegeling = activePaymentPlan(state.betaalregelingen, invoice.id);
  // Wat er nu in het veld staat telt; anders de link die al bij de regeling hoort.
  const betaalLinkNu = normalisePaymentLink(betaalLink) ?? bestaandeRegeling?.betaalLink;
  const deelLink = regeling
    ? planShareUrl(
        planLinkData(
          {
            id: planId,
            termijnen: regeling.termijnen,
            totaal: regeling.totaal,
            bedragPerTermijn: regeling.bedragPerTermijn,
            intervalDagen: regeling.intervalDagen,
            eersteTermijn: regeling.eersteTermijn,
            betaalLink: betaalLinkNu,
          },
          invoice,
          klant?.naam || "de klant",
          bedrijf
        )
      )
    : "";

  async function shareLink() {
    if (!deelLink) return;
    const ok = await copyText(deelLink);
    toast(ok ? "Deellink gekopieerd — stuur hem naar de klant" : "Kopieer de link uit het veld");
  }

  // Leegmaken mag: dan betaalt de klant de eerste termijn gewoon per overboeking.
  function saveBetaalLink() {
    const raw = betaalLink.trim();
    if (!raw) {
      setLinkFout("");
      if (bestaandeRegeling) setPlanPaymentLink(bestaandeRegeling.id, undefined);
      toast("Betaallink verwijderd");
      return;
    }
    const normalised = normalisePaymentLink(raw);
    if (!normalised) {
      setLinkFout("Plak een volledige https-link, bijvoorbeeld uit Mollie, Stripe of je bank.");
      return;
    }
    setLinkFout("");
    setBetaalLink(normalised);
    if (bestaandeRegeling) setPlanPaymentLink(bestaandeRegeling.id, normalised);
    toast(
      bestaandeRegeling
        ? "Betaallink opgeslagen — de klant betaalt de eerste termijn met iDEAL"
        : "Betaallink komt in de deellink en wordt bij het versturen opgeslagen"
    );
  }

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link className="back-link" to="/aanmaningen">
            <Icon name="arrowLeft" size={13} /> Aanmaningen
          </Link>
          <h2>{info.label} — factuur {invoice.nummer}</h2>
          <p>
            {klant?.naam || "Onbekende klant"} · {eur(totals.incl)} ·{" "}
            {letter.dagenTeLaat} {letter.dagenTeLaat === 1 ? "dag" : "dagen"} te laat
          </p>
        </div>
        <div className="actions">
          <div className="seg" role="group" aria-label="Niveau van de brief">
            {REMINDER_LEVELS.map((level) => (
              <button
                type="button"
                key={level.niveau}
                className={niveau === level.niveau ? "on" : ""}
                onClick={() => changeLevel(level.niveau)}
              >
                {level.label}
              </button>
            ))}
          </div>
          {regeling ? (
            <>
              <select
                className="select"
                style={{ width: 132 }}
                value={termijnen}
                onChange={(event) => setTermijnen(Number(event.target.value))}
                aria-label="Aantal termijnen"
              >
                {[2, 3, 4, 5, 6].map((aantal) => (
                  <option value={aantal} key={aantal}>
                    {aantal} termijnen
                  </option>
                ))}
              </select>
              <select
                className="select"
                style={{ width: 150 }}
                value={intervalDagen}
                onChange={(event) => setIntervalDagen(Number(event.target.value))}
                aria-label="Interval van de termijnen"
              >
                {PLAN_INTERVALLEN.map((interval) => (
                  <option value={interval.dagen} key={interval.dagen}>
                    {intervalKort(interval.dagen)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <Link className="btn" to={`/facturen/${invoice.id}`}>
            <Icon name="invoice" size={14} /> Factuur
          </Link>
          {regeling ? (
            <button className="btn" type="button" onClick={shareLink}>
              <Icon name="copy" size={14} /> Deellink
            </button>
          ) : null}
          <button className="btn" type="button" onClick={() => window.print()}>
            <Icon name="printer" size={14} /> Print / PDF
          </button>
          {regeling ? (
            <button className="btn btn-primary" type="button" onClick={sendWithPlan}>
              <Icon name="send" size={14} /> Versturen + regeling vastleggen
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={markSent}>
              <Icon name="send" size={14} /> Markeer als verzonden
            </button>
          )}
        </div>
      </div>

      <div className="alert alert-info no-print mb-16">
        <Icon name="info" size={16} />
        <span>
          {concept && concept.niveau === niveau
            ? "Helder heeft deze brief voor je klaargezet. Controleer de tekst en markeer hem daarna als verzonden."
            : concept
              ? `Helder zette een ${reminderLevelInfo(concept.niveau).label.toLowerCase()} klaar; je koos nu een ander niveau, dus dat voorstel komt te vervallen.`
              : info.beschrijving}{" "}
          {bestaandeRegeling
            ? `Let op: er loopt al een betaalregeling (${bestaandeRegeling.termijnen} termijnen, ${intervalKort(bestaandeRegeling.intervalDagen).toLowerCase()}); een nieuwe regeling vervangt die.`
            : null}{" "}
          {plan && plan.verstuurd.length > 0
            ? `Eerder verstuurd: ${plan.verstuurd.length} brief${plan.verstuurd.length === 1 ? "" : "ven"}, laatst op ${fmtDate(plan.laatste!.verzondenOp || plan.laatste!.aangemaaktOp, "medium")} (${reminderLevelInfo(plan.laatste!.niveau).label.toLowerCase()}).`
            : "Voor deze factuur is nog geen brief verstuurd."}
        </span>
      </div>

      {regeling && deelLink ? (
        <div className="share-row no-print">
          <Icon name="external" size={15} />
          <input
            className="input mono"
            readOnly
            value={deelLink}
            aria-label="Deelbare link naar de betaalregeling"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button className="btn btn-sm" type="button" onClick={shareLink}>
            <Icon name="copy" size={13} /> Kopieer
          </button>
        </div>
      ) : null}

      {regeling ? (
        <div className="paylink no-print">
          <div className="paylink-head">
            <span className="paylink-icon">
              <Icon name="creditCard" size={15} />
            </span>
            <div>
              <strong>iDEAL-betaallink voor de eerste termijn</strong>
              <p className="tiny muted">
                Maak in Mollie, Stripe of je bank een betaallink van{" "}
                {eur(regeling.bedragPerTermijn)} voor factuur {invoice.nummer} en plak hem hier. Na
                het akkoord ziet de klant meteen een betaalknop.
              </p>
            </div>
          </div>
          <div className="paylink-input">
            <input
              className="input mono"
              value={betaalLink}
              onChange={(event) => {
                setBetaalLink(event.target.value);
                if (linkFout) setLinkFout("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveBetaalLink();
              }}
              placeholder="https://payment-links.mollie.com/payments/…"
              aria-label="Betaallink voor de eerste termijn"
              aria-invalid={linkFout ? true : undefined}
            />
            <button className="btn btn-sm" type="button" onClick={saveBetaalLink}>
              <Icon name="check" size={13} /> Opslaan
            </button>
          </div>
          {linkFout ? (
            <p className="paylink-error" role="alert">
              {linkFout}
            </p>
          ) : null}
          <p className="paylink-note tiny muted">
            {betaalLinkNu
              ? `De klant betaalt veilig via ${paymentLinkHost(betaalLinkNu)}.`
              : "Zonder betaallink betaalt de klant de eerste termijn via een overboeking op de IBAN in de brief."}
          </p>
        </div>
      ) : null}

      <div className="paper-wrap">
        <div className="paper print-page">
          <div className="paper-head">
            <div className="paper-brand">
              <span className="mark">{initials(bedrijf.naam)}</span>
              <span>
                <strong>{bedrijf.naam}</strong>
                <span>
                  {bedrijf.adres} · {bedrijf.postcode} {bedrijf.plaats}
                </span>
              </span>
            </div>
            <div className="right" style={{ textAlign: "right" }}>
              <div
                className="tiny muted"
                style={{ letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}
              >
                {niveau === 1 ? "Herinnering" : niveau === 2 ? "Aanmaning" : "Laatste aanmaning"}
              </div>
              <div
                className="mono"
                style={{ fontSize: 17, fontWeight: 650, letterSpacing: "-.01em", marginTop: 2 }}
              >
                {invoice.nummer}
              </div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {fmtDate(letter.datum)}
              </div>
            </div>
          </div>

          <h2>{letter.label}</h2>
          <div className="paper-meta">
            Factuur {invoice.nummer} van {fmtDate(invoice.datum)} · vervallen sinds{" "}
            {fmtDate(invoice.vervaldatum)}
          </div>

          <div className="paper-addresses">
            <div>
              <div className="label">Van</div>
              <strong>{bedrijf.naam}</strong>
              <br />
              {bedrijf.adres}
              <br />
              {bedrijf.postcode} {bedrijf.plaats}
              <br />
              <br />
              <span className="muted">
                IBAN {bedrijf.iban}
                <br />
                {bedrijf.email}
                <br />
                {bedrijf.telefoon}
              </span>
            </div>
            <div>
              <div className="label">Aan</div>
              <strong>{letter.klantNaam}</strong>
              <br />
              {klant?.contact ? (
                <>
                  {klant.contact}
                  <br />
                </>
              ) : null}
              {klant?.adres ? (
                <>
                  {klant.adres}
                  <br />
                </>
              ) : null}
              {klant?.postcode || klant?.plaats ? (
                <>
                  {klant?.postcode || ""} {klant?.plaats || ""}
                  <br />
                </>
              ) : null}
              Nederland
            </div>
          </div>

          <div className="letter-body">
            <div className="letter-subject">{letter.onderwerp}</div>
            <p>{letter.aanhef}</p>
            {letter.alineas.map((alinea) => (
              <p key={alinea.slice(0, 32)}>{alinea}</p>
            ))}
            {regeling ? (
              <div className="letter-plan">
                <div className="letter-plan-head">
                  <strong>
                    Betaalregeling: {regeling.termijnen} termijnen van {eur(regeling.bedragPerTermijn)}
                  </strong>
                  <span>
                    {intervalKort(regeling.intervalDagen)} · eerste termijn{" "}
                    {fmtDate(regeling.eersteTermijn)}
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
                    {regeling.schema.map((termijn) => (
                      <tr key={termijn.nummer}>
                        <td>Termijn {termijn.nummer}</td>
                        <td>{fmtDate(termijn.datum)}</td>
                        <td className="num">{eur(termijn.bedrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="letter-plan-note">
                  Het schema gaat uit van het openstaande factuurbedrag van {eur(regeling.totaal)}.
                  Zolang je deze termijnen op tijd betaalt, pauzeren wij de aanmaningen en vervallen de
                  incassokosten en de wettelijke rente.
                </p>
                <p className="letter-plan-link">
                  Online akkoord geven kan via <span>{deelLink}</span>
                </p>
              </div>
            ) : null}
            <p>
              {letter.sluiting}
              <br />
              <br />
              <strong>{bedrijf.eigenaar}</strong>
              <br />
              {bedrijf.naam}
            </p>
          </div>

          {niveau === 3 ? (
            <div className="paper-totals letter-summary">
              <div className="row">
                <span>Openstaand bedrag</span>
                <span className="v">{eur(letter.bedrag)}</span>
              </div>
              <div className="row">
                <span>Buitengerechtelijke incassokosten</span>
                <span className="v">{eur(letter.incassokosten)}</span>
              </div>
              <div className="row total">
                <span>Totaal te betalen</span>
                <span className="v">{eur(letter.totaal)}</span>
              </div>
            </div>
          ) : null}

          <div className="paper-foot">
            <span>
              {bedrijf.naam} · {bedrijf.email} · {bedrijf.telefoon} · {bedrijf.website}
            </span>
            <span>Pagina 1 / 1</span>
          </div>
        </div>
      </div>
    </>
  );
}
