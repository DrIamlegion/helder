// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { stateLabel } from "../lib";
import type { InvoiceDisplayState } from "../types";

const CLASSES: Record<InvoiceDisplayState, string> = {
  betaald: "badge-green",
  concept: "badge-gray",
  verzonden: "badge-blue",
  vervallen: "badge-red",
};

export function StateBadge({ state }: { state: InvoiceDisplayState }) {
  return <span className={`badge ${CLASSES[state]}`}>{stateLabel(state)}</span>;
}
