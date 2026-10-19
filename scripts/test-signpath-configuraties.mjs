// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Controleert de twee artifact configurations van SignPath en de afspraken eromheen.
//
// Zonder SignPath-account is er niets te ondertekenen, dus een fout in die configuratie merk je
// pas bij de eerste echte release — en dan is de tag al gezet. Deze test vangt de fouten die je
// anders pas daar ziet:
//
// - het root-element moet <zip-file> zijn, want actions/upload-artifact verpakt de upload zelf;
// - er mag precies één ondertekeningsopdracht in staan, op ons eigen bestand: de Foundation staat
//   niet toe dat je binaries van upstream met jouw certificaat ondertekent;
// - de metadata-restricties (productnaam, productversie, fileversie) moeten er staan, met de
//   waarden die electron-builder werkelijk in de binaries zet — anders weigert SignPath het
//   artefact, of erger: het klopt niet met wat de Foundation eist;
// - het pad in de configuratie moet passen op wat de workflow uploadt, en bij de installer op de
//   naam die electron-builder maakt;
// - de workflow moet de versie als parameter doorgeven, en de slug moet dezelfde zijn als in de
//   configuratie en in de workflow.
//
// De XML wordt met de XML-parser van .NET gelezen (via PowerShell), niet met een regex: een
// configuratie die niet parseert is geen configuratie.
//
//   node scripts/test-signpath-configuraties.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wortel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lees = (relatief) => readFileSync(path.join(wortel, relatief), "utf8").replace(/\r\n/g, "\n");
const require = createRequire(import.meta.url);

const CONFIGURATIES = {
  "helder-app": "docs/signpath/artifact-configurations/helder-app.xml",
  "helder-installer": "docs/signpath/artifact-configurations/helder-installer.xml",
};

/**
 * Leest één configuratie met de XML-parser van .NET en geeft terug wat deze test nodig heeft.
 * Zo telt de test dezelfde elementen als SignPath zou zien, in plaats van patronen in tekst.
 */
function leesConfiguratie(relatief) {
  const bestand = path.join(wortel, relatief);
  const script = `
$xml = New-Object System.Xml.XmlDocument
$xml.Load(${JSON.stringify(bestand)})
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("a", $xml.DocumentElement.NamespaceURI)
$resultaat = [pscustomobject]@{
  wortel     = $xml.DocumentElement.LocalName
  namespace  = $xml.DocumentElement.NamespaceURI
  kinderen   = @($xml.DocumentElement.SelectNodes("*") | ForEach-Object { $_.LocalName })
  parameters = @($xml.SelectNodes("//a:parameter", $ns) | ForEach-Object { $_.GetAttribute("name") })
  ondertekend = @($xml.SelectNodes("//a:pe-file[a:authenticode-sign]", $ns) | ForEach-Object {
    $attributen = [ordered]@{}
    foreach ($attribuut in $_.Attributes) { $attributen[$attribuut.Name] = $attribuut.Value }
    [pscustomobject]@{ pad = $_.GetAttribute("path"); attributen = $attributen }
  })
  opdrachten = @($xml.SelectNodes("//a:authenticode-sign", $ns)).Count
}
$resultaat | ConvertTo-Json -Depth 6 -Compress
`;
  let uitvoer;
  try {
    uitvoer = execFileSync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8" }
    );
  } catch (fout) {
    throw new Error(`${relatief} is geen leesbare XML: ${(fout.stderr || fout.message).trim()}`);
  }
  return JSON.parse(uitvoer);
}

/** Een pad met `*` en `?`, zoals SignPath dat in een artifact configuration toestaat. */
const padPatroon = (patroon) =>
  new RegExp(
    `^${patroon
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")}$`
  );

const workflow = lees(".github/workflows/release.yml");
const config = require("../electron-builder.cjs");
const pkg = require("../package.json");

for (const [slug, relatief] of Object.entries(CONFIGURATIES)) {
  const gevonden = leesConfiguratie(relatief);

  // 1. Het root-element en de namespace die SignPath verwacht. Het root-element is altijd
  //    <artifact-configuration>; daaronder staat precies één bestandselement, en dat is een
  //    <zip-file> omdat actions/upload-artifact de upload zelf verpakt.
  assert.equal(
    gevonden.wortel,
    "artifact-configuration",
    `${slug}: het root-element is <artifact-configuration>`
  );
  assert.equal(
    gevonden.namespace,
    "http://signpath.io/artifact-configuration/v1",
    `${slug}: de namespace is die van SignPath`
  );
  const rootKinderen = gevonden.kinderen.filter((naam) => naam !== "parameters");
  assert.deepEqual(
    rootKinderen,
    ["zip-file"],
    `${slug}: onder de root staat precies één bestandselement, en dat is een <zip-file>`
  );

  // 2. Precies één ondertekeningsopdracht: alleen ons eigen bestand.
  assert.equal(gevonden.opdrachten, 1, `${slug}: er staat precies één <authenticode-sign> in`);
  assert.equal(gevonden.ondertekend.length, 1, `${slug}: er is precies één <pe-file> die ondertekend wordt`);

  const ondertekend = gevonden.ondertekend[0];
  const attributen = ondertekend.attributen || {};

  // 3. De metadata-restricties die de Foundation eist, met de waarden uit een echte build.
  assert.equal(attributen["product-name"], "Helder", `${slug}: de productnaam is de projectnaam`);
  assert.equal(attributen["company-name"], "Helder", `${slug}: de bedrijfsnaam is dezelfde in elke build`);
  assert.ok(
    attributen["product-version"],
    `${slug}: de productversie is een restrictie, geen lege regel in het beleid`
  );
  assert.ok(attributen["file-version"], `${slug}: ook de fileversie is vastgelegd`);
  assert.ok(
    /\$\{version\}/.test(attributen["product-version"]),
    `${slug}: de productversie komt uit de parameter version, niet uit een hardcoded nummer`
  );

  // 4. De parameter die de configuratie eist, wordt in de workflow ook meegegeven.
  assert.deepEqual(gevonden.parameters, ["version"], `${slug}: de configuratie vraagt om parameter version`);
  assert.match(
    workflow,
    new RegExp(`artifact-configuration-slug: ${slug}\\n\\s+parameters: \\|\\n\\s+version: "\\$\\{\\{ env\\.VERSIE \\}\\}"`),
    `${slug}: de workflow geeft version mee aan de ondertekeningsaanvraag`
  );
  assert.match(
    workflow,
    /echo "VERSIE=\$versie" >> "\$GITHUB_ENV"/,
    "de workflow zet de versie uit package.json in de omgeving, waaruit de parameter komt"
  );
}

// 5. De app-configuratie past op wat de workflow uploadt: de inhoud van win-unpacked, dus
//    Helder.exe bovenaan in het archief en niet in een map.
const app = leesConfiguratie(CONFIGURATIES["helder-app"]).ondertekend[0];
assert.equal(app.pad, "Helder.exe", "helder-app: het pad is Helder.exe, zonder map ervoor");
assert.match(workflow, /path: release\/win-unpacked\//, "de workflow uploadt de inhoud van win-unpacked");

// 6. De installer-configuratie past op de naam die electron-builder maakt, zonder dat er een
//    versienummer in het pad staat dat elke release aangepast zou moeten worden.
const installer = leesConfiguratie(CONFIGURATIES["helder-installer"]).ondertekend[0];
assert.match(
  workflow,
  /path: release\/Helder-Setup-\*\.exe/,
  "de workflow uploadt de installer als los bestand"
);
const installernaam = config.win.artifactName
  .replace("${version}", pkg.version)
  .replace("${ext}", "exe");
assert.ok(
  padPatroon(installer.pad).test(installernaam),
  `helder-installer: het pad ${installer.pad} past op ${installernaam}`
);
assert.ok(
  !padPatroon(installer.pad).test(`${installernaam}.blockmap`),
  "helder-installer: het patroon matcht alleen de installer, niet de blockmap"
);

// 7. De versie in de restrictie is dezelfde als die in de app-exe: electron-builder zet daar een
//    vierdelige productversie neer (0.1.10.0 bij versie 0.1.10) en een driedelige fileversie.
assert.equal(
  app.attributen["product-version"],
  "${version}.0",
  "helder-app: de productversie van de app-exe is vierdelig (versie.0)"
);
assert.equal(app.attributen["file-version"], "${version}", "helder-app: de fileversie is driedelig");
assert.equal(
  installer.attributen["product-version"],
  "${version}",
  "helder-installer: de productversie van de installer is driedelig"
);
assert.equal(installer.attributen["file-version"], "${version}", "helder-installer: de fileversie is driedelig");

console.log(
  `SignPath-configuraties: ${Object.keys(CONFIGURATIES).length} configuraties, elk één ondertekend bestand, ` +
    "metadata-restricties en de versieparameter kloppen met de workflow."
);
