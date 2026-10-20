// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CustomerModal } from "../components/CustomerModal";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { newInvoiceDraft } from "../data";
import { useTitle } from "../hooks";
import {
  addDays,
  daysBetween,
  eur,
  fmtDate,
  invoiceTotals,
  lineTotals,
  todayISO,
  uid,
} from "../lib";
import { useAppStore } from "../store";
import type {
  Invoice,
  InvoiceDraft,
  InvoiceLine,
  InvoiceStatus,
  VatRate,
} from "../types";

export function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceEditor key={id ?? "new"} id={id} />;
}

function InvoiceEditor({ id }: { id?: string }) {
  const { state, saveInvoice } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? state.facturen.find((f) => f.id === id) : undefined;

  const [draft, setDraft] = useState<InvoiceDraft>(() =>
    existing
      ? { ...existing, regels: existing.regels.map((r) => ({ ...r })) }
      : newInvoiceDraft(state)
  );
  const [termijn, setTermijn] = useState<string>(() => {
    const diff = daysBetween(draft.datum, draft.vervaldatum);
    return [7, 14, 30, 60].includes(diff) ? String(diff) : "custom";
  });
  const [statusValue, setStatusValue] = useState<InvoiceStatus>(existing?.status ?? "concept");
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useTitle(existing ? `Factuur ${existing.nummer}` : "Nieuwe factuur");

  if (id && !existing) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="alert" size={19} />
          </div>
          <h4>Niet gevonden</h4>
          <p>Deze factuur bestaat niet meer.</p>
          <Link className="btn btn-primary" to="/facturen">
            Naar facturen
          </Link>
        </div>
      </div>
    );
  }

  const totals = invoiceTotals(draft);
  const klant = state.relaties.find((r) => r.id === draft.klantId);

  function updateDraft<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
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

  function changeDatum(value: string) {
    setDraft((current) => ({
      ...current,
      datum: value,
      vervaldatum:
        termijn === "custom" ? current.vervaldatum : addDays(value, Number(termijn)),
    }));
  }

  function changeTermijn(value: string) {
    setTermijn(value);
    if (value !== "custom") {
      setDraft((current) => ({
        ...current,
        vervaldatum: addDays(current.datum, Number(value)),
      }));
    }
  }

  function changeVervaldatum(value: string) {
    const diff = daysBetween(draft.datum, value);
    setDraft((current) => ({ ...current, vervaldatum: value }));
    setTermijn([7, 14, 30, 60].includes(diff) ? String(diff) : "custom");
  }

  function handleSave(send: boolean) {
    const nextErrors: string[] = [];
    if (!draft.klantId) nextErrors.push("Kies een klant voor deze factuur.");
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
    if (!draft.vervaldatum || draft.vervaldatum < draft.datum) {
      nextErrors.push("De vervaldatum moet na de factuurdatum liggen.");
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);

    const idFinal = draft.id ?? `inv-${Date.now()}`;
    const status: InvoiceStatus = existing ? statusValue : send ? "verzonden" : "concept";
    const record: Invoice = {
      id: idFinal,
      nummer: draft.nummer,
      klantId: draft.klantId,
      datum: draft.datum,
      vervaldatum: draft.vervaldatum,
      status,
      regels,
      notitie: draft.notitie.trim(),
    };
    if (status === "betaald") {
      record.betaaldOp = draft.betaaldOp ?? todayISO();
    }
    saveInvoice(record);
    toast(
      existing
        ? "Factuur bijgewerkt"
        : send
          ? "Factuur opgeslagen en verzonden"
          : "Factuur opgeslagen als concept"
    );
    navigate(`/facturen/${idFinal}`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="back-link" to={existing ? `/facturen/${existing.id}` : "/facturen"}>
            <Icon name="arrowLeft" size={13} />{" "}
            {existing ? "Terug naar factuur" : "Facturen"}
          </Link>
          <h2>{existing ? `Factuur ${existing.nummer} bewerken` : "Nieuwe factuur"}</h2>
          <p>
            {existing
              ? "Wijzigingen worden direct in je administratie opgeslagen."
              : `Factuurnummer ${draft.nummer} wordt automatisch toegekend.`}
          </p>
        </div>
      </div>

      <div className="editor-grid">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Klant en factuurgegevens</h3>
            </div>
            <div className="card-body">
              <div className="form-grid">
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
                      updateDraft("klantId", event.target.value);
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
                  <label htmlFor="nummer">Factuurnummer</label>
                  <input className="input mono" id="nummer" value={draft.nummer} readOnly />
                </div>
                <div className="field">
                  <label htmlFor="datum">Factuurdatum</label>
                  <input
                    className="input"
                    id="datum"
                    type="date"
                    value={draft.datum}
                    onChange={(event) => changeDatum(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="termijn">Betaaltermijn</label>
                  <select
                    className="select"
                    id="termijn"
                    value={termijn}
                    onChange={(event) => changeTermijn(event.target.value)}
                  >
                    <option value="7">7 dagen</option>
                    <option value="14">14 dagen</option>
                    <option value="30">30 dagen</option>
                    <option value="60">60 dagen</option>
                    <option value="custom">Aangepast</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="vervaldatum">Vervaldatum</label>
                  <input
                    className="input"
                    id="vervaldatum"
                    type="date"
                    value={draft.vervaldatum}
                    onChange={(event) => changeVervaldatum(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Factuurregels</h3>
              <div className="right">
                <span className="small muted">Btw per regel</span>
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
                onChange={(event) => updateDraft("notitie", event.target.value)}
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
              {Object.keys(totals.perRate).length === 0 ? (
                <div className="row">
                  <span>Btw</span>
                  <span className="v">{eur(0)}</span>
                </div>
              ) : null}
              <div className="row total">
                <span>Totaal</span>
                <span className="v">{eur(totals.incl)}</span>
              </div>
            </div>
            <div className="divider mt-16" />
            <div className="small muted mt-12">
              Vervalt op <strong>{fmtDate(draft.vervaldatum)}</strong>
            </div>

            {existing ? (
              <div className="field mt-16">
                <label htmlFor="status">Status</label>
                <select
                  className="select"
                  id="status"
                  value={statusValue}
                  onChange={(event) => setStatusValue(event.target.value as InvoiceStatus)}
                >
                  <option value="concept">Concept</option>
                  <option value="verzonden">Verzonden</option>
                  <option value="betaald">Betaald</option>
                </select>
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
              {existing ? (
                <button className="btn btn-primary" type="button" onClick={() => handleSave(false)}>
                  <Icon name="check" size={15} /> Wijzigingen opslaan
                </button>
              ) : (
                <>
                  <button className="btn btn-primary" type="button" onClick={() => handleSave(true)}>
                    <Icon name="send" size={15} /> Opslaan en versturen
                  </button>
                  <button className="btn" type="button" onClick={() => handleSave(false)}>
                    Opslaan als concept
                  </button>
                </>
              )}
              <Link className="btn btn-ghost" to={existing ? `/facturen/${existing.id}` : "/facturen"}>
                Annuleren
              </Link>
            </div>
          </div>

          <div className="alert alert-info">
            <Icon name="info" size={16} />
            <span>
              Versturen markeert de factuur als verzonden. E-mailverzending koppelen we in een
              volgende versie — je kunt de factuur nu al printen of als PDF opslaan.
            </span>
          </div>
        </div>
      </div>

      {customerModalOpen ? (
        <CustomerModal
          customer={null}
          onClose={() => setCustomerModalOpen(false)}
          onSaved={(saved) => updateDraft("klantId", saved.id)}
        />
      ) : null}
    </>
  );
}
