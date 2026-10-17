// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/Modal";
import { ProductModal } from "../components/ProductModal";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import { eur } from "../lib";
import { useAppStore } from "../store";
import type { Product } from "../types";

export function ProductsPage() {
  const { state, deleteProduct } = useAppStore();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  useTitle("Producten");

  useEffect(() => {
    if (searchParams.get("nieuw") === "1") {
      setEditing(null);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const term = search.trim().toLowerCase();
  const visible = state.producten.filter((product) =>
    !term
      ? true
      : `${product.naam} ${product.omschrijving} ${product.eenheid}`.toLowerCase().includes(term)
  );

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setModalOpen(true);
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteProduct(deleting.id);
    toast("Product verwijderd");
    setDeleting(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Producten &amp; diensten</h2>
          <p>Vaste regels voor offertes en facturen — met prijs, btw en eenheid.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={openNew}>
            <Icon name="plus" size={15} /> Nieuw product
          </button>
        </div>
      </div>

      <div className="card">
        <div className="list-toolbar">
          <div className="search">
            <Icon name="search" size={15} />
            <input
              className="input"
              type="search"
              placeholder="Zoek op naam of omschrijving…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Producten zoeken"
            />
          </div>
          <span className="grow" />
          <span className="small muted nowrap">
            {visible.length} {visible.length === 1 ? "product" : "producten"}
          </span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product of dienst</th>
                <th>Eenheid</th>
                <th className="num">Prijs excl. btw</th>
                <th>Btw</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="cell-main">
                      <span className="doc-icon">
                        <Icon name="package" size={15} />
                      </span>
                      <span>
                        <span className="strong">{product.naam}</span>
                        {product.omschrijving ? (
                          <span className="cell-sub">{product.omschrijving}</span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="muted">{product.eenheid}</td>
                  <td className="num strong">{eur(product.prijs)}</td>
                  <td>
                    <span className="badge badge-gray">{product.btw}%</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        type="button"
                        onClick={() => openEdit(product)}
                        title="Product bewerken"
                        aria-label={`${product.naam} bewerken`}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        type="button"
                        onClick={() => setDeleting(product)}
                        title="Product verwijderen"
                        aria-label={`${product.naam} verwijderen`}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 ? (
          <div className="table-empty">
            <div className="empty">
              <div className="empty-icon">
                <Icon name="package" size={19} />
              </div>
              <h4>{state.producten.length === 0 ? "Nog geen producten" : "Niets gevonden"}</h4>
              <p>
                {state.producten.length === 0
                  ? "Voeg je eerste product of dienst toe om sneller te factureren."
                  : "Pas je zoekopdracht aan om meer resultaten te zien."}
              </p>
              {state.producten.length === 0 ? (
                <button className="btn btn-primary" type="button" onClick={openNew}>
                  <Icon name="plus" size={15} /> Nieuw product
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            {visible.length} van {state.producten.length} producten
          </span>
          <span className="small muted">Kies een product in de factuur- of offerte-editor om het toe te voegen.</span>
        </div>
      </div>

      {modalOpen ? (
        <ProductModal product={editing} onClose={() => setModalOpen(false)} />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`${deleting.naam} verwijderen?`}
          message="Het product verdwijnt uit de catalogus. Regels op bestaande offertes en facturen blijven ongewijzigd."
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
