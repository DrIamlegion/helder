// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { IconName } from "../icons";
import {
  eur,
  invoiceState,
  invoiceTotals,
  quoteState,
  quoteStateLabel,
  stateLabel,
} from "../lib";
import { useAppStore } from "../store";
import { Icon } from "./Icon";

interface CommandResult {
  id: string;
  group: string;
  label: string;
  sub?: string;
  to: string;
  icon: IconName;
  badge?: string;
}

const PAGES: CommandResult[] = [
  { id: "page-overzicht", group: "Pagina's", label: "Overzicht", to: "/", icon: "dashboard" },
  { id: "page-facturen", group: "Pagina's", label: "Facturen", to: "/facturen", icon: "invoice" },
  {
    id: "page-nieuwe-factuur",
    group: "Pagina's",
    label: "Nieuwe factuur",
    to: "/facturen/nieuw",
    icon: "plus",
  },
  {
    id: "page-aanmaningen",
    group: "Pagina's",
    label: "Aanmaningen",
    to: "/aanmaningen",
    icon: "bell",
  },
  { id: "page-offertes", group: "Pagina's", label: "Offertes", to: "/offertes", icon: "fileText" },
  {
    id: "page-nieuwe-offerte",
    group: "Pagina's",
    label: "Nieuwe offerte",
    to: "/offertes/nieuw",
    icon: "plus",
  },
  {
    id: "page-herhalingen",
    group: "Pagina's",
    label: "Terugkerende facturen",
    to: "/herhalingen",
    icon: "refresh",
  },
  { id: "page-klanten", group: "Pagina's", label: "Klanten", to: "/klanten", icon: "users" },
  { id: "page-producten", group: "Pagina's", label: "Producten", to: "/producten", icon: "package" },
  { id: "page-uitgaven", group: "Pagina's", label: "Uitgaven", to: "/uitgaven", icon: "receipt" },
  { id: "page-bank", group: "Pagina's", label: "Bank", to: "/bank", icon: "bank" },
  { id: "page-rapporten", group: "Pagina's", label: "Rapporten", to: "/rapporten", icon: "briefcase" },
  { id: "page-btw", group: "Pagina's", label: "Btw-aangifte", to: "/btw", icon: "percent" },
  {
    id: "page-instellingen",
    group: "Pagina's",
    label: "Instellingen",
    to: "/instellingen",
    icon: "settings",
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matches(haystack: string, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const text = normalize(haystack);
  return tokens.every((token) => text.includes(token));
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo<CommandResult[]>(() => {
    const items: CommandResult[] = [...PAGES];

    for (const invoice of state.facturen) {
      const klant = state.relaties.find((customer) => customer.id === invoice.klantId);
      items.push({
        id: `invoice-${invoice.id}`,
        group: "Facturen",
        label: invoice.nummer,
        sub: `${klant?.naam ?? "Onbekende klant"} · ${eur(invoiceTotals(invoice).incl)}`,
        to: `/facturen/${invoice.id}`,
        icon: "invoice",
        badge: stateLabel(invoiceState(invoice)),
      });
    }

    for (const quote of state.offertes) {
      const klant = state.relaties.find((customer) => customer.id === quote.klantId);
      items.push({
        id: `quote-${quote.id}`,
        group: "Offertes",
        label: quote.nummer,
        sub: `${klant?.naam ?? "Onbekende klant"} · ${eur(invoiceTotals(quote).incl)}`,
        to: `/offertes/${quote.id}`,
        icon: "fileText",
        badge: quoteStateLabel(quoteState(quote)),
      });
    }

    for (const customer of state.relaties) {
      items.push({
        id: `customer-${customer.id}`,
        group: "Klanten",
        label: customer.naam,
        sub: [customer.contact, customer.plaats].filter(Boolean).join(" · "),
        to: `/facturen?klant=${customer.id}`,
        icon: "users",
      });
    }

    for (const product of state.producten) {
      items.push({
        id: `product-${product.id}`,
        group: "Producten",
        label: product.naam,
        sub: `${eur(product.prijs)} · ${product.btw}% btw`,
        to: "/producten",
        icon: "package",
      });
    }

    const term = query.trim();
    const filtered = term
      ? items.filter((item) =>
          matches(`${item.label} ${item.sub ?? ""} ${item.badge ?? ""}`, term)
        )
      : items;

    const limits: Record<string, number> = {
      "Pagina's": 8,
      Facturen: 6,
      Offertes: 5,
      Klanten: 5,
      Producten: 4,
    };
    const counts: Record<string, number> = {};
    return filtered.filter((item) => {
      const used = counts[item.group] ?? 0;
      if (used >= (limits[item.group] ?? 5)) return false;
      counts[item.group] = used + 1;
      return true;
    });
  }, [query, state]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.classList.remove("modal-open");
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    document
      .getElementById(`cmdk-item-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function choose(result: CommandResult) {
    onOpenChange(false);
    navigate(result.to);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % Math.max(1, results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + results.length) % Math.max(1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[active];
      if (result) choose(result);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    }
  }

  return createPortal(
    <div
      className="cmdk-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Zoeken">
        <div className="cmdk-input">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Zoek een pagina, factuur, klant of product…"
            aria-label="Zoeken in Helder"
            autoComplete="off"
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="cmdk-list" role="listbox" aria-label="Zoekresultaten">
          {results.map((result, index) => {
            const previous = results[index - 1];
            const showGroup = !previous || previous.group !== result.group;
            return (
              <div key={result.id}>
                {showGroup ? <div className="cmdk-group">{result.group}</div> : null}
                <button
                  id={`cmdk-item-${index}`}
                  className={`cmdk-row ${index === active ? "on" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(result)}
                >
                  <span className="cmdk-icon">
                    <Icon name={result.icon} size={15} />
                  </span>
                  <span className="cmdk-main">
                    <span className="cmdk-label">{result.label}</span>
                    {result.sub ? <span className="cmdk-sub">{result.sub}</span> : null}
                  </span>
                  {result.badge ? <span className="chip">{result.badge}</span> : null}
                  <Icon name="arrowRight" size={13} />
                </button>
              </div>
            );
          })}
          {results.length === 0 ? (
            <div className="cmdk-empty">
              <strong>Niets gevonden</strong>
              <p>Probeer een factuurnummer, klantnaam of paginanaam.</p>
            </div>
          ) : null}
        </div>

        <div className="cmdk-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> navigeren
          </span>
          <span>
            <span className="kbd">Enter</span> openen
          </span>
          <span className="grow" />
          <span className="muted">Sneltoets Ctrl / ⌘ + K</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
