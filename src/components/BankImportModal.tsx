// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useRef, useState, type ChangeEvent } from "react";
import { parseBankCsv, toBankTransaction, type ParsedBankRow } from "../bank";
import { useToast } from "../components/Toast";
import { useAppStore } from "../store";
import { eur, fmtDate } from "../lib";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function BankImportModal({ onClose }: { onClose: () => void }) {
  const { importBankTransactions } = useAppStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedBankRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [readError, setReadError] = useState("");

  function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setReadError("");
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBankCsv(String(reader.result ?? ""));
      setRows(parsed.rows);
      setErrors(parsed.errors);
    };
    reader.onerror = () => {
      setReadError("Het bestand kon niet worden gelezen.");
      setRows([]);
      setErrors([]);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function confirm() {
    const imported = importBankTransactions(rows.map(toBankTransaction));
    const skipped = rows.length - imported;
    toast(
      imported === 0
        ? "Alle transacties stonden al in de administratie"
        : `${imported} transactie${imported === 1 ? "" : "s"} geïmporteerd${skipped > 0 ? ` · ${skipped} overgeslagen` : ""}`
    );
    onClose();
  }

  return (
    <Modal
      title="Bankafschrift importeren"
      subtitle="CSV-bestand met datum, bedrag, tegenpartij en omschrijving."
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Annuleren
          </button>
          <button className="btn btn-primary" type="button" onClick={confirm} disabled={rows.length === 0}>
            <Icon name="upload" size={14} />{" "}
            {rows.length > 0 ? `${rows.length} transacties importeren` : "Importeren"}
          </button>
        </>
      }
    >
      <div className="import-drop">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={readFile}
          hidden
          aria-label="CSV-bestand kiezen"
        />
        <span className="doc-icon">
          <Icon name="upload" size={17} />
        </span>
        <div>
          <strong>{fileName || "Kies een CSV-bestand"}</strong>
          <p className="small muted">
            Kolommen: Datum, Bedrag, Tegenpartij en Omschrijving. Puntkomma en komma worden
            allebei herkend.
          </p>
        </div>
        <button className="btn btn-sm" type="button" onClick={() => fileRef.current?.click()}>
          Bestand kiezen
        </button>
      </div>

      {readError ? (
        <div className="form-error mt-12" role="alert">
          <div>
            <Icon name="alert" size={14} />
            <span>{readError}</span>
          </div>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="form-error mt-12" role="alert">
          {errors.map((error) => (
            <div key={error}>
              <Icon name="alert" size={14} />
              <span>{error}</span>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="import-summary small muted mt-16">
            {rows.length} {rows.length === 1 ? "regel" : "regels"} gevonden ·{" "}
            {eur(rows.reduce((total, row) => total + row.bedrag, 0))} netto
          </div>
          <div className="table-wrap mt-8">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Tegenpartij</th>
                  <th>Omschrijving</th>
                  <th className="num">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, index) => (
                  <tr key={`${row.datum}-${index}`}>
                    <td className="nowrap">{fmtDate(row.datum, "medium")}</td>
                    <td>{row.tegenpartij}</td>
                    <td className="muted">{row.omschrijving || "—"}</td>
                    <td className={`num ${row.bedrag >= 0 ? "text-green" : ""}`}>
                      {row.bedrag >= 0 ? "+" : "−"} {eur(Math.abs(row.bedrag))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 ? (
            <p className="small muted mt-8">En nog {rows.length - 5} regels.</p>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
