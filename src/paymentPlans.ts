// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { addDays, daysBetween, invoiceTotals, todayISO, uid } from "./lib";
import type { Invoice, PaymentPlan } from "./types";

export const MIN_TERMIJNEN = 2;
export const MAX_TERMIJNEN = 12;

export const PLAN_INTERVALLEN = [
  { dagen: 7, label: "elke week" },
  { dagen: 14, label: "elke twee weken" },
  { dagen: 30, label: "elke maand" },
];

export function intervalLabel(dagen: number): string {
  return PLAN_INTERVALLEN.find((interval) => interval.dagen === dagen)?.label ?? `elke ${dagen} dagen`;
}

export function intervalKort(dagen: number): string {
  if (dagen === 7) return "Wekelijks";
  if (dagen === 14) return "Tweewekelijks";
  if (dagen === 30) return "Maandelijks";
  return `Elke ${dagen} dagen`;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function clampTermijnen(aantal: number): number {
  const aantalRond = Math.round(Number(aantal) || 0);
  if (aantalRond < MIN_TERMIJNEN) return MIN_TERMIJNEN;
  if (aantalRond > MAX_TERMIJNEN) return MAX_TERMIJNEN;
  return aantalRond;
}

// De bedragen tellen op tot het totaal; de laatste termijn vangt het afrondingsverschil op.
export function termijnBedragen(totaal: number, aantal: number): number[] {
  const termijnen = clampTermijnen(aantal);
  const per = round2(totaal / termijnen);
  return Array.from({ length: termijnen }, (_, index) =>
    index === termijnen - 1 ? round2(totaal - per * (termijnen - 1)) : per
  );
}

export interface PlanTermijn {
  nummer: number;
  datum: string;
  bedrag: number;
}

export function paymentPlanSchedule(plan: PaymentPlan): PlanTermijn[] {
  return termijnBedragen(plan.totaal, plan.termijnen).map((bedrag, index) => ({
    nummer: index + 1,
    datum: addDays(plan.eersteTermijn, index * plan.intervalDagen),
    bedrag,
  }));
}

export function planTotaleBedrag(plan: PaymentPlan): number {
  return round2(paymentPlanSchedule(plan).reduce((som, termijn) => som + termijn.bedrag, 0));
}

// Termijnen waarvan de datum al gepasseerd is tellen als afgesproken aflossing.
export function vervallenTermijnen(plan: PaymentPlan, vandaag = todayISO()): PlanTermijn[] {
  return paymentPlanSchedule(plan).filter((termijn) => termijn.datum <= vandaag);
}

export function volgendeTermijn(plan: PaymentPlan, vandaag = todayISO()): PlanTermijn | undefined {
  return paymentPlanSchedule(plan).find((termijn) => termijn.datum > vandaag);
}

export function planVoortgang(plan: PaymentPlan, vandaag = todayISO()): number {
  const vervallen = vervallenTermijnen(plan, vandaag).length;
  return plan.termijnen > 0 ? Math.round((vervallen / plan.termijnen) * 100) : 0;
}

export interface PaymentPlanVoorstel {
  termijnen: number;
  totaal: number;
  bedragPerTermijn: number;
  intervalDagen: number;
  eersteTermijn: string;
  schema: PlanTermijn[];
}

// Het voorstel dat op de laatste aanmaning staat (en de basis voor de vastgelegde regeling).
export function planVoorstel(
  totaal: number,
  termijnen = 3,
  intervalDagen = 30,
  eersteTermijn = addDays(todayISO(), 14)
): PaymentPlanVoorstel {
  const aantal = clampTermijnen(termijnen);
  const bedragen = termijnBedragen(totaal, aantal);
  return {
    termijnen: aantal,
    totaal: round2(totaal),
    bedragPerTermijn: bedragen[0],
    intervalDagen,
    eersteTermijn,
    schema: bedragen.map((bedrag, index) => ({
      nummer: index + 1,
      datum: addDays(eersteTermijn, index * intervalDagen),
      bedrag,
    })),
  };
}

export function newPaymentPlan(
  invoice: Invoice,
  opties: {
    termijnen: number;
    intervalDagen: number;
    eersteTermijn: string;
    notitie?: string;
    id?: string;
    betaalLink?: string;
  },
  vandaag = todayISO()
): PaymentPlan {
  const totaal = invoiceTotals(invoice).incl;
  const voorstel = planVoorstel(
    totaal,
    opties.termijnen,
    opties.intervalDagen,
    opties.eersteTermijn
  );
  return {
    id: opties.id || `plan-${uid()}`,
    factuurId: invoice.id,
    termijnen: voorstel.termijnen,
    totaal: voorstel.totaal,
    bedragPerTermijn: voorstel.bedragPerTermijn,
    intervalDagen: voorstel.intervalDagen,
    eersteTermijn: voorstel.eersteTermijn,
    aangemaaktOp: vandaag,
    betaalLink: opties.betaalLink,
    notitie: opties.notitie,
  };
}

export function activePaymentPlan(
  plans: PaymentPlan[],
  invoiceId: string
): PaymentPlan | undefined {
  return plans.find((plan) => plan.factuurId === invoiceId && !plan.beeindigdOp);
}

export function activePaymentPlans(plans: PaymentPlan[]): PaymentPlan[] {
  return plans.filter((plan) => !plan.beeindigdOp);
}

// Loopt de klant achter met de afgesproken termijnen?
export function planAchterstand(plan: PaymentPlan, vandaag = todayISO()): number {
  const vervallen = vervallenTermijnen(plan, vandaag);
  if (vervallen.length === 0) return 0;
  const laatste = vervallen[vervallen.length - 1];
  return Math.max(0, daysBetween(laatste.datum, vandaag));
}
