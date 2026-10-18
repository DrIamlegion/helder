// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ConfirmDialog, Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { CHANGELOG } from "../changelog";
import { normalizeState } from "../data";
import { useTitle } from "../hooks";
import { AUTO_DREMPELS, HERINNER_RUSTDAGEN } from "../reminders";
import { useInstall, useOfflineGereed } from "../pwa";
import { useBackup, useFoutenlog, useUpdates, useVensterstand } from "../desktop";
import { download, fmtDate, fmtDateTime, initials, todayISO } from "../lib";
import { maakLogoKlein } from "../logo";
import { rechtsvormOpties, zonderBtwNummer } from "../rechtsvormen";
import { useAppStore } from "../store";
import type { Company } from "../types";

// Een logo gaat als data-URL mee in de administratie. Houd het klein: de hele staat staat in
// localStorage en gaat mee in elke back-up.
const MAX_LOGO_BYTES = 500 * 1024;

export function SettingsPage() {
  const { state, updateCompany, importState, reset, setAutoReminders } = useAppStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<Company>(() => ({ ...state.bedrijf }));
  // Een vereniging of stichting heeft meestal geen btw-nummer; het veld verschijnt pas als de
  // gebruiker aangeeft toch btw-plichtig te zijn.
  const [btwPlichtig, setBtwPlichtig] = useState(
    () => !zonderBtwNummer(state.bedrijf.rechtsvorm) || Boolean(state.bedrijf.btw)
  );
  const toonBtw = !zonderBtwNummer(form.rechtsvorm) || btwPlichtig;
  const backupStand = useBackup();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [geschiedenisOpen, setGeschiedenisOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const install = useInstall();
  const offlineGereed = useOfflineGereed();
  const updates = useUpdates();
  const foutenlog = useFoutenlog();
  const venster = useVensterstand();

  useTitle("Instellingen");

  const stats = [
    { label: "Facturen", value: state.facturen.length },
    { label: "Offertes", value: state.offertes.length },
    { label: "Klanten", value: state.relaties.length },
    { label: "Uitgaven", value: state.uitgaven.length },
  ];
  const sizeKb = Math.max(1, Math.round(new Blob([JSON.stringify(state)]).size / 1024));
  const dev = import.meta.env.DEV;

  const updateBadge: Record<string, { label: string; className: string }> = {
    onbekend: { label: "Onbekend", className: "badge-gray" },
    controleren: { label: "Controleren", className: "badge-blue" },
    beschikbaar: { label: `Versie ${updates.status.versie}`, className: "badge-blue" },
    downloaden: { label: `Downloaden ${updates.status.percentage}%`, className: "badge-amber" },
    klaar: { label: `Versie ${updates.status.versie} klaar`, className: "badge-green" },
    actueel: { label: "Bijgewerkt", className: "badge-green" },
    fout: { label: "Niet gelukt", className: "badge-red" },
  };
  // Een onbereikbaar kanaal (geen internet, adres nog niet ingesteld) is geen fout in de app:
  // dat mag er rustig uitzien in plaats van rood.
  const geenVerbinding = /^Geen verbinding/.test(updates.status.bericht);
  const update =
    updates.status.toestand === "fout" && geenVerbinding
      ? { label: "Geen verbinding", className: "badge-gray" }
      : (updateBadge[updates.status.toestand] ?? updateBadge.onbekend);
  const aantalFouten = foutenlog.log?.aantal ?? 0;

  function setField<K extends keyof Company>(key: K, value: Company[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function kiesRechtsvorm(vorm: string) {
    setForm((huidig) => ({
      ...huidig,
      rechtsvorm: vorm,
      btw: zonderBtwNummer(vorm) ? "" : huidig.btw,
    }));
    if (zonderBtwNummer(vorm)) setBtwPlichtig(false);
  }

  function kiesLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      toast("Kies een PNG-, JPG- of WebP-afbeelding");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast("Dit logo is te groot — kies een afbeelding van maximaal 500 kB");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result || "");
      if (!data.startsWith("data:image/")) {
        toast("Het logo kon niet worden gelezen. Probeer een ander bestand.");
        return;
      }
      // Meteen een compacte variant maken: die gaat mee in de deellink van een betaalregeling.
      const klein = await maakLogoKlein(data);
      setForm((huidig) => ({ ...huidig, logo: data, logoKlein: klein }));
      toast("Logo gekozen — klik op Opslaan om het te bewaren");
    };
    reader.onerror = () => toast("Het logo kon niet worden gelezen. Probeer een ander bestand.");
    reader.readAsDataURL(file);
    // Dezelfde afbeelding nog eens kiezen moet ook werken.
    event.target.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const teBewaren: Company = {
      ...form,
      btw: zonderBtwNummer(form.rechtsvorm) && !btwPlichtig ? "" : form.btw,
    };
    if (!teBewaren.logo) {
      teBewaren.logoKlein = "";
    } else if (!teBewaren.logoKlein) {
      // Bij een logo uit een oudere back-up ontbreekt de compacte variant nog.
      teBewaren.logoKlein = await maakLogoKlein(teBewaren.logo);
    }
    updateCompany(teBewaren);
    setForm(teBewaren);
    toast("Bedrijfsgegevens opgeslagen");
  }

  function backup() {
    download(`helder-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json");
    toast("Back-up gedownload");
  }

  function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalizeState(JSON.parse(String(reader.result)));
        if (!next) {
          setImportError(
            "Dit bestand is geen geldige Helder-back-up. Controleer of je het juiste JSON-bestand hebt gekozen."
          );
          return;
        }
        importState(next);
        setForm({ ...next.bedrijf });
        setBtwPlichtig(
          !zonderBtwNummer(next.bedrijf.rechtsvorm) || Boolean(next.bedrijf.btw)
        );
        toast("Back-up teruggezet");
        navigate("/");
      } catch {
        setImportError("Het bestand kon niet worden gelezen. Kies een geldig JSON-bestand.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function doReset() {
    reset();
    setConfirmingReset(false);
    toast("Administratie gewist — vul je bedrijfsgegevens opnieuw in");
    navigate("/");
  }

  async function kopieerLog() {
    const gelukt = await foutenlog.kopieer();
    toast(
      gelukt
        ? "Foutenlogboek gekopieerd — plak het in je foutmelding"
        : "Kopiëren lukte niet. Open het bestand via Help → Logboek met fouten."
    );
  }

  async function zetVensterTerug() {
    const gelukt = await venster.terugzetten();
    toast(
      gelukt
        ? "Venster teruggezet naar de standaardmaat"
        : "Het venster kon niet worden teruggezet. Herstart Helder en probeer het opnieuw."
    );
  }

  async function installeer() {
    const uitkomst = await install.installeren();
    if (uitkomst === "geinstalleerd") {
      toast("Helder staat als app op je computer — je vindt hem in het startmenu");
    } else if (uitkomst === "afgewezen") {
      toast("Installatie geannuleerd. Je kunt het later opnieuw doen via het browsermenu.");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Instellingen</h2>
          <p>Deze gegevens staan op je facturen en in je btw-overzicht.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" form="bedrijf-form">
            <Icon name="check" size={15} /> Opslaan
          </button>
        </div>
      </div>

      <form id="bedrijf-form" autoComplete="off" onSubmit={submit}>
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Bedrijfsgegevens</h3>
                <div className="sub">Zo verschijn je op offertes, facturen en aangiftes</div>
              </div>
            </div>
            <div className="card-body">
              <div className="logo-field">
                <div className="logo-preview">
                  {form.logo ? (
                    <img src={form.logo} alt="Gekozen logo" />
                  ) : (
                    <span className="logo-placeholder">{initials(form.naam) || "?"}</span>
                  )}
                </div>
                <div className="logo-keuze">
                  <span className="logo-label">Logo</span>
                  <div className="logo-buttons">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => logoRef.current?.click()}
                    >
                      <Icon name="upload" size={13} />
                      {form.logo ? "Ander logo" : "Logo kiezen"}
                    </button>
                    {form.logo ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() =>
                          setForm((huidig) => ({ ...huidig, logo: "", logoKlein: "" }))
                        }
                      >
                        <Icon name="trash" size={13} /> Verwijderen
                      </button>
                    ) : null}
                  </div>
                  <span className="hint">
                    Eén logo, PNG/JPG/WebP tot 500 kB. Het staat linksboven op je facturen,
                    offertes en aanmaningsbrieven, en in de kop van de publieke betaalregeling.
                  </span>
                  <input
                    ref={logoRef}
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={kiesLogo}
                  />
                </div>
              </div>
              <div className="form-grid three">
                <div className="field">
                  <label htmlFor="naam">Handelsnaam *</label>
                  <input
                    className="input"
                    id="naam"
                    value={form.naam}
                    onChange={(event) => setField("naam", event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="eigenaar">Naam eigenaar</label>
                  <input
                    className="input"
                    id="eigenaar"
                    value={form.eigenaar}
                    onChange={(event) => setField("eigenaar", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rechtsvorm">Rechtsvorm</label>
                  <select
                    className="select"
                    id="rechtsvorm"
                    value={form.rechtsvorm}
                    onChange={(event) => kiesRechtsvorm(event.target.value)}
                  >
                    {rechtsvormOpties(form.rechtsvorm).map((vorm) => (
                      <option key={vorm}>{vorm}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="kvk">KvK-nummer</label>
                  <input
                    className="input"
                    id="kvk"
                    value={form.kvk}
                    onChange={(event) => setField("kvk", event.target.value)}
                  />
                </div>
                <div className="field">
                  {toonBtw ? (
                    <>
                      <label htmlFor="btw">Btw-nummer</label>
                      <input
                        className="input"
                        id="btw"
                        value={form.btw}
                        onChange={(event) => setField("btw", event.target.value)}
                      />
                      {zonderBtwNummer(form.rechtsvorm) ? (
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={btwPlichtig}
                            onChange={(event) => {
                              setBtwPlichtig(event.target.checked);
                              if (!event.target.checked) setField("btw", "");
                            }}
                          />
                          Toch btw-plichtig
                        </label>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <label>Btw-nummer</label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => setBtwPlichtig(true)}
                        />
                        Wel btw-plichtig
                      </label>
                      <span className="hint">
                        Een vereniging of stichting is meestal niet btw-plichtig.
                      </span>
                    </>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="email">E-mailadres</label>
                  <input
                    className="input"
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="telefoon">Telefoon</label>
                  <input
                    className="input"
                    id="telefoon"
                    value={form.telefoon}
                    onChange={(event) => setField("telefoon", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="website">Website</label>
                  <input
                    className="input"
                    id="website"
                    value={form.website}
                    onChange={(event) => setField("website", event.target.value)}
                  />
                </div>
                <div className="field span-2">
                  <label htmlFor="adres">Adres</label>
                  <input
                    className="input"
                    id="adres"
                    value={form.adres}
                    onChange={(event) => setField("adres", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="postcode">Postcode</label>
                  <input
                    className="input"
                    id="postcode"
                    value={form.postcode}
                    onChange={(event) => setField("postcode", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="plaats">Plaats</label>
                  <input
                    className="input"
                    id="plaats"
                    value={form.plaats}
                    onChange={(event) => setField("plaats", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="land">Land</label>
                  <input
                    className="input"
                    id="land"
                    value={form.land}
                    onChange={(event) => setField("land", event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h3>Facturatie</h3>
                <div className="sub">Standaardwaarden voor nieuwe facturen</div>
              </div>
            </div>
            <div className="card-body">
              <div className="form-grid three">
                <div className="field">
                  <label htmlFor="iban">IBAN</label>
                  <input
                    className="input mono"
                    id="iban"
                    value={form.iban}
                    onChange={(event) => setField("iban", event.target.value)}
                    placeholder="NL00 BANK 0000 0000 00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="betaaltermijn">Betaaltermijn</label>
                  <select
                    className="select"
                    id="betaaltermijn"
                    value={form.betaaltermijn}
                    onChange={(event) => setField("betaaltermijn", Number(event.target.value))}
                  >
                    {[7, 14, 30, 60].map((dagen) => (
                      <option value={dagen} key={dagen}>
                        {dagen} dagen
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="factuurprefix">Factuurnummering</label>
                  <input className="input mono" id="factuurprefix" value="JJJJ-0001" readOnly />
                  <span className="hint">Automatisch oplopend per boekjaar</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: 0 }}>
            <span className="left small muted">Wijzigingen gelden direct voor nieuwe facturen.</span>
            <button className="btn btn-primary" type="submit">
              <Icon name="check" size={15} /> Gegevens opslaan
            </button>
          </div>
        </div>
      </form>

      <div className="settings-grid mt-24">
        <div className="card card-pad">
          <div className="row-between">
            <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Helder als app</h3>
            <span className={`badge ${install.isGeinstalleerd ? "badge-green" : "badge-gray"}`}>
              {install.isGeinstalleerd ? "App-modus" : "In de browser"}
            </span>
          </div>
          <p className="small muted mt-8">
            Installeer Helder als gewone app: eigen pictogram in het startmenu, een eigen venster
            zonder browserbalk en geen internet nodig om te werken.
          </p>
          <div className="flex gap-8 mt-16" style={{ flexWrap: "wrap" }}>
            {install.kanInstalleren ? (
              <button className="btn btn-primary" type="button" onClick={installeer}>
                <Icon name="download" size={14} /> Installeer Helder als app
              </button>
            ) : null}
            {install.isGeinstalleerd ? (
              <span className="chip chip-brand">
                <Icon name="checkCircle" size={12} /> Je werkt in de app
              </span>
            ) : null}
          </div>
          {install.kanInstalleren || install.isGeinstalleerd ? null : (
            <p className="small muted mt-12">
              {install.afgewezen
                ? "Installatie is geannuleerd. Open het browsermenu om het later opnieuw te doen."
                : "Installeren doe je via het menu van je browser: Chrome en Edge → Adresbalk →  App installeren; Safari → Deel → Zet op beginscherm. Op een telefoon of tablet staat Helder daarna tussen je apps."}
            </p>
          )}
          <div className="divider mt-16" />
          <div className="row-between mt-12 small">
            <span className="muted">Offline werken</span>
            <strong className={offlineGereed ? "" : "muted"}>
              {offlineGereed
                ? "Gereed — de app opent ook zonder internet"
                : dev
                  ? "Actief in de gebouwde app (npm run build)"
                  : "Nog niet gereed — open Helder één keer online"}
            </strong>
          </div>
          <div className="row-between mt-8 small">
            <span className="muted">Opslag</span>
            <strong>Lokaal in deze app (localStorage)</strong>
          </div>
          <div className="row-between mt-8 small">
            <span className="muted">Updates</span>
            <strong>{updates.beschikbaar ? "Automatisch op de achtergrond" : "Automatisch bij het starten"}</strong>
          </div>
        </div>

        {updates.beschikbaar ? (
          <div className="card card-pad">
            <div className="row-between">
              <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Updates</h3>
              <span className={`badge ${update.className}`}>{update.label}</span>
            </div>
            <p className="small muted mt-8">
              Helder {updates.status.huidigeVersie || "—"} kijkt bij het starten of er een nieuwe
              versie is, haalt die op de achtergrond binnen en installeert hem bij het afsluiten.
              Je administratie blijft daarbij gewoon staan.
            </p>
            {updates.status.bericht ? <p className="small mt-8">{updates.status.bericht}</p> : null}
            {updates.status.notities && updates.status.versie ? (
              <div className="mt-16">
                <div className="small" style={{ fontWeight: 640 }}>
                  {`Wat is er nieuw in ${updates.status.versie}${
                    updates.status.uitgebrachtOp
                      ? ` (${fmtDate(updates.status.uitgebrachtOp.slice(0, 10), "medium")})`
                      : ""
                  }?`}
                </div>
                <ul style={{ margin: "6px 0 0 18px", lineHeight: 1.6 }} className="small muted">
                  {updates.status.notities
                    .split("\n")
                    .map((regel) => regel.replace(/^[-*]\s*/, "").replace(/`/g, "").trim())
                    .filter(Boolean)
                    .map((regel, index) => (
                      <li key={index}>{regel}</li>
                    ))}
                </ul>
              </div>
            ) : null}
            <div className="flex gap-8 mt-16" style={{ flexWrap: "wrap" }}>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={updates.controleer}
                disabled={updates.bezig}
              >
                <Icon name="refresh" size={14} /> Nu controleren
              </button>
              {updates.status.toestand === "klaar" ? (
                <button className="btn btn-primary" type="button" onClick={updates.installeer}>
                  <Icon name="download" size={14} /> Installeren en herstarten
                </button>
              ) : null}
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setGeschiedenisOpen(true)}
              >
                <Icon name="clock" size={14} /> Versiegeschiedenis
              </button>
            </div>
            {updates.status.gecontroleerdOp ? (
              <p className="small muted mt-12">
                Laatst gecontroleerd: {fmtDate(updates.status.gecontroleerdOp.slice(0, 10), "medium")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="card card-pad">
          <div className="row-between">
            <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Je gegevens</h3>
            <span className="badge badge-green">Lokaal opgeslagen</span>
          </div>
          <p className="small muted mt-8">
            Alles staat in deze browser (localStorage). Er gaat niets naar een server. In de
            desktop-app maakt Helder daarnaast elke dag een kopie in je gegevensmap, zodat je
            administratie niet aan één opslag hangt.
          </p>
          <div className="stats-row mt-16">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
            <div>
              <div className="stat-value">{sizeKb} kB</div>
              <div className="stat-label">Data</div>
            </div>
          </div>
          <div className="flex gap-8 mt-16" style={{ flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={backup}>
              <Icon name="download" size={14} /> Back-up downloaden
            </button>
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={14} /> Back-up terugzetten
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={restore}
              hidden
              aria-label="Back-upbestand kiezen"
            />
            <button className="btn btn-danger" type="button" onClick={() => setConfirmingReset(true)}>
              <Icon name="refresh" size={14} /> Administratie wissen
            </button>
          </div>
          {backupStand.beschikbaar ? (
            <div className="backup-stand mt-16">
              <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
                <span className="small muted">
                  <Icon name="clock" size={14} />{" "}
                  {backupStand.stand?.laatste
                    ? `Automatische back-up: laatst ${fmtDateTime(backupStand.stand.laatste.geschrevenOp)} · ${backupStand.stand.aantal} bewaard`
                    : "Automatische back-up: nog geen kopie geschreven"}
                </span>
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={async () => {
                    const fout = await backupStand.openMap();
                    if (fout) toast(fout);
                  }}
                >
                  <Icon name="folder" size={14} /> Back-ups openen
                </button>
              </div>
            </div>
          ) : null}
          {importError ? (
            <div className="form-error mt-12" role="alert">
              <div>
                <Icon name="alert" size={14} />
                <span>{importError}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card card-pad">
          <div className="row-between">
            <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Aanmaningen</h3>
            <span className={`badge ${state.autoAanmaningen ? "badge-green" : "badge-gray"}`}>
              {state.autoAanmaningen ? "Automatisch" : "Handmatig"}
            </span>
          </div>
          <p className="small muted mt-8">
            Helder zet zelf een betaalherinnering klaar zodra een factuur {AUTO_DREMPELS[1]} dagen over
            de vervaldatum is, daarna een aanmaning na {AUTO_DREMPELS[2]} dagen en een laatste
            aanmaning na {AUTO_DREMPELS[3]} dagen. Tussen twee brieven zit minstens{" "}
            {HERINNER_RUSTDAGEN} dagen rust. Versturen doe je altijd zelf. Loopt er een
            betaalregeling, dan pauzeert Helder de aanmaningen voor die factuur.
          </p>
          <label className="check mt-16">
            <input
              type="checkbox"
              checked={state.autoAanmaningen}
              onChange={(event) => {
                setAutoReminders(event.target.checked);
                toast(
                  event.target.checked
                    ? "Helder zet aanmaningen automatisch klaar"
                    : "Automatisch klaarzetten uitgezet"
                );
              }}
            />
            Aanmaningen automatisch klaarzetten
          </label>
          <div className="flex gap-8 mt-16">
            <Link className="btn btn-sm" to="/aanmaningen">
              <Icon name="bell" size={14} /> Naar aanmaningen
            </Link>
          </div>
        </div>

        {foutenlog.beschikbaar ? (
          <div className="card card-pad">
            <div className="row-between">
              <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Foutenlogboek</h3>
              <span
                className={`badge ${aantalFouten > 0 ? "badge-amber" : "badge-gray"}`}
              >
                {foutenlog.mislukt && !foutenlog.log
                  ? "Onbekend"
                  : aantalFouten > 0
                    ? `${aantalFouten} ${aantalFouten === 1 ? "fout" : "fouten"}`
                    : "Geen fouten"}
              </span>
            </div>
            <p className="small muted mt-8">
              Struikelt Helder zelf, dan schrijft de app dat hieronder op: wanneer, in welke versie
              en wat er misging. Je administratie staat er niet in. Meld je een fout, kopieer dan
              alles in één keer en plak het in je bericht.
            </p>
            {foutenlog.log?.bestaat ? (
              <pre
                className="foutenlog mt-12"
                tabIndex={0}
                aria-label="Inhoud van het foutenlogboek"
              >
                {foutenlog.log.afgekapt
                  ? "… alleen de nieuwste regels; kopiëren doet het hele bestand.\n\n"
                  : ""}
                {foutenlog.log.inhoud.trimEnd()}
              </pre>
            ) : foutenlog.mislukt ? (
              <p className="small mt-12">
                Het logboek kon niet worden gelezen. Open het via Help → Logboek met fouten.
              </p>
            ) : (
              <p className="small mt-12">
                Er is nog niets opgeschreven: in het programma ging tot nu toe niets mis.
              </p>
            )}
            {foutenlog.log?.bestaat ? (
              <div className="flex gap-8 mt-16" style={{ flexWrap: "wrap" }}>
                <button className="btn" type="button" onClick={kopieerLog}>
                  <Icon name="copy" size={14} /> Kopiëren voor een foutmelding
                </button>
              </div>
            ) : null}
            {foutenlog.log?.pad ? (
              <p className="small muted mt-12">
                Bestand: <span className="mono">{foutenlog.log.pad}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {venster.beschikbaar ? (
          <div className="card card-pad">
            <div className="row-between">
              <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Venster</h3>
              <span
                className={`badge ${venster.stand?.aangepast ? "badge-blue" : "badge-gray"}`}
              >
                {venster.stand?.aangepast ? "Eigen maat" : "Standaardmaat"}
              </span>
            </div>
            <p className="small muted mt-8">
              Helder opent de volgende keer op dezelfde plek en met dezelfde maat. De standaardmaat
              past bij je scherm
              {venster.stand
                ? ` (${venster.stand.standaard.breedte} × ${venster.stand.standaard.hoogte})`
                : ""}
              .
            </p>
            <div className="row-between mt-12 small">
              <span className="muted">Nu</span>
              <strong>{venster.stand ? `${venster.stand.breedte} × ${venster.stand.hoogte}` : "—"}</strong>
            </div>
            <div className="flex gap-8 mt-16">
              <button className="btn" type="button" onClick={zetVensterTerug} disabled={!venster.stand}>
                <Icon name="refresh" size={14} /> Terug naar de standaardmaat
              </button>
            </div>
          </div>
        ) : null}

        <div className="card card-pad">
          <div className="row-between">
            <h3 style={{ fontSize: 14.5, fontWeight: 640 }}>Over Helder</h3>
            <span className="chip">v{__APP_VERSION__}</span>
          </div>
          <p className="small muted mt-8">
            Helder is een compacte boekhoudapp voor zzp en mkb: factureren, kosten bijhouden en je
            btw-aangifte voorbereiden. Gebouwd als werkende demo, niet als fiscaal advies.
          </p>
          <div className="divider mt-16" />
          <div className="row-between mt-12 small">
            <span className="muted">Boekjaar</span>
            <strong>{new Date().getFullYear()}</strong>
          </div>
          <div className="row-between mt-8 small">
            <span className="muted">Laatste back-up</span>
            <strong>Nooit</strong>
          </div>
          <div className="row-between mt-8 small">
            <span className="muted">Versie</span>
            <strong>{__APP_VERSION__}</strong>
          </div>
          <div className="flex gap-8 mt-16">
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => setGeschiedenisOpen(true)}
            >
              <Icon name="clock" size={14} /> Versiegeschiedenis
            </button>
          </div>
        </div>
      </div>

      {geschiedenisOpen ? (
        <Modal
          title="Versiegeschiedenis"
          subtitle={__APP_VERSION__ ? `Je gebruikt Helder ${__APP_VERSION__}` : undefined}
          wide
          onClose={() => setGeschiedenisOpen(false)}
        >
          <div className="stack" style={{ gap: 18 }}>
            {CHANGELOG.map((regel) => (
              <div key={regel.versie}>
                <div className="row-between" style={{ alignItems: "baseline" }}>
                  <strong>
                    {regel.versie} <span className="muted small">· {regel.datum}</span>
                  </strong>
                  {regel.versie === __APP_VERSION__ ? (
                    <span className="badge badge-green">In gebruik</span>
                  ) : regel.versie === updates.status.versie ? (
                    <span className="badge badge-blue">Komt eraan</span>
                  ) : null}
                </div>
                <ul style={{ margin: "6px 0 0 18px", lineHeight: 1.6 }} className="small muted">
                  {regel.punten.map((punt, index) => (
                    <li key={index}>{punt.replace(/`/g, "")}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}

      {confirmingReset ? (
        <ConfirmDialog
          title="Alles wissen?"
          message="Je administratie wordt leeggemaakt en je begint opnieuw bij de wizard met je bedrijfsgegevens. Maak eerst een back-up als je iets wilt bewaren."
          confirmLabel="Wissen"
          onConfirm={doReset}
          onCancel={() => setConfirmingReset(false)}
        />
      ) : null}
    </>
  );
}
