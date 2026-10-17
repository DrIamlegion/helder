// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ExpenseModal } from "../components/ExpenseModal";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/Modal";
import { useToast } from "../components/Toast";
import { CATEGORIES } from "../data";
import { useTitle } from "../hooks";
import { eur, expenseParts, fmtDate } from "../lib";
import { useAppStore } from "../store";
import type { Expense } from "../types";

export function ExpensesPage() {
  const { state, deleteExpense } = useAppStore();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  useTitle("Uitgaven");

  useEffect(() => {
    if (searchParams.get("nieuw") === "1") {
      setEditing(null);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const year = new Date().getFullYear();
  const expenses = state.uitgaven
    .filter((uitgave) => uitgave.datum.startsWith(String(year)))
    .sort((a, b) => (a.datum < b.datum ? 1 : -1))
    .map((uitgave) => ({ ...uitgave, parts: expenseParts(uitgave) }));

  const totalExcl = expenses.reduce((total, uitgave) => total + uitgave.parts.excl, 0);
  const reclaimable = expenses
    .filter((uitgave) => uitgave.aftrekbaar)
    .reduce((total, uitgave) => total + uitgave.parts.vat, 0);

  const term = search.trim().toLowerCase();
  const visible = expenses.filter((uitgave) => {
    const matchesSearch =
      !term || `${uitgave.leverancier} ${uitgave.omschrijving}`.toLowerCase().includes(term);
    return matchesSearch && (!category || uitgave.categorie === category);
  });
  const visibleTotal = visible.reduce((total, uitgave) => total + uitgave.parts.incl, 0);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteExpense(deleting.id);
    toast("Uitgave verwijderd");
    setDeleting(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Uitgaven</h2>
          <p>Alle kosten van {year} — met de btw die je kunt terugvorderen.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={openNew}>
            <Icon name="plus" size={15} /> Uitgave toevoegen
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="receipt" /> Kosten dit jaar
          </div>
          <div className="kpi-value">{eur(totalExcl, { cents: false })}</div>
          <div className="kpi-meta">
            <span>excl. btw · {expenses.length} bonnen</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="percent" /> Btw terug te vorderen
          </div>
          <div className="kpi-value">{eur(reclaimable)}</div>
          <div className="kpi-meta">
            <span>verwerkt in je btw-aangifte</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">
            <Icon name="bank" /> Gemiddeld per maand
          </div>
          <div className="kpi-value">{eur(totalExcl / 12, { cents: false })}</div>
          <div className="kpi-meta">
            <span>op basis van {year}</span>
          </div>
        </div>
      </div>

      <div className="card mt-16">
        <div className="list-toolbar">
          <div className="search">
            <Icon name="search" size={15} />
            <input
              className="input"
              type="search"
              placeholder="Zoek op leverancier of omschrijving…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Uitgaven zoeken"
            />
          </div>
          <select
            className="select"
            style={{ width: 220 }}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter op categorie"
          >
            <option value="">Alle categorieën</option>
            {CATEGORIES.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="grow" />
          <span className="small muted nowrap">
            {visible.length} {visible.length === 1 ? "uitgave" : "uitgaven"}
          </span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Leverancier</th>
                <th>Categorie</th>
                <th className="num">Excl. btw</th>
                <th className="num">Btw</th>
                <th className="num">Incl. btw</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((uitgave) => (
                <tr key={uitgave.id}>
                  <td className="muted nowrap">{fmtDate(uitgave.datum, "medium")}</td>
                  <td>
                    <div className="strong">{uitgave.leverancier}</div>
                    <div className="cell-sub">{uitgave.omschrijving || uitgave.categorie}</div>
                  </td>
                  <td>
                    <span className="chip">{uitgave.categorie}</span>
                  </td>
                  <td className="num">{eur(uitgave.parts.excl)}</td>
                  <td className={`num ${uitgave.aftrekbaar ? "" : "muted"}`}>
                    {uitgave.parts.vat ? eur(uitgave.parts.vat) : "—"}
                    {uitgave.parts.vat && !uitgave.aftrekbaar ? (
                      <div className="cell-sub">niet aftrekbaar</div>
                    ) : null}
                  </td>
                  <td className="num strong">{eur(uitgave.parts.incl)}</td>
                  <td className="row-actions">
                    <button
                      className="btn btn-sm btn-ghost btn-icon"
                      type="button"
                      onClick={() => {
                        setEditing(uitgave);
                        setModalOpen(true);
                      }}
                      aria-label="Uitgave bewerken"
                      title="Bewerken"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      className="btn btn-sm btn-ghost btn-icon"
                      type="button"
                      onClick={() => setDeleting(uitgave)}
                      aria-label="Uitgave verwijderen"
                      title="Verwijderen"
                    >
                      <Icon name="trash" size={14} />
                    </button>
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
                <Icon name="search" size={19} />
              </div>
              <h4>Geen uitgaven gevonden</h4>
              <p>Pas je zoekopdracht of categorie aan.</p>
            </div>
          </div>
        ) : null}

        <div className="list-foot">
          <span className="small muted">
            {visible.length} van {expenses.length} uitgaven
          </span>
          <span className="small">
            <span className="muted">Subtotaal:</span> <strong>{eur(visibleTotal)}</strong>
          </span>
        </div>
      </div>

      {modalOpen ? (
        <ExpenseModal expense={editing} onClose={() => setModalOpen(false)} />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Uitgave verwijderen?"
          message={`${deleting.leverancier} — ${eur(deleting.bedragIncl)}. Deze uitgave verdwijnt uit je administratie en btw-aangifte.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
