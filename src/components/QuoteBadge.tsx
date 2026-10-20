// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { quoteStateLabel } from "../lib";
import type { QuoteDisplayState } from "../types";

const CLASSES: Record<QuoteDisplayState, string> = {
  geaccepteerd: "badge-green",
  concept: "badge-gray",
  verzonden: "badge-blue",
  afgewezen: "badge-red",
  verlopen: "badge-amber",
};

export function QuoteBadge({ state }: { state: QuoteDisplayState }) {
  return <span className={`badge ${CLASSES[state]}`}>{quoteStateLabel(state)}</span>;
}
