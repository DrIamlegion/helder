// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Bouwconfiguratie voor de desktop-app. Alles wat electron-builder nodig heeft staat hier;
// package.json heeft bewust géén `build`-veld, want dan zou dit bestand genegeerd worden.
//
// Ondertekening is afhankelijk van je omgeving: zonder certificaat bouwt en installeert
// Helder gewoon door (ongetekend), met certificaat wordt de installer — en dus elke
// update — ondertekend.
//
// 1. Azure Artifact Signing (voorheen Trusted Signing), cloudondertekening zonder token:
//      HELDER_SIGN=azure
//      HELDER_SIGN_PUBLISHER=<exacte naam op het certificaat>
//      HELDER_SIGN_AZURE_ACCOUNT=<naam van het signing-account>
//      HELDER_SIGN_AZURE_PROFILE=<naam van het certificaatprofiel>
//      HELDER_SIGN_AZURE_ENDPOINT=https://neu.codesigning.azure.net/   (West Europe: weu.)
//      AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET
//
// 2. Een certificaatbestand (.pfx):
//      CSC_LINK=<pad of base64>            (electron-builder leest dit zelf)
//      CSC_KEY_PASSWORD=<wachtwoord>
//
// 3. Een token of cloud-HSM met eigen signing-tool: zie README → Ondertekening; daar hoort
//    een eigen sign-hook bij.
const { notitiesVoor } = require("./scripts/release-notes.cjs");

const azureActief = process.env.HELDER_SIGN === "azure";
const notities = notitiesVoor(require("./package.json").version);

function azureOpties() {
  const verplicht = {
    HELDER_SIGN_PUBLISHER: process.env.HELDER_SIGN_PUBLISHER,
    HELDER_SIGN_AZURE_ACCOUNT: process.env.HELDER_SIGN_AZURE_ACCOUNT,
    HELDER_SIGN_AZURE_PROFILE: process.env.HELDER_SIGN_AZURE_PROFILE,
  };
  const ontbreekt = Object.entries(verplicht)
    .filter(([, waarde]) => !waarde)
    .map(([naam]) => naam);
  if (ontbreekt.length > 0) {
    // Liever hard stoppen dan een ongetekende installer afleveren die je niet verwacht.
    throw new Error(
      `HELDER_SIGN=azure staat aan, maar deze variabelen ontbreken: ${ontbreekt.join(", ")}.`
    );
  }
  const authNamen = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];
  const authGezet = authNamen.filter((naam) => process.env[naam]);
  const authMist = authNamen.filter((naam) => !process.env[naam]);
  // Niets gezet: dan faalt de Azure-authenticatie zelf met een duidelijke melding.
  // Half gezet: bijna zeker een typefout, dus meteen stoppen.
  if (authGezet.length > 0 && authMist.length > 0) {
    throw new Error(
      `Azure-ondertekening is half ingesteld; deze variabelen ontbreken: ${authMist.join(", ")}.`
    );
  }
  return {
    publisherName: process.env.HELDER_SIGN_PUBLISHER,
    endpoint: process.env.HELDER_SIGN_AZURE_ENDPOINT || "https://neu.codesigning.azure.net/",
    codeSigningAccountName: process.env.HELDER_SIGN_AZURE_ACCOUNT,
    certificateProfileName: process.env.HELDER_SIGN_AZURE_PROFILE,
  };
}

module.exports = {
  appId: "nl.helder.app",
  productName: "Helder",
  directories: {
    output: "release",
    buildResources: "build",
  },
  electronDist: "node_modules/electron/dist",
  files: ["electron/**/*", "dist/**/*", "package.json"],
  // Helder is AGPL-3.0: de licentietekst gaat mee de installatiemap in, zodat elke
  // gebruiker hem kan lezen (Help → Licentie opent dit bestand).
  extraResources: ["LICENSE"],
  // Het updatekanaal zijn de releases van deze repository. De release-workflow zet bij elke
  // tag `Helder-Setup-<versie>.exe` en `latest.yml` als assets op die release; de blockmap
  // vervalt, omdat latest.yml er niet naar verwijst en ondertekenen de bytes verandert.
  // electron-updater leest de lijst met releases en haalt `latest.yml` daar op. Zo is er geen
  // eigen updateserver nodig. Met HELDER_UPDATE_URL kun je de app tijdens het testen naar een
  // lokaal kanaal wijzen.
  publish: [
    {
      provider: "github",
      owner: "DrIamlegion",
      repo: "helder",
    },
  ],
  // Wat er in deze versie verandert, komt uit CHANGELOG.md en belandt in latest.yml; de app
  // toont het in de update-kaart voordat de gebruiker installeert.
  releaseInfo: notities
    ? { releaseName: `Helder ${require("./package.json").version}`, releaseNotes: notities }
    : undefined,
  // Met HELDER_SIGN_REQUIRED=1 weigert de bouw een ongetekend resultaat: handig in een
  // release-pijplijn, zodat je nooit per ongeluk een ongetekende update publiceert.
  forceCodeSigning: process.env.HELDER_SIGN_REQUIRED === "1",
  win: {
    icon: "build/icon.ico",
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    artifactName: "Helder-Setup-${version}.${ext}",
    // De uitgever die electron-updater bij een update controleert. Ondertekent SignPath
    // Foundation, zet dan HELDER_SIGN_PUBLISHER op precies die naam; zonder die variabele
    // blijft het veld weg en controleert de updater alleen de hash.
    ...(process.env.HELDER_SIGN_PUBLISHER
      ? { publisherName: process.env.HELDER_SIGN_PUBLISHER }
      : {}),
    ...(azureActief ? { azureSignOptions: azureOpties() } : {}),
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Helder",
    uninstallDisplayName: "Helder",
    deleteAppDataOnUninstall: false,
  },
};
