// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

import { useEffect } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Helder`;
  }, [title]);
}
