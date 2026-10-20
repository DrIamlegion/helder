// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useAppStore } from "../store";
import type { Customer } from "../types";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

interface CustomerModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}

const emptyCustomer = (): Customer => ({
  id: "",
  naam: "",
  contact: "",
  email: "",
  telefoon: "",
  adres: "",
  postcode: "",
  plaats: "",
  btw: "",
  kvk: "",
});

export function CustomerModal({ customer, onClose, onSaved }: CustomerModalProps) {
  const { saveCustomer } = useAppStore();
  const toast = useToast();
  const [form, setForm] = useState<Customer>(() => (customer ? { ...customer } : emptyCustomer()));
  const [error, setError] = useState("");

  const update =
    (field: keyof Customer) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };

  function submit(event: FormEvent) {
    event.preventDefault();
    const naam = form.naam.trim();
    if (!naam) {
      setError("Vul een bedrijfs- of klantnaam in.");
      return;
    }
    const saved: Customer = {
      ...form,
      naam,
      id: form.id || `rel-${Date.now().toString(36)}`,
    };
    saveCustomer(saved);
    toast(customer ? "Klantgegevens bijgewerkt" : "Klant toegevoegd");
    onSaved?.(saved);
    onClose();
  }

  return (
    <Modal
      title={customer ? "Klant bewerken" : "Nieuwe klant"}
      subtitle={
        customer
          ? "Werk de gegevens van deze klant bij."
          : "Voeg een klant toe om facturen aan te koppelen."
      }
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Annuleren
          </button>
          <button className="btn btn-primary" type="submit" form="relatie-form">
            {customer ? "Wijzigingen opslaan" : "Klant toevoegen"}
          </button>
        </>
      }
    >
      <form id="relatie-form" className="form-grid" autoComplete="off" onSubmit={submit}>
        <div className="field span-2">
          <label htmlFor="naam">Bedrijfs- of klantnaam *</label>
          <input className="input" id="naam" value={form.naam} onChange={update("naam")} placeholder="Bijv. Brouwerij De Molen" required />
        </div>
        <div className="field">
          <label htmlFor="contact">Contactpersoon</label>
          <input className="input" id="contact" value={form.contact} onChange={update("contact")} placeholder="Voor- en achternaam" />
        </div>
        <div className="field">
          <label htmlFor="email">E-mailadres</label>
          <input className="input" id="email" type="email" value={form.email} onChange={update("email")} placeholder="naam@bedrijf.nl" />
        </div>
        <div className="field">
          <label htmlFor="telefoon">Telefoon</label>
          <input className="input" id="telefoon" value={form.telefoon} onChange={update("telefoon")} placeholder="020 123 45 67" />
        </div>
        <div className="field">
          <label htmlFor="kvk">KvK-nummer</label>
          <input className="input" id="kvk" value={form.kvk} onChange={update("kvk")} placeholder="12345678" />
        </div>
        <div className="field span-2">
          <label htmlFor="adres">Adres</label>
          <input className="input" id="adres" value={form.adres} onChange={update("adres")} placeholder="Straat en huisnummer" />
        </div>
        <div className="field">
          <label htmlFor="postcode">Postcode</label>
          <input className="input" id="postcode" value={form.postcode} onChange={update("postcode")} placeholder="1234 AB" />
        </div>
        <div className="field">
          <label htmlFor="plaats">Plaats</label>
          <input className="input" id="plaats" value={form.plaats} onChange={update("plaats")} placeholder="Amsterdam" />
        </div>
        <div className="field span-2">
          <label htmlFor="btw">Btw-nummer</label>
          <input className="input" id="btw" value={form.btw} onChange={update("btw")} placeholder="NL123456789B01" />
        </div>
        {error ? <div className="form-error span-2">{error}</div> : null}
      </form>
    </Modal>
  );
}
