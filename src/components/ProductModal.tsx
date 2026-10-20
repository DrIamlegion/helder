// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useAppStore } from "../store";
import type { Product, VatRate } from "../types";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSaved?: (product: Product) => void;
}

const UNITS = ["uur", "stuk", "dagdeel", "maand", "project", "opdracht"];

const emptyProduct = (): Product => ({
  id: "",
  naam: "",
  omschrijving: "",
  prijs: 0,
  btw: 21,
  eenheid: "uur",
});

export function ProductModal({ product, onClose, onSaved }: ProductModalProps) {
  const { saveProduct } = useAppStore();
  const toast = useToast();
  const [form, setForm] = useState<Product>(() => (product ? { ...product } : emptyProduct()));
  const [error, setError] = useState("");

  const update =
    (field: keyof Product) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };

  function submit(event: FormEvent) {
    event.preventDefault();
    const naam = form.naam.trim();
    if (!naam) {
      setError("Vul een naam voor het product of de dienst in.");
      return;
    }
    const prijs = Number(form.prijs);
    if (!Number.isFinite(prijs) || prijs < 0) {
      setError("Vul een geldige prijs in.");
      return;
    }
    const saved: Product = {
      ...form,
      naam,
      omschrijving: form.omschrijving.trim(),
      prijs: Math.round(prijs * 100) / 100,
      btw: (Number(form.btw) === 9 ? 9 : Number(form.btw) === 0 ? 0 : 21) as VatRate,
      id: form.id || `prod-${Date.now().toString(36)}`,
    };
    saveProduct(saved);
    toast(product ? "Product bijgewerkt" : "Product toegevoegd");
    onSaved?.(saved);
    onClose();
  }

  return (
    <Modal
      title={product ? "Product bewerken" : "Nieuw product"}
      subtitle="Herbruikbare regels voor offertes en facturen."
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Annuleren
          </button>
          <button className="btn btn-primary" type="submit" form="product-form">
            {product ? "Wijzigingen opslaan" : "Product toevoegen"}
          </button>
        </>
      }
    >
      <form id="product-form" className="form-grid" autoComplete="off" onSubmit={submit}>
        <div className="field span-2">
          <label htmlFor="product-naam">Naam *</label>
          <input
            className="input"
            id="product-naam"
            value={form.naam}
            onChange={update("naam")}
            placeholder="Bijv. Websiteonderhoud"
            required
          />
        </div>
        <div className="field span-2">
          <label htmlFor="product-omschrijving">Omschrijving</label>
          <input
            className="input"
            id="product-omschrijving"
            value={form.omschrijving}
            onChange={update("omschrijving")}
            placeholder="Korte toelichting op de factuurregel"
          />
        </div>
        <div className="field">
          <label htmlFor="product-prijs">Prijs excl. btw *</label>
          <input
            className="input"
            id="product-prijs"
            type="number"
            min={0}
            step="0.01"
            value={form.prijs}
            onChange={update("prijs")}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="product-btw">Btw-tarief</label>
          <select
            className="select"
            id="product-btw"
            value={form.btw}
            onChange={update("btw")}
          >
            <option value={21}>21%</option>
            <option value={9}>9%</option>
            <option value={0}>0%</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="product-eenheid">Eenheid</label>
          <select
            className="select"
            id="product-eenheid"
            value={form.eenheid}
            onChange={update("eenheid")}
          >
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
        {error ? <div className="form-error span-2">{error}</div> : null}
      </form>
    </Modal>
  );
}
