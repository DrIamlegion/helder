// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CustomerModal } from "../components/CustomerModal";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import {
  RECURRING_INTERVALS,
  eur,
  fmtDate,
  intervalLabel,
  intervalPerYear,
  invoiceTotals,
  lineTotals,
  todayISO,
  uid,
} from "../lib";
import { useAppStore } from "../store";
import type {
  InvoiceLine,
  RecurringInterval,
  RecurringInvoice,
  VatRate,
} from "../types";

export function RecurringEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <RecurringEditor key={id ?? "new"} id={id} />;
}

function emptyRule(termijn: number, klantId: string): RecurringInvoice {
  return {
    id: "",
    naam: "",
    klantId,
    termijn,
    interval: "maandelijks",
    volgendeDatum: todayISO(),
    actief: true,
    regels: [{ id: uid(), omschrijving: "", aantal: 1, prijs: 0, btw: 21 }],
    notitie: "Bedankt voor de prettige samenwerking. Vragen over deze factuur? Mail gerust.",
  };
}

function RecurringEditor({ id }: { id?: string }) {
  const { state, saveRecurring } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? state.herhalingen.find((rule) => rule.id === id) : undefined;

  const [draft, setDraft] = useState<RecurringInvoice>(() =>
    existing
      ? { ...existing, regels: existing.regels.map((regel) => ({ ...regel })) }
      : emptyRule(Number(state.bedrijf.betaaltermijn) || 14, state.relaties[0]?.id ?? "")
  );
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useTitle(existing ? `Herhaling ${existing.naam}` : "Nieuwe herhaling");

  if (id && !existing) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="alert" size={19} />
          </div>
          <h4>Niet gevonden</h4>
          <p>Deze herhaling bestaat niet meer.</p>
          <Link className="btn btn-primary" to="/herhalingen">
            Naar herhalingen
          </Link>
        </div>
      </div>
    );
  }

  const totals = invoiceTotals(draft);
  const klant = state.relaties.find((relatie) => relatie.id === draft.klantId);
  const yearly = totals.incl * intervalPerYear(draft.interval);

  function update<K extends keyof RecurringInvoice>(key: K, value: RecurringInvoice[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateLine(lineId: string, patch: Partial<InvoiceLine>) {
    setDraft((current) => ({
      ...current,
      regels: current.regels.map((regel) =>
        regel.id === lineId ? { ...regel, ...patch } : regel
      ),
    }));
  }

  function addLine() {
    setDraft((current) => ({
      ...current,
      regels: [
        ...current.regels,
        { id: uid(), omschrijving: "", aantal: 1, prijs: 0, btw: 21 },
      ],
    }));
  }

  function addProduct(productId: string) {
    const product = state.producten.find((item) => item.id === productId);
    if (!product) return;
    setDraft((current) => {
      const blank = current.regels.find(
        (regel) => !regel.omschrijving.trim() && !Number(regel.prijs)
      );
      const line: InvoiceLine = {
        id: blank?.id ?? uid(),
        omschrijving: product.omschrijving
          ? `${product.naam} — ${product.omschrijving}`
          : product.naam,
        aantal: 1,
        prijs: product.prijs,
        btw: product.btw,
      };
      return {
        ...current,
        regels: blank
          ? current.regels.map((regel) => (regel.id === blank.id ? line : regel))
          : [...current.regels, line],
      };
    });
  }

  function removeLine(lineId: string) {
    setDraft((current) => ({
      ...current,
      regels: current.regels.filter((regel) => regel.id !== lineId),
    }));
  }

  function submit() {
    const nextErrors: string[] = [];
    const naam = draft.naam.trim();
    if (!naam) nextErrors.push("Geef deze herhaling een herkenbare naam.");
    if (!draft.klantId) nextErrors.push("Kies een klant voor deze herhaling.");
    const regels = draft.regels
      .filter((regel) => String(regel.omschrijving || "").trim())
      .map((regel) => ({
        ...regel,
        omschrijving: String(regel.omschrijving).trim(),
        aantal: Number(regel.aantal) || 1,
        prijs: Number(regel.prijs) || 0,
        btw: (Number(regel.btw) || 0) as VatRate,
      }));
    if (regels.length === 0) {
      nextErrors.push("Voeg minimaal één factuurregel met een omschrijving toe.");
    }
    if (regels.some((regel) => regel.prijs < 0)) {
      nextErrors.push("Een prijs kan niet negatief zijn.");
    }
    if (!draft.volgendeDatum) {
      nextErrors.push("Kies een datum voor de volgende factuur.");
    }
    if (draft.eindDatum && draft.eindDatum < draft.volgendeDatum) {
      nextErrors.push("De einddatum moet na de volgende factuurdatum liggen.");
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);

    const record: RecurringInvoice = {
      ...draft,
      id: draft.id || `rec-${uid()}`,
      naam,
      regels,
      notitie: draft.notitie.trim(),
      eindDatum: draft.eindDatum || undefined,
    };
    const created = saveRecurring(record);
    toast(
      created > 0
        ? `Herhaling opgeslagen · ${created} conceptfactuur${created === 1 ? "" : "en"} aangemaakt`
        : existing
          ? "Herhaling bijgewerkt"
          : "Herhaling opgeslagen"
    );
    navigate("/herhalingen");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="back-link" to="/herhalingen">
            <Icon name="arrowLeft" size={13} /> Terugkerende facturen
          </Link>
          <h2>{existing ? "Herhaling bewerken" : "Nieuwe herhaling"}</h2>
          <p>
            {existing
              ? "Wijzigingen gelden vanaf de volgende geplande factuur."
              : "Staat de volgende datum vandaag of in het verleden, dan maakt Helder direct een concept aan."}
          </p>
        </div>
      </div>

      <div className="editor-grid">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Klant en planning</h3>
              <div className="right">
                <span className="small muted">Concepten, geen automatische verzending</span>
              </div>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <div className="field span-2">
                  <label htmlFor="naam">Naam van de herhaling *</label>
                  <input
                    className="input"
                    id="naam"
                    value={draft.naam}
                    onChange={(event) => update("naam", event.target.value)}
                    placeholder="Bijv. Websiteonderhoud maandelijks"
                    required
                  />
                </div>
                <div className="field span-2">
                  <label htmlFor="klant">Klant</label>
                  <select
                    className="select"
                    id="klant"
                    value={draft.klantId}
                    onChange={(event) => {
                      if (event.target.value === "__new") {
                        setCustomerModalOpen(true);
                        return;
                      }
                      update("klantId", event.target.value);
                    }}
                  >
                    <option value="">Kies een klant…</option>
                    {state.relaties.map((relatie) => (
                      <option value={relatie.id} key={relatie.id}>
                        {relatie.naam}
                      </option>
                    ))}
                    <option value="__new">+ Nieuwe klant toevoegen</option>
                  </select>
                  <div className="hint">
                    {klant
                      ? `${klant.plaats || ""}${klant.btw ? ` · BTW ${klant.btw}` : ""}`
                      : "Nog geen klant gekozen"}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="interval">Interval</label>
                  <select
                    className="select"
                    id="interval"
                    value={draft.interval}
                    onChange={(event) =>
                      update("interval", event.target.value as RecurringInterval)
                    }
                  >
                    {RECURRING_INTERVALS.map((interval) => (
                      <option key={interval.value} value={interval.value}>
                        {interval.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="termijn">Betaaltermijn</label>
                  <select
                    className="select"
                    id="termijn"
                    value={draft.termijn}
                    onChange={(event) => update("termijn", Number(event.target.value))}
                  >
                    {[7, 14, 30, 60].map((dagen) => (
                      <option value={dagen} key={dagen}>
                        {dagen} dagen
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="volgendeDatum">Volgende factuurdatum</label>
                  <input
                    className="input"
                    id="volgendeDatum"
                    type="date"
                    value={draft.volgendeDatum}
                    onChange={(event) => update("volgendeDatum", event.target.value)}
                  />
                  <span className="hint">Eerdere openstaande momenten worden ingehaald.</span>
                </div>
                <div className="field">
                  <label htmlFor="eindDatum">Einddatum (optioneel)</label>
                  <input
                    className="input"
                    id="eindDatum"
                    type="date"
                    value={draft.eindDatum ?? ""}
                    onChange={(event) => update("eindDatum", event.target.value || undefined)}
                  />
                </div>
                <div className="field span-2">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.actief}
                      onChange={(event) => update("actief", event.target.checked)}
                    />
                    <span>Actief — maak automatisch concepten aan</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Factuurregels</h3>
              <div className="right">
                <span className="small muted">{intervalLabel(draft.interval)}</span>
              </div>
            </div>
            <div className="card-body">
              <div className="line-wrap">
                <table className="line-table">
                  <colgroup>
                    <col />
                    <col style={{ width: 74 }} />
                    <col style={{ width: 112 }} />
                    <col style={{ width: 92 }} />
                    <col style={{ width: 108 }} />
                    <col style={{ width: 34 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Omschrijving</th>
                      <th className="num">Aantal</th>
                      <th className="num">Prijs</th>
                      <th>Btw</th>
                      <th className="num">Totaal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.regels.map((regel) => (
                      <tr key={regel.id}>
                        <td>
                          <input
                            className="input"
                            placeholder="Omschrijving van de werkzaamheden"
                            value={regel.omschrijving}
                            onChange={(event) =>
                              updateLine(regel.id, { omschrijving: event.target.value })
                            }
                            aria-label="Omschrijving"
                          />
                        </td>
                        <td>
                          <input
                            className="input num"
                            type="number"
                            min={0}
                            step={0.5}
                            value={regel.aantal}
                            onChange={(event) =>
                              updateLine(regel.id, { aantal: Number(event.target.value) })
                            }
                            aria-label="Aantal"
                          />
                        </td>
                        <td>
                          <input
                            className="input num"
                            type="number"
                            min={0}
                            step="0.01"
                            value={regel.prijs}
                            onChange={(event) =>
                              updateLine(regel.id, { prijs: Number(event.target.value) })
                            }
                            aria-label="Prijs per stuk"
                          />
                        </td>
                        <td>
                          <select
                            className="select"
                            value={regel.btw}
                            onChange={(event) =>
                              updateLine(regel.id, {
                                btw: Number(event.target.value) as VatRate,
                              })
                            }
                            aria-label="Btw-tarief"
                          >
                            <option value={21}>21%</option>
                            <option value={9}>9%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                        <td className="num line-total">{eur(lineTotals(regel).excl)}</td>
                        <td>
                          <button
                            className="line-remove"
                            type="button"
                            onClick={() => removeLine(regel.id)}
                            aria-label="Regel verwijderen"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="line-actions">
                <button className="add-line" type="button" onClick={addLine}>
                  <Icon name="plus" size={13} /> Regel toevoegen
                </button>
                {state.producten.length > 0 ? (
                  <select
                    className="select product-picker"
                    value=""
                    onChange={(event) => {
                      addProduct(event.target.value);
                      event.currentTarget.value = "";
                    }}
                    aria-label="Product of dienst toevoegen"
                  >
                    <option value="">+ Product of dienst…</option>
                    {state.producten.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.naam} · {eur(product.prijs, { cents: false })}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Notitie op de factuur</h3>
            </div>
            <div className="card-body">
              <textarea
                className="textarea"
                value={draft.notitie}
                onChange={(event) => update("notitie", event.target.value)}
                placeholder="Bijvoorbeeld een bedankje of betaalinstructie…"
              />
            </div>
          </div>
        </div>

        <div className="stack sticky-side">
          <div className="card card-pad">
            <h3 style={{ fontSize: 14.5, fontWeight: 640, marginBottom: 14 }}>Samenvatting</h3>
            <div className="totals">
              <div className="row">
                <span>Subtotaal excl. btw</span>
                <span className="v">{eur(totals.excl)}</span>
              </div>
              {Object.entries(totals.perRate)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([rate, data]) => (
                  <div className="row" key={rate}>
                    <span>Btw {rate}%</span>
                    <span className="v">{eur(data.vat)}</span>
                  </div>
                ))}
              <div className="row total">
                <span>Per factuur</span>
                <span className="v">{eur(totals.incl)}</span>
              </div>
            </div>
            <div className="divider mt-16" />
            <div className="row-between mt-12 small">
              <span className="muted">Interval</span>
              <strong>{intervalLabel(draft.interval)}</strong>
            </div>
            <div className="row-between mt-8 small">
              <span className="muted">Jaarlijks</span>
              <strong>{eur(yearly)}</strong>
            </div>
            <div className="row-between mt-8 small">
              <span className="muted">Volgende factuur</span>
              <strong>{fmtDate(draft.volgendeDatum, "medium")}</strong>
            </div>
            {existing?.laatsteFactuurId ? (
              <div className="row-between mt-8 small">
                <span className="muted">Laatste concept</span>
                <Link className="link" to={`/facturen/${existing.laatsteFactuurId}`}>
                  Bekijken
                </Link>
              </div>
            ) : null}

            {errors.length > 0 ? (
              <div className="form-error">
                {errors.map((error) => (
                  <div key={error}>
                    <Icon name="alert" size={14} />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="stack mt-16" style={{ gap: 8 }}>
              <button className="btn btn-primary" type="button" onClick={submit}>
                <Icon name="check" size={15} /> Herhaling opslaan
              </button>
              <Link className="btn btn-ghost" to="/herhalingen">
                Annuleren
              </Link>
            </div>
          </div>

          <div className="alert alert-info">
            <Icon name="info" size={16} />
            <span>
              Helder opent op de geplande datum automatisch een conceptfactuur met deze regels.
              Versturen blijft handwerk.
            </span>
          </div>
        </div>
      </div>

      {customerModalOpen ? (
        <CustomerModal
          customer={null}
          onClose={() => setCustomerModalOpen(false)}
          onSaved={(saved) => update("klantId", saved.id)}
        />
      ) : null}
    </>
  );
}
