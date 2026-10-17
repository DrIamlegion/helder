// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useState } from "react";
import { CATEGORIES } from "../data";
import { eur, expenseParts, parseAmount, todayISO } from "../lib";
import { useAppStore } from "../store";
import type { Expense, VatRate } from "../types";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

interface ExpenseModalProps {
  expense: Expense | null;
  onClose: () => void;
  onSaved?: (expense: Expense) => void;
}

export function ExpenseModal({ expense, onClose, onSaved }: ExpenseModalProps) {
  const { saveExpense } = useAppStore();
  const toast = useToast();
  const [form, setForm] = useState<Expense>(
    () =>
      expense ?? {
        id: "",
        datum: todayISO(),
        leverancier: "",
        omschrijving: "",
        categorie: CATEGORIES[0],
        bedragIncl: 0,
        btwTarief: 21,
        aftrekbaar: true,
      }
  );
  const [amount, setAmount] = useState(() =>
    expense ? Number(expense.bedragIncl).toFixed(2).replace(".", ",") : "0,00"
  );
  const [error, setError] = useState("");

  const parts = expenseParts({
    bedragIncl: parseAmount(amount),
    btwTarief: form.btwTarief,
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const bedragIncl = parseAmount(amount);
    if (!form.leverancier.trim()) {
      setError("Vul een leverancier in.");
      return;
    }
    if (bedragIncl <= 0) {
      setError("Vul een bedrag groter dan nul in.");
      return;
    }
    const saved: Expense = {
      ...form,
      leverancier: form.leverancier.trim(),
      omschrijving: form.omschrijving.trim(),
      bedragIncl,
      id: form.id || `exp-${Date.now().toString(36)}`,
    };
    saveExpense(saved);
    toast(expense ? "Uitgave bijgewerkt" : "Uitgave geboekt");
    onSaved?.(saved);
    onClose();
  }

  return (
    <Modal
      title={expense ? "Uitgave bewerken" : "Uitgave toevoegen"}
      subtitle="Boek een bon of factuur van een leverancier."
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Annuleren
          </button>
          <button className="btn btn-primary" type="submit" form="uitgave-form">
            {expense ? "Wijzigingen opslaan" : "Uitgave boeken"}
          </button>
        </>
      }
    >
      <form id="uitgave-form" className="form-grid" autoComplete="off" onSubmit={submit}>
        <div className="field">
          <label htmlFor="datum">Datum *</label>
          <input
            className="input"
            id="datum"
            type="date"
            value={form.datum}
            onChange={(event) => setForm((current) => ({ ...current, datum: event.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="categorie">Categorie</label>
          <select
            className="select"
            id="categorie"
            value={form.categorie}
            onChange={(event) => setForm((current) => ({ ...current, categorie: event.target.value }))}
          >
            {CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="leverancier">Leverancier *</label>
          <input
            className="input"
            id="leverancier"
            value={form.leverancier}
            onChange={(event) => setForm((current) => ({ ...current, leverancier: event.target.value }))}
            placeholder="Bijv. Adobe"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="bedragIncl">Bedrag incl. btw *</label>
          <input
            className="input"
            id="bedragIncl"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>
        <div className="field span-2">
          <label htmlFor="omschrijving">Omschrijving</label>
          <input
            className="input"
            id="omschrijving"
            value={form.omschrijving}
            onChange={(event) => setForm((current) => ({ ...current, omschrijving: event.target.value }))}
            placeholder="Waar ging deze uitgave over?"
          />
        </div>
        <div className="field">
          <label htmlFor="btwTarief">Btw-tarief</label>
          <select
            className="select"
            id="btwTarief"
            value={form.btwTarief}
            onChange={(event) =>
              setForm((current) => ({ ...current, btwTarief: Number(event.target.value) as VatRate }))
            }
          >
            <option value={21}>21%</option>
            <option value={9}>9%</option>
            <option value={0}>0% / geen btw</option>
          </select>
        </div>
        <div className="field">
          <label>Btw aftrekbaar</label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.aftrekbaar}
              onChange={(event) =>
                setForm((current) => ({ ...current, aftrekbaar: event.target.checked }))
              }
            />
            <span>Ik mag deze btw terugvorderen</span>
          </label>
        </div>
        <div className="span-2 breakdown">
          <div>
            <span>Excl. btw</span>
            <strong>{eur(parts.excl)}</strong>
          </div>
          <div>
            <span>Btw {parts.rate}%</span>
            <strong>{eur(parts.vat)}</strong>
          </div>
          <div>
            <span>{form.aftrekbaar ? "Terug te vorderen" : "Niet aftrekbaar"}</span>
            <strong>{eur(form.aftrekbaar ? parts.vat : 0)}</strong>
          </div>
        </div>
        {error ? <div className="form-error span-2">{error}</div> : null}
      </form>
    </Modal>
  );
}
