// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useMemo } from "react";
import { maakQrCode } from "../qr";

/**
 * De QR-code op de aanmaningsbrief. Zo hoeft de lange deellink niet voluit op papier.
 * Past de link niet in een QR-code, dan blijft de link als terugval staan: zonder die
 * regel zou de klant de regeling anders niet meer online kunnen openen.
 */
export function PaymentPlanQr({ link }: { link: string }) {
  const bron = useMemo(() => maakQrCode(link), [link]);

  if (!link) return null;
  if (!bron) {
    return (
      <p className="letter-plan-link">
        Online akkoord geven kan via <span>{link}</span>
      </p>
    );
  }
  return (
    <div className="letter-plan-qr">
      <img src={bron} alt="QR-code om de betaalregeling te openen" />
      <p>
        Scan de QR-code met je telefoon om het aflosschema te openen en online akkoord te geven.
      </p>
    </div>
  );
}
