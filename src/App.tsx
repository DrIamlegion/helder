// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { CommandPalette } from "./components/CommandPalette";
import { Icon } from "./components/Icon";
import { openVatReminder } from "./data";
import { fmtDate, initials, invoiceState, quoteState, todayISO } from "./lib";
import { useAppStore } from "./store";
import { useToast } from "./components/Toast";
import { useOnline } from "./pwa";
import { useTips } from "./tips";
import { useAutomatischeBackup } from "./desktop";
import { BankPage } from "./pages/BankPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import { InvoiceEditorPage } from "./pages/InvoiceEditorPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RecurringPage } from "./pages/RecurringPage";
import { ReminderLetterPage } from "./pages/ReminderLetterPage";
import { RemindersPage } from "./pages/RemindersPage";
import { RecurringEditorPage } from "./pages/RecurringEditorPage";
import { QuotesPage } from "./pages/QuotesPage";
import { QuoteDetailPage } from "./pages/QuoteDetailPage";
import { QuoteEditorPage } from "./pages/QuoteEditorPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { VatPage } from "./pages/VatPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PlanAcceptPage } from "./pages/PlanAcceptPage";
import { OnboardingPage } from "./pages/OnboardingPage";

// De acceptatiepagina staat bewust buiten de app-shell: de klant hoeft geen administratie te zien.
export function App() {
  const { state } = useAppStore();
  const toast = useToast();
  const location = useLocation();
  // Eenmalige tips horen bij de hele app, niet alleen bij de shell: ook tijdens de wizard en op
  // de acceptatiepagina telt mee wat je al hebt gezien. De teksten staan in src/tips.ts.
  useTips(toast);
  // Zonder bedrijfsnaam kan Helder geen factuur of btw-overzicht maken: eerst de wizard.
  // De acceptatiepagina voor een betaalregeling blijft bereikbaar, zodat een bestaande link werkt.
  const wizardNodig = state.bedrijf.naam.trim() === "";
  if (wizardNodig && !location.pathname.startsWith("/regeling/")) {
    return <OnboardingPage />;
  }
  return (
    <Routes>
      <Route path="/regeling/:token" element={<PlanAcceptPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/facturen" element={<InvoicesPage />} />
        <Route path="/facturen/nieuw" element={<InvoiceEditorPage />} />
        <Route path="/facturen/:id" element={<InvoiceDetailPage />} />
        <Route path="/facturen/:id/bewerken" element={<InvoiceEditorPage />} />
        <Route path="/offertes" element={<QuotesPage />} />
        <Route path="/offertes/nieuw" element={<QuoteEditorPage />} />
        <Route path="/offertes/:id" element={<QuoteDetailPage />} />
        <Route path="/offertes/:id/bewerken" element={<QuoteEditorPage />} />
        <Route path="/aanmaningen" element={<RemindersPage />} />
        <Route path="/herinneringen/:id" element={<ReminderLetterPage />} />
        <Route path="/herhalingen" element={<RecurringPage />} />
        <Route path="/herhalingen/nieuw" element={<RecurringEditorPage />} />
        <Route path="/herhalingen/:id/bewerken" element={<RecurringEditorPage />} />
        <Route path="/klanten" element={<CustomersPage />} />
        <Route path="/producten" element={<ProductsPage />} />
        <Route path="/uitgaven" element={<ExpensesPage />} />
        <Route path="/bank" element={<BankPage />} />
        <Route path="/rapporten" element={<ReportsPage />} />
        <Route path="/btw" element={<VatPage />} />
        <Route path="/instellingen" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function AppShell() {
  const { state, generateRecurring, stageReminders } = useAppStore();
  const toast = useToast();
  const online = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const generatedRecurring = useRef(false);
  const stagedReminders = useRef(false);

  // De desktop-app bewaart elke dag een kopie van de administratie in de gegevensmap; in de
  // browser bestaat die brug niet en gebeurt hier niets.
  useAutomatischeBackup(state);

  const openInvoices = state.facturen.filter((invoice) =>
    ["verzonden", "vervallen"].includes(invoiceState(invoice))
  );
  const openQuotes = state.offertes.filter((quote) =>
    ["verzonden", "verlopen"].includes(quoteState(quote))
  );
  const reminder = openVatReminder(state);
  const metRegeling = new Set(
    state.betaalregelingen.filter((plan) => !plan.beeindigdOp).map((plan) => plan.factuurId)
  );
  const remindersTodo =
    state.facturen.filter(
      (invoice) =>
        invoiceState(invoice) === "vervallen" &&
        !metRegeling.has(invoice.id) &&
        !state.herinneringen.some((sent) => sent.factuurId === invoice.id)
    ).length +
    state.herinneringen.filter(
      (reminder) => reminder.status === "concept" && !reminder.genegeerdOp
    ).length;

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    if (generatedRecurring.current) return;
    generatedRecurring.current = true;
    const created = generateRecurring();
    if (created > 0) {
      toast(
        `${created} conceptfactuur${created === 1 ? "" : "en"} aangemaakt vanuit terugkerende facturen`
      );
    }
  }, [generateRecurring, toast]);

  useEffect(() => {
    if (stagedReminders.current) return;
    stagedReminders.current = true;
    const created = stageReminders();
    if (created > 0) {
      toast(
        `${created} aanmaning${created === 1 ? "" : "en"} klaargezet — controleer en verstuur ${created === 1 ? "hem" : "ze"}`
      );
    }
  }, [stageReminders, toast]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (document.querySelector(".modal-backdrop")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const shortcuts: Record<string, string> = {
        n: "/facturen/nieuw",
        o: "/offertes/nieuw",
        r: "/herhalingen",
        b: "/btw",
        u: "/uitgaven",
        k: "/klanten",
        p: "/producten",
        a: "/rapporten",
        h: "/aanmaningen",
      };
      const path = shortcuts[event.key.toLowerCase()];
      if (path && location.pathname !== path) {
        event.preventDefault();
        navigate(path);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [location.pathname, navigate]);

  return (
    <div className="shell">
      <div
        className={`scrim ${menuOpen ? "" : "hidden"}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Icon name="leaf" size={19} />
          </span>
          <span>
            <span className="brand-name">Helder</span>
            <span className="brand-sub">Boekhouden zonder ruis</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Hoofdnavigatie">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="dashboard" />
            Overzicht
          </NavLink>

          <div className="nav-label">Verkoop</div>
          <NavLink to="/facturen" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="invoice" />
            Facturen
            {openInvoices.length > 0 ? <span className="nav-count">{openInvoices.length}</span> : null}
          </NavLink>
          <NavLink to="/aanmaningen" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="bell" />
            Aanmaningen
            {remindersTodo > 0 ? <span className="nav-count">{remindersTodo}</span> : null}
          </NavLink>
          <NavLink to="/offertes" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="fileText" />
            Offertes
            {openQuotes.length > 0 ? <span className="nav-count">{openQuotes.length}</span> : null}
          </NavLink>
          <NavLink to="/herhalingen" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="refresh" />
            Herhalingen
          </NavLink>
          <NavLink to="/klanten" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="users" />
            Klanten
          </NavLink>
          <NavLink to="/producten" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="package" />
            Producten
          </NavLink>

          <div className="nav-label">Inkoop</div>
          <NavLink to="/uitgaven" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="receipt" />
            Uitgaven
          </NavLink>

          <div className="nav-label">Financiën</div>
          <NavLink to="/bank" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="bank" />
            Bank
          </NavLink>
          <NavLink
            to="/rapporten"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icon name="briefcase" />
            Rapporten
          </NavLink>

          <div className="nav-label">Belasting</div>
          <NavLink to="/btw" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="percent" />
            Btw-aangifte
          </NavLink>

          <div className="nav-label">Account</div>
          <NavLink to="/instellingen" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name="settings" />
            Instellingen
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <div className="help-card">
            {reminder ? (
              <>
                <strong>
                  Btw Q{reminder.quarter} {reminder.year}
                </strong>
                <p>
                  {reminder.days === 0
                    ? "De deadline is vandaag."
                    : `Nog ${reminder.days} ${reminder.days === 1 ? "dag" : "dagen"} om je aangifte te controleren en in te dienen.`}
                </p>
                <Link to="/btw">
                  <Icon name="arrowRight" size={12} /> Aangifte bekijken
                </Link>
              </>
            ) : (
              <>
                <strong>Alles is bijgewerkt</strong>
                <p>Je hebt geen openstaande btw-aangiftes meer.</p>
                <Link to="/btw">
                  <Icon name="arrowRight" size={12} /> Naar btw-overzicht
                </Link>
              </>
            )}
          </div>
          <div className="profile">
            <span className="avatar">{initials(state.bedrijf.eigenaar || state.bedrijf.naam)}</span>
            <span>
              <span className="profile-name">{state.bedrijf.eigenaar}</span>
              <span className="profile-role">
                {state.bedrijf.rechtsvorm} · {state.bedrijf.plaats}
              </span>
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="btn btn-ghost btn-icon menu-btn"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu openen"
          >
            <Icon name="menu" size={18} />
          </button>
          <div className="topbar-title">
            <h1>{state.bedrijf.naam}</h1>
            <p>
              {state.bedrijf.rechtsvorm} · Boekjaar {new Date().getFullYear()}
            </p>
          </div>
          <div className="topbar-actions">
            <button
              className="cmd-trigger"
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Zoeken (Ctrl+K)"
            >
              <Icon name="search" size={15} />
              <span className="cmd-trigger-label">Zoeken</span>
              <span className="kbd">Ctrl K</span>
            </button>
            {online ? null : (
              <span
                className="chip chip-amber"
                title="Je werkt offline. Helder blijft gewoon werken en bewaart alles lokaal."
              >
                <Icon name="alert" size={12} /> Offline
              </span>
            )}
            <span className="topbar-date">{fmtDate(todayISO(), "medium")}</span>
            <Link className="btn btn-primary" to="/facturen/nieuw" aria-label="Nieuwe factuur">
              <Icon name="plus" size={15} /> <span className="label">Nieuwe factuur</span>
            </Link>
          </div>
        </header>

        <main className="content" id="view">
          <Outlet />
        </main>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

        <div className="page-foot">
          <span>Helder</span> · je gegevens staan lokaal op deze computer · geen fiscaal advies
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon">
          <Icon name="alert" size={19} />
        </div>
        <h4>Deze pagina bestaat niet</h4>
        <p>De link is verouderd of er is iets misgegaan.</p>
        <Link className="btn btn-primary" to="/">
          Terug naar overzicht
        </Link>
      </div>
    </div>
  );
}
