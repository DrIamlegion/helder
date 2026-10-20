// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Controleert of de gebouwde installer en het programma ondertekend zijn en door welke
// uitgever. Gebruik: node scripts/verify-signature.mjs [--strict]
// Met --strict eindigt het script met code 1 zodra er iets niet ondertekend is.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const release = path.resolve("release");
const strict = process.argv.includes("--strict");

const kandidaten = [];
if (existsSync(release)) {
  for (const bestand of readdirSync(release)) {
    if (/^Helder-Setup-.*\.exe$/i.test(bestand)) kandidaten.push(path.join(release, bestand));
  }
}
const programma = path.join(release, "win-unpacked", "Helder.exe");
if (existsSync(programma)) kandidaten.push(programma);

if (kandidaten.length === 0) {
  console.error("Geen build gevonden in release/ — draai eerst npm run installer.");
  process.exit(1);
}

const script = `
$resultaten = @()
foreach ($pad in @(${kandidaten.map((pad) => JSON.stringify(pad)).join(", ")})) {
  $s = Get-AuthenticodeSignature -FilePath $pad
  $resultaten += [pscustomobject]@{
    bestand    = [System.IO.Path]::GetFileName($pad)
    status     = [string]$s.Status
    uitgever   = if ($s.SignerCertificate) { $s.SignerCertificate.Subject } else { $null }
    tijdstempel = $s.TimeStamperCertificate -ne $null
  }
}
$resultaten | ConvertTo-Json -Compress
`;

let uitvoer;
try {
  uitvoer = execFileSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8" }
  );
} catch (fout) {
  console.error("Kon de handtekening niet uitlezen:", fout.message);
  process.exit(1);
}

const resultaten = [].concat(JSON.parse(uitvoer));
let ongetekend = 0;
for (const resultaat of resultaten) {
  const ok = resultaat.status === "Valid";
  if (!ok) ongetekend += 1;
  console.log(`${ok ? "OK  " : "LEEG"} ${resultaat.bestand}`);
  console.log(`     status: ${resultaat.status}`);
  console.log(`     uitgever: ${resultaat.uitgever || "—"}`);
  console.log(`     tijdstempel: ${resultaat.tijdstempel ? "ja" : "nee"}`);
}

if (ongetekend > 0) {
  console.log(
    `\n${ongetekend} van ${resultaten.length} bestanden is niet ondertekend.` +
      " Zie README → Ondertekening (code signing)."
  );
  if (strict) process.exit(1);
}
