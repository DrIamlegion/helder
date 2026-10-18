// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

import { initials } from "../lib";
import type { Company } from "../types";

/**
 * Het logo linksboven op een document. Zonder logo staan de initialen er, zodat de kop nooit
 * leeg is; met logo vervangt de afbeelding dat merkteken. De bedrijfsnaam staat ernaast, dus
 * voor een schermlezer is de afbeelding decoratief.
 */
export function CompanyLogo({ company }: { company: Company }) {
  return company.logo ? (
    <img className="paper-logo" src={company.logo} alt="" />
  ) : (
    <span className="mark">{initials(company.naam)}</span>
  );
}
