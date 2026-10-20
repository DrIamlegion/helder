// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import {
  addDays,
  daysBetween,
  eur,
  fmtDate,
  invoiceState,
  invoiceTotals,
  todayISO,
  uid,
} from "./lib";
import {
  activePaymentPlan,
  planVoorstel,
  type PaymentPlanVoorstel,
} from "./paymentPlans";
import type { AppState, Invoice, Reminder, ReminderLevel } from "./types";

export interface ReminderLevelInfo {
  niveau: ReminderLevel;
  label: string;
  beschrijving: string;
  badge: string;
  termijnDagen: number;
  wachtdagen: number;
}

export const REMINDER_LEVELS: ReminderLevelInfo[] = [
  {
    niveau: 1,
    label: "Betaalherinnering",
    beschrijving: "Vriendelijke herinnering met een nieuw betaaltermijn van 14 dagen.",
    badge: "badge-blue",
    termijnDagen: 14,
    wachtdagen: 1,
  },
  {
    niveau: 2,
    label: "Aanmaning",
    beschrijving: "Dringend verzoek om binnen 14 dagen te betalen, met aankondiging van incasso.",
    badge: "badge-amber",
    termijnDagen: 14,
    wachtdagen: 30,
  },
  {
    niveau: 3,
    label: "Laatste aanmaning",
    beschrijving:
      "Formele laatste waarschuwing van 7 dagen, inclusief buitengerechtelijke incassokosten en wettelijke rente.",
    badge: "badge-red",
    termijnDagen: 7,
    wachtdagen: 60,
  },
];

export function reminderLevelInfo(niveau: ReminderLevel): ReminderLevelInfo {
  return REMINDER_LEVELS.find((level) => level.niveau === niveau) ?? REMINDER_LEVELS[0];
}

// Buitengerechtelijke incassokosten volgens de wettelijke staffel (Besluit BIK),
// met het wettelijke minimum van € 40 en nooit meer dan de openstaande hoofdsom.
const INCASSO_SCHIJVEN = [
  { tot: 2500, percentage: 15 },
  { tot: 5000, percentage: 10 },
  { tot: 10000, percentage: 5 },
  { tot: 200000, percentage: 1 },
  { tot: Number.POSITIVE_INFINITY, percentage: 0.5 },
];

export function incassokosten(bedrag: number): number {
  // Reken in centen en pas aan het einde af, zodat 15% van € 1.996,50 netjes € 299,48 wordt.
  const centen = Math.round(Math.max(0, Number(bedrag) || 0) * 100);
  if (centen === 0) return 0;

  let ondergrens = 0;
  let gewogen = 0;
  for (const schijf of INCASSO_SCHIJVEN) {
    if (centen <= ondergrens) break;
    const bovengrens =
      schijf.tot === Number.POSITIVE_INFINITY ? centen : Math.round(schijf.tot * 100);
    const deel = Math.min(centen, bovengrens) - ondergrens;
    gewogen += deel * schijf.percentage;
    ondergrens = bovengrens;
  }

  const berekend = Math.round(gewogen / 100);
  const metMinimum = Math.max(4000, berekend);
  return Math.min(centen, metMinimum) / 100;
}

// Helder zet zelf een brief klaar zodra een factuur dit aantal dagen over de vervaldatum is.
export const AUTO_DREMPELS: Record<ReminderLevel, number> = { 1: 14, 2: 30, 3: 60 };

// Rust tussen twee brieven voor dezelfde factuur: de betaaltermijn uit de vorige brief.
export const HERINNER_RUSTDAGEN = 14;

function reminderMoment(reminder: Reminder): string {
  return reminder.status === "verzonden" ? reminder.verzondenOp || reminder.aangemaaktOp : reminder.aangemaaktOp;
}

export function invoiceReminders(reminders: Reminder[], invoiceId: string): Reminder[] {
  return reminders
    .filter((reminder) => reminder.factuurId === invoiceId)
    .sort((a, b) => {
      const momentA = reminderMoment(a);
      const momentB = reminderMoment(b);
      if (momentA === momentB) return a.niveau - b.niveau;
      return momentA < momentB ? -1 : 1;
    });
}

export function sentReminders(reminders: Reminder[], invoiceId: string): Reminder[] {
  return invoiceReminders(reminders, invoiceId).filter((reminder) => reminder.status === "verzonden");
}

// Een klaargezette brief die nog niet is verstuurd of afgewezen.
export function pendingReminder(reminders: Reminder[], invoiceId: string): Reminder | undefined {
  return invoiceReminders(reminders, invoiceId)
    .filter((reminder) => reminder.status === "concept" && !reminder.genegeerdOp)
    .pop();
}

export interface ReminderPlan {
  niveau: ReminderLevel;
  dagenTeLaat: number;
  verstuurd: Reminder[];
  laatste?: Reminder;
  concept?: Reminder;
}

// Elke verstuurde brief zet de volgende stap één niveau hoger; hoe langer de factuur
// openstaat, hoe hoger het niveau minimaal is.
export function plannedReminder(
  invoice: Invoice,
  reminders: Reminder[],
  vandaag = todayISO()
): ReminderPlan {
  const verstuurd = sentReminders(reminders, invoice.id);
  const laatste = verstuurd[verstuurd.length - 1];
  const dagenTeLaat = Math.max(0, daysBetween(invoice.vervaldatum, vandaag));
  const opLeeftijd: ReminderLevel = dagenTeLaat >= 60 ? 3 : dagenTeLaat >= 30 ? 2 : 1;
  const volgende: ReminderLevel = laatste ? (Math.min(3, laatste.niveau + 1) as ReminderLevel) : 1;
  return {
    niveau: Math.max(volgende, opLeeftijd) as ReminderLevel,
    dagenTeLaat,
    verstuurd,
    laatste,
    concept: pendingReminder(reminders, invoice.id),
  };
}

export function reminderLetterPath(invoiceId: string, plan: ReminderPlan): string {
  const niveau = plan.concept?.niveau ?? plan.niveau;
  return `/herinneringen/${invoiceId}?niveau=${niveau}${plan.concept ? `&concept=${plan.concept.id}` : ""}`;
}

export interface StageProposal {
  niveau: ReminderLevel;
  dagenTeLaat: number;
}

// Bepaalt of Helder voor deze factuur zelf een brief mag klaarzetten.
export function stageProposal(
  state: AppState,
  invoice: Invoice,
  vandaag = todayISO()
): StageProposal | null {
  const dagenTeLaat = Math.max(0, daysBetween(invoice.vervaldatum, vandaag));
  if (dagenTeLaat < AUTO_DREMPELS[1]) return null;

  const laatste = sentReminders(state.herinneringen, invoice.id).pop();
  if (laatste && daysBetween(laatste.verzondenOp || laatste.aangemaaktOp, vandaag) < HERINNER_RUSTDAGEN) {
    return null;
  }

  const plan = plannedReminder(invoice, state.herinneringen, vandaag);
  if (laatste && plan.niveau <= laatste.niveau) return null;
  if (dagenTeLaat < AUTO_DREMPELS[plan.niveau]) return null;

  return { niveau: plan.niveau, dagenTeLaat };
}

// Zet klaargezette brieven klaar, ruimt voorstellen op die niet meer nodig zijn
// (factuur betaald of verwijderd) en laat afgewezen niveaus met rust.
export function applyReminders(
  state: AppState,
  vandaag = todayISO()
): { state: AppState; created: Reminder[]; cleaned: number; ended: number } {
  let cleaned = 0;
  let ended = 0;

  // Een betaalregeling stopt zodra de factuur niet meer vervallen is (betaald of verwijderd).
  const betaalregelingen = state.betaalregelingen.map((plan) => {
    if (plan.beeindigdOp) return plan;
    const invoice = state.facturen.find((item) => item.id === plan.factuurId);
    if (invoice && invoiceState(invoice) === "vervallen") return plan;
    ended++;
    return { ...plan, beeindigdOp: vandaag };
  });
  const herinneringen = state.herinneringen.filter((reminder) => {
    if (reminder.status !== "concept") return true;
    const invoice = state.facturen.find((item) => item.id === reminder.factuurId);
    if (invoice && invoiceState(invoice) === "vervallen") return true;
    cleaned++;
    return false;
  });

  const created: Reminder[] = [];
  if (state.autoAanmaningen !== false) {
    const heeftVoorstel = new Set(
      herinneringen
        .filter((reminder) => reminder.status === "concept" && !reminder.genegeerdOp)
        .map((reminder) => reminder.factuurId)
    );
    const afgewezen = new Set(
      herinneringen
        .filter((reminder) => reminder.genegeerdOp)
        .map((reminder) => `${reminder.factuurId}|${reminder.niveau}`)
    );

    for (const invoice of state.facturen) {
      if (invoiceState(invoice) !== "vervallen") continue;
      if (heeftVoorstel.has(invoice.id)) continue;
      // Zolang er een betaalregeling loopt, zet Helder geen nieuwe brief klaar.
      if (activePaymentPlan(betaalregelingen, invoice.id)) continue;
      const voorstel = stageProposal({ ...state, herinneringen }, invoice, vandaag);
      if (!voorstel) continue;
      if (afgewezen.has(`${invoice.id}|${voorstel.niveau}`)) continue;
      created.push({
        id: `rem-${uid()}`,
        factuurId: invoice.id,
        niveau: voorstel.niveau,
        status: "concept",
        aangemaaktOp: vandaag,
        automatisch: true,
      });
    }
  }

  if (created.length === 0 && cleaned === 0 && ended === 0) {
    return { state, created, cleaned, ended };
  }
  return {
    state: { ...state, herinneringen: [...herinneringen, ...created], betaalregelingen },
    created,
    cleaned,
    ended,
  };
}

export interface ReminderLetter {
  niveau: ReminderLevel;
  regeling?: PaymentPlanVoorstel;
  label: string;
  klantNaam: string;
  dagenTeLaat: number;
  bedrag: number;
  incassokosten: number;
  totaal: number;
  termijnDagen: number;
  betaalVoor: string;
  onderwerp: string;
  aanhef: string;
  alineas: string[];
  sluiting: string;
  datum: string;
}

export function reminderLetter(
  state: AppState,
  invoice: Invoice,
  niveau: ReminderLevel,
  vandaag = todayISO(),
  opties: { termijnen?: number; intervalDagen?: number } = {}
): ReminderLetter {
  const info = reminderLevelInfo(niveau);
  const klant = state.relaties.find((relatie) => relatie.id === invoice.klantId);
  const bedrijf = state.bedrijf;
  const bedrag = invoiceTotals(invoice).incl;
  const dagenTeLaat = Math.max(0, daysBetween(invoice.vervaldatum, vandaag));
  const betaalVoor = addDays(vandaag, info.termijnDagen);
  const kosten = niveau === 3 ? incassokosten(bedrag) : 0;
  const totaal = Math.round((bedrag + kosten) * 100) / 100;
  const klantNaam = klant?.naam || "onbekende klant";
  const regeling =
    niveau === 3
      ? planVoorstel(
          bedrag,
          opties.termijnen ?? 3,
          opties.intervalDagen ?? 30,
          addDays(vandaag, 14)
        )
      : undefined;
  const eerderVerstuurd = sentReminders(state.herinneringen, invoice.id).length > 0;
  const aanhef =
    niveau === 3
      ? `Geachte ${klant?.contact || klantNaam},`
      : `Beste ${klant?.contact || klantNaam},`;

  const alineas: string[] = [];
  if (niveau === 1) {
    alineas.push(
      `Volgens onze administratie staat factuur ${invoice.nummer} van ${fmtDate(
        invoice.datum
      )} nog open. Het totaalbedrag van ${eur(bedrag)} zou uiterlijk ${fmtDate(
        invoice.vervaldatum
      )} op onze rekening staan; dat is inmiddels ${dagenTeLaat} ${
        dagenTeLaat === 1 ? "dag" : "dagen"
      } geleden.`
    );
    alineas.push(
      `Misschien is de factuur aan je aandacht ontsnapt. Wil je het bedrag voor ${fmtDate(
        betaalVoor
      )} overmaken op ${bedrijf.iban}, ten name van ${bedrijf.naam}, onder vermelding van ${invoice.nummer}?`
    );
    alineas.push(
      `Heb je de factuur inmiddels betaald of klopt er iets niet? Laat het ons weten via ${bedrijf.email}, dan zoeken we het samen uit. Dan hoef je deze brief verder niet te bewaren.`
    );
  } else if (niveau === 2) {
    alineas.push(
      `${eerderVerstuurd ? "Ondanks onze eerdere herinnering hebben wij" : "Wij hebben"} nog geen betaling van ${eur(
        bedrag
      )} voor factuur ${invoice.nummer} ontvangen. De factuur is nu ${dagenTeLaat} ${
        dagenTeLaat === 1 ? "dag" : "dagen"
      } over de vervaldatum van ${fmtDate(invoice.vervaldatum)} heen.`
    );
    alineas.push(
      `Wij verzoeken je dringend het openstaande bedrag binnen ${info.termijnDagen} dagen, dus uiterlijk ${fmtDate(
        betaalVoor
      )}, over te maken op ${bedrijf.iban} ten name van ${bedrijf.naam}, onder vermelding van ${invoice.nummer}.`
    );
    alineas.push(
      `Blijft betaling uit, dan zien wij ons genoodzaakt de vordering uit handen te geven. De dan verschuldigde buitengerechtelijke incassokosten en de wettelijke rente komen voor jouw rekening. Dat willen we graag voorkomen.`
    );
  } else {
    alineas.push(
      `Wij hebben voor factuur ${invoice.nummer} van ${fmtDate(invoice.datum)} nog steeds geen betaling van ${eur(
        bedrag
      )} ontvangen. De factuur is inmiddels ${dagenTeLaat} ${
        dagenTeLaat === 1 ? "dag" : "dagen"
      } over de vervaldatum van ${fmtDate(invoice.vervaldatum)} heen.${
        eerderVerstuurd
          ? " Wij hebben je hier al eerder over geschreven, helaas zonder resultaat."
          : ""
      }`
    );
    alineas.push(
      `Dit is onze laatste aanmaning. Wij verzoeken je het bedrag van ${eur(
        bedrag
      )} binnen ${info.termijnDagen} dagen, dus uiterlijk ${fmtDate(betaalVoor)}, te betalen op ${
        bedrijf.iban
      } ten name van ${bedrijf.naam} onder vermelding van ${invoice.nummer}.`
    );
    alineas.push(
      `Als wij het bedrag niet op tijd ontvangen, dragen wij de vordering uit handen aan een incassobureau of gerechtsdeurwaarder. Volgens de wettelijke staffel bedragen de buitengerechtelijke incassokosten dan ${eur(
        kosten
      )}, waarmee het totaal op ${eur(
        totaal
      )} komt. Vanaf 14 dagen na deze brief brengen wij daarnaast de wettelijke rente in rekening.`
    );
    alineas.push(
      `Wil je een andere verdeling of hierover afspraken maken? Neem dan vandaag nog contact op via ${
        bedrijf.email
      } of ${bedrijf.telefoon}, dan kijken we samen naar een oplossing.`
    );
  }

  return {
    niveau,
    regeling,
    label: info.label,
    klantNaam,
    dagenTeLaat,
    bedrag,
    incassokosten: kosten,
    totaal,
    termijnDagen: info.termijnDagen,
    betaalVoor,
    onderwerp:
      niveau === 1
        ? `Herinnering factuur ${invoice.nummer}`
        : niveau === 2
          ? `Aanmaning factuur ${invoice.nummer}`
          : `Laatste aanmaning factuur ${invoice.nummer}`,
    aanhef,
    alineas,
    sluiting:
      niveau === 3
        ? "Hoogachtend,"
        : "Met vriendelijke groet,",
    datum: vandaag,
  };
}
