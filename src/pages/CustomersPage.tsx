// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CustomerModal } from "../components/CustomerModal";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import { eur, initials, invoiceState, invoiceTotals } from "../lib";
import { useAppStore } from "../store";
import type { Customer } from "../types";

export function CustomersPage() {
  const { state, deleteCustomer } = useAppStore();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  useTitle("Klanten");

  useEffect(() => {
    if (searchParams.get("nieuw") === "1") {
      setEditing(null);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const year = new Date().getFullYear();
  const customers = state.relaties
    .map((relatie) => {
      const invoices = state.facturen.filter((f) => f.klantId === relatie.id);
      const revenue = invoices
        .filter((f) => f.status !== "concept" && f.datum.startsWith(String(year)))
        .reduce((total, f) => total + invoiceTotals(f).excl, 0);
      const open = invoices
        .filter((f) => ["verzonden", "vervallen"].includes(invoiceState(f)))
        .reduce((total, f) => total + invoiceTotals(f).incl, 0);
      return { relatie, count: invoices.length, revenue, open };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = customers.reduce((total, customer) => total + customer.revenue, 0);
  const term = search.trim().toLowerCase();
  const visible = customers.filter(({ relatie }) =>
    `${relatie.naam} ${relatie.plaats} ${relatie.email} ${relatie.contact}`.toLowerCase().includes(term)
  );

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function askDelete(relatie: Customer) {
    const count = state.facturen.filter((f) => f.klantId === relatie.id).length;
    if (count > 0) {
      toast(`Deze klant heeft nog ${count} ${count === 1 ? "factuur" : "facturen"} — verwijder eerst de facturen`);
      return;
    }
    setDeleting(relatie);
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteCustomer(deleting.id);
    toast("Klant verwijderd");
    setDeleting(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Klanten</h2>
          <p>
            {customers.length} relaties · {eur(totalRevenue, { cents: false })} omzet dit jaar
          </p>
        </div>
        <div className="actions">
          <Link className="btn" to="/facturen">
            <Icon name="invoice" size={15} /> Alle facturen
          </Link>
          <button className="btn btn-primary" type="button" onClick={openNew}>
            <Icon name="plus" size={15} /> Nieuwe klant
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={15} />
          <input
            className="input"
            type="search"
            placeholder="Zoek op naam, plaats of e-mail…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Klanten zoeken"
          />
        </div>
        <span className="grow" />
        <span className="small muted">
          {visible.length} {visible.length === 1 ? "klant" : "klanten"}
        </span>
      </div>

      <div className="cust-grid">
        {visible.map(({ relatie, count, revenue, open }) => (
          <div className="card cust-card" key={relatie.id}>
            <div className="cust-top">
              <span className="avatar avatar-lg">{initials(relatie.naam)}</span>
              <div className="grow">
                <div className="cust-name">{relatie.naam}</div>
                <div className="cust-meta">
                  {relatie.plaats || "—"}
                  {relatie.contact ? ` · ${relatie.contact}` : ""}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                type="button"
                onClick={() => {
                  setEditing(relatie);
                  setModalOpen(true);
                }}
                aria-label="Klant bewerken"
                title="Bewerken"
              >
                <Icon name="edit" size={15} />
              </button>
            </div>
            <div className="cust-metrics">
              <div>
                <div className="m-label">Omzet {year}</div>
                <div className="m-value">{eur(revenue, { cents: false })}</div>
              </div>
              <div>
                <div className="m-label">Openstaand</div>
                <div className={`m-value ${open > 0 ? "text-amber" : ""}`}>
                  {eur(open, { cents: false })}
                </div>
              </div>
            </div>
            <div className="cust-foot">
              <Link className="btn btn-sm" to={`/facturen?klant=${relatie.id}`}>
                <Icon name="invoice" size={13} /> {count} {count === 1 ? "factuur" : "facturen"}
              </Link>
              <a
                className="btn btn-sm btn-ghost"
                href={`mailto:${relatie.email}`}
                title="E-mail sturen"
                aria-label="E-mail sturen"
              >
                <Icon name="mail" size={14} />
              </a>
              <button
                className="btn btn-sm btn-ghost btn-icon"
                type="button"
                onClick={() => askDelete(relatie)}
                aria-label="Klant verwijderen"
                title="Verwijderen"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="users" size={19} />
            </div>
            <h4>Geen klanten gevonden</h4>
            <p>Pas je zoekopdracht aan of voeg een nieuwe klant toe.</p>
            <button className="btn btn-primary" type="button" onClick={openNew}>
              <Icon name="plus" size={14} /> Nieuwe klant
            </button>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <CustomerModal
          customer={editing}
          onClose={() => setModalOpen(false)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`${deleting.naam} verwijderen?`}
          message="De klant wordt uit je administratie verwijderd. Dit kan niet ongedaan worden gemaakt."
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
