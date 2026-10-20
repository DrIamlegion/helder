// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { useTitle } from "../hooks";
import { RECHTSVORMEN, zonderBtwNummer } from "../rechtsvormen";
import { useAppStore } from "../store";
import type { Company } from "../types";

// De wizard verschijnt zolang er nog geen bedrijfsnaam is: zonder naam kan Helder geen factuur
// of btw-overzicht maken. Twee stappen houden het overzichtelijk — eerst wie je bent, daarna de
// administratieve gegevens.

const BETAALTERMIJNEN = [7, 14, 30, 60];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE = /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/;
const KVK = /^[0-9]{8}$/;
const BTW = /^[A-Za-z]{2}[0-9]{9}B[0-9]{2}$/;
const IBAN = /^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9\s]{10,32}$/;

type Fouten = Partial<Record<keyof Company, string>>;

function controleerBedrijf(form: Company): Fouten {
  const fouten: Fouten = {};
  if (!form.naam.trim()) fouten.naam = "Vul de naam van je bedrijf in.";
  if (!form.eigenaar.trim()) fouten.eigenaar = "Vul je eigen naam in.";
  if (!form.email.trim()) fouten.email = "Vul een e-mailadres in.";
  else if (!EMAIL.test(form.email.trim())) fouten.email = "Dit e-mailadres lijkt niet te kloppen.";
  return fouten;
}

function controleerAdministratie(form: Company): Fouten {
  const fouten: Fouten = {};
  if (form.kvk.trim() && !KVK.test(form.kvk.replace(/\s/g, ""))) {
    fouten.kvk = "Een KvK-nummer bestaat uit 8 cijfers.";
  }
  if (form.btw.trim() && !BTW.test(form.btw.replace(/\s/g, ""))) {
    fouten.btw = "Gebruik het formaat NL123456789B01.";
  }
  if (form.iban.trim() && !IBAN.test(form.iban.trim())) {
    fouten.iban = "Dit IBAN lijkt niet te kloppen.";
  }
  if (form.postcode.trim() && !POSTCODE.test(form.postcode.trim())) {
    fouten.postcode = "Gebruik vier cijfers en twee letters, bijvoorbeeld 1234 AB.";
  }
  return fouten;
}

function schoon(form: Company): Company {
  const tekst = (waarde: string) => waarde.trim();
  return {
    ...form,
    naam: tekst(form.naam),
    rechtsvorm: tekst(form.rechtsvorm),
    eigenaar: tekst(form.eigenaar),
    kvk: tekst(form.kvk),
    btw: tekst(form.btw).toUpperCase(),
    iban: tekst(form.iban).toUpperCase(),
    email: tekst(form.email),
    telefoon: tekst(form.telefoon),
    website: tekst(form.website),
    adres: tekst(form.adres),
    postcode: tekst(form.postcode).toUpperCase(),
    plaats: tekst(form.plaats),
    land: tekst(form.land) || "Nederland",
    betaaltermijn: Number(form.betaaltermijn) > 0 ? Number(form.betaaltermijn) : 14,
  };
}

export function OnboardingPage() {
  const { state, updateCompany } = useAppStore();
  const toast = useToast();
  const [stap, setStap] = useState<0 | 1>(0);
  const [form, setForm] = useState<Company>(() => ({ ...state.bedrijf }));
  const [fouten, setFouten] = useState<Fouten>({});
  // Een vereniging of stichting begint zonder btw-nummer; dit vinkje haalt het veld terug
  // voor organisaties die wél btw-plichtig zijn.
  const [btwPlichtig, setBtwPlichtig] = useState(
    () => !zonderBtwNummer(state.bedrijf.rechtsvorm) || Boolean(state.bedrijf.btw)
  );
  const toonBtw = !zonderBtwNummer(form.rechtsvorm) || btwPlichtig;

  useTitle("Welkom");

  function setField<K extends keyof Company>(key: K, value: Company[K]) {
    setForm((huidig) => ({ ...huidig, [key]: value }));
    setFouten((huidig) => ({ ...huidig, [key]: undefined }));
  }

  function kiesRechtsvorm(vorm: string) {
    setForm((huidig) => ({
      ...huidig,
      rechtsvorm: vorm,
      btw: zonderBtwNummer(vorm) ? "" : huidig.btw,
    }));
    setFouten((huidig) => ({ ...huidig, rechtsvorm: undefined, btw: undefined }));
    if (zonderBtwNummer(vorm)) setBtwPlichtig(false);
  }

  function volgende() {
    const gevonden = controleerBedrijf(form);
    setFouten(gevonden);
    if (Object.keys(gevonden).length === 0) setStap(1);
  }

  function opslaan(event: FormEvent) {
    event.preventDefault();
    const bedrijfFouten = controleerBedrijf(form);
    const administratieFouten = controleerAdministratie(form);
    const gevonden = { ...bedrijfFouten, ...administratieFouten };
    setFouten(gevonden);
    if (Object.keys(bedrijfFouten).length > 0) {
      setStap(0);
      return;
    }
    if (Object.keys(administratieFouten).length > 0) return;
    const klaar = schoon(form);
    updateCompany(klaar);
    toast(`Welkom bij Helder, ${klaar.naam}`);
  }

  return (
    <main className="onboarding">
      <div className="onboarding-card">
        <header className="onboarding-head">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="leaf" size={19} />
          </span>
          <div>
            <h1>Welkom bij Helder</h1>
            <p>
              Vertel kort wie je bent. Deze gegevens komen op je facturen en in je btw-overzicht.
              Je kunt ze later altijd aanpassen bij Instellingen.
            </p>
          </div>
        </header>

        <div className="onboarding-steps" aria-label="Voortgang">
          <span className={stap === 0 ? "actief" : "klaar"}>
            <Icon name={stap === 0 ? "building" : "check"} size={13} /> Je bedrijf
          </span>
          <span className={stap === 1 ? "actief" : ""}>
            <Icon name="briefcase" size={13} /> Administratie
          </span>
        </div>

        <form onSubmit={opslaan} noValidate>
          {stap === 0 ? (
            <>
              <div className="form-grid">
                <div className="field span-2">
                  <label htmlFor="onboarding-naam">Bedrijfsnaam</label>
                  <input
                    className="input"
                    id="onboarding-naam"
                    value={form.naam}
                    onChange={(event) => setField("naam", event.target.value)}
                    placeholder="Bijvoorbeeld: Studio Noorderlicht"
                    autoFocus
                    aria-invalid={Boolean(fouten.naam)}
                  />
                  {fouten.naam ? <span className="onboarding-veld-fout">{fouten.naam}</span> : null}
                </div>
                <div className="field">
                  <label htmlFor="onboarding-rechtsvorm">Rechtsvorm</label>
                  <select
                    className="select"
                    id="onboarding-rechtsvorm"
                    value={form.rechtsvorm}
                    onChange={(event) => kiesRechtsvorm(event.target.value)}
                  >
                    {RECHTSVORMEN.map((vorm) => (
                      <option value={vorm} key={vorm}>
                        {vorm}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="onboarding-eigenaar">Je naam</label>
                  <input
                    className="input"
                    id="onboarding-eigenaar"
                    value={form.eigenaar}
                    onChange={(event) => setField("eigenaar", event.target.value)}
                    placeholder="Voor- en achternaam"
                    aria-invalid={Boolean(fouten.eigenaar)}
                  />
                  {fouten.eigenaar ? (
                    <span className="onboarding-veld-fout">{fouten.eigenaar}</span>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor="onboarding-email">E-mailadres</label>
                  <input
                    className="input"
                    id="onboarding-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    placeholder="jij@jouwbedrijf.nl"
                    aria-invalid={Boolean(fouten.email)}
                  />
                  {fouten.email ? (
                    <span className="onboarding-veld-fout">{fouten.email}</span>
                  ) : (
                    <span className="hint">Hier komen facturen en aanmaningen binnen.</span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="onboarding-telefoon">Telefoon</label>
                  <input
                    className="input"
                    id="onboarding-telefoon"
                    value={form.telefoon}
                    onChange={(event) => setField("telefoon", event.target.value)}
                    placeholder="030 123 45 67"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="onboarding-kvk">KvK-nummer</label>
                  <input
                    className="input mono"
                    id="onboarding-kvk"
                    value={form.kvk}
                    onChange={(event) => setField("kvk", event.target.value)}
                    placeholder="12345678"
                    inputMode="numeric"
                    aria-invalid={Boolean(fouten.kvk)}
                  />
                  {fouten.kvk ? <span className="onboarding-veld-fout">{fouten.kvk}</span> : null}
                </div>
                <div className="field">
                  {toonBtw ? (
                    <>
                      <label htmlFor="onboarding-btw">Btw-nummer</label>
                      <input
                        className="input mono"
                        id="onboarding-btw"
                        value={form.btw}
                        onChange={(event) => setField("btw", event.target.value)}
                        placeholder="NL123456789B01"
                        aria-invalid={Boolean(fouten.btw)}
                      />
                      {fouten.btw ? (
                        <span className="onboarding-veld-fout">{fouten.btw}</span>
                      ) : null}
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
                <div className="field span-2">
                  <label htmlFor="onboarding-iban">IBAN</label>
                  <input
                    className="input mono"
                    id="onboarding-iban"
                    value={form.iban}
                    onChange={(event) => setField("iban", event.target.value)}
                    placeholder="NL00 BANK 0000 0000 00"
                    aria-invalid={Boolean(fouten.iban)}
                  />
                  {fouten.iban ? (
                    <span className="onboarding-veld-fout">{fouten.iban}</span>
                  ) : (
                    <span className="hint">Dit rekeningnummer komt op je facturen te staan.</span>
                  )}
                </div>
                <div className="field span-2">
                  <label htmlFor="onboarding-adres">Adres</label>
                  <input
                    className="input"
                    id="onboarding-adres"
                    value={form.adres}
                    onChange={(event) => setField("adres", event.target.value)}
                    placeholder="Straat en huisnummer"
                  />
                </div>
                <div className="field">
                  <label htmlFor="onboarding-postcode">Postcode</label>
                  <input
                    className="input mono"
                    id="onboarding-postcode"
                    value={form.postcode}
                    onChange={(event) => setField("postcode", event.target.value)}
                    placeholder="1234 AB"
                    aria-invalid={Boolean(fouten.postcode)}
                  />
                  {fouten.postcode ? (
                    <span className="onboarding-veld-fout">{fouten.postcode}</span>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor="onboarding-plaats">Plaats</label>
                  <input
                    className="input"
                    id="onboarding-plaats"
                    value={form.plaats}
                    onChange={(event) => setField("plaats", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="onboarding-land">Land</label>
                  <input
                    className="input"
                    id="onboarding-land"
                    value={form.land}
                    onChange={(event) => setField("land", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="onboarding-website">Website</label>
                  <input
                    className="input"
                    id="onboarding-website"
                    value={form.website}
                    onChange={(event) => setField("website", event.target.value)}
                    placeholder="jouwbedrijf.nl"
                  />
                </div>
                <div className="field">
                  <label htmlFor="onboarding-betaaltermijn">Betaaltermijn</label>
                  <select
                    className="select"
                    id="onboarding-betaaltermijn"
                    value={form.betaaltermijn}
                    onChange={(event) => setField("betaaltermijn", Number(event.target.value))}
                  >
                    {BETAALTERMIJNEN.map((dagen) => (
                      <option value={dagen} key={dagen}>
                        {dagen} dagen
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="form-actions">
            {stap === 0 ? (
              <>
                <span className="left small muted">Stap 1 van 2 · alleen je naam en e-mail zijn verplicht.</span>
                <button className="btn btn-primary" type="button" onClick={volgende}>
                  Volgende <Icon name="arrowRight" size={14} />
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" type="button" onClick={() => setStap(0)}>
                  <Icon name="arrowLeft" size={14} /> Terug
                </button>
                <span className="left small muted">Stap 2 van 2 · je kunt dit later aanvullen.</span>
                <button className="btn btn-primary" type="submit">
                  <Icon name="check" size={14} /> Aan de slag
                </button>
              </>
            )}
          </div>
        </form>

        <p className="small muted onboarding-foot">
          <Icon name="info" size={13} /> Alles blijft op deze computer staan; Helder stuurt niets
          naar een server.
        </p>
      </div>
    </main>
  );
}
