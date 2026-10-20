// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Test het telwerk van scripts/signpath-signalen.mjs op vaste antwoorden, zonder netwerk. De
// cijfers uit dat script belanden in een aanvraag bij SignPath Foundation; een telling die
// stilletjes te hoog uitvalt (bots meegeteld, eigen issues als "van buitenaf", een concept-release
// als uitgave) is daar erger dan een ontbrekend getal. Deze test legt de vier valkuilen vast die
// de GitHub-API zelf in de antwoorden stopt.
//
//   node scripts/test-signpath-signalen.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { HISTORIE, telSignalen, werkHistorieBij } from "./signpath-signalen.mjs";

const repository = "DrIamlegion/helder";

const repositoryGegevens = {
  stargazers_count: 3,
  forks_count: 1,
  subscribers_count: 2,
  license: { spdx_id: "AGPL-3.0" },
  created_at: "2026-10-18T09:00:00Z",
  pushed_at: "2026-10-19T10:00:00Z",
};

const uitgaven = [
  {
    tag_name: "v0.2.0",
    draft: true,
    prerelease: false,
    published_at: "2026-10-20T10:00:00Z",
    assets: [{ download_count: 999 }],
  },
  {
    tag_name: "v0.1.11",
    draft: false,
    prerelease: true,
    published_at: "2026-10-19T10:00:00Z",
    assets: [{ download_count: 5 }, { download_count: 1 }],
  },
  {
    tag_name: "v0.1.10",
    draft: false,
    prerelease: false,
    published_at: "2026-10-18T10:00:00Z",
    assets: [{ download_count: 100 }],
  },
];

const issues = [
  // Een eigen issue telt niet als "van buitenaf", ook niet als de login anders geschreven is.
  { number: 1, state: "closed", user: { login: "driamlegion", type: "User" } },
  { number: 2, state: "open", user: { login: "iemand", type: "User" } },
  // Een pull request staat in dezelfde lijst, met een pull_request-veld erbij.
  { number: 3, state: "open", user: { login: "helper", type: "User" }, pull_request: { url: "x" } },
  // Bots zijn geen gebruikers die het project kennen.
  { number: 4, state: "open", user: { login: "dependabot[bot]", type: "Bot" }, pull_request: { url: "x" } },
  { number: 5, state: "open", user: { login: "DrIamlegion", type: "User" }, pull_request: { url: "x" } },
];

// De commits van dit project staan onder een naam en adres zonder GitHub-account, en daarom
// geeft /contributors een lege lijst. De identiteit per commit is dan de enige bron.
const eigen = (aantal) =>
  Array.from({ length: aantal }, () => ({
    author: { login: null, type: "User" },
    commit: { author: { email: "noreply@localhost", name: "Helder-auteurs" } },
  }));

const commits = [
  ...eigen(3),
  // Dezelfde persoon, maar nu met een gekoppeld account: dat is geen tweede auteur.
  { author: { login: "DrIamlegion", type: "User" }, commit: { author: { email: "hhpomp@gmail.com" } } },
  { author: { login: "helper", type: "User" }, commit: { author: { email: "h@example.org" } } },
  { author: { login: "dependabot[bot]", type: "Bot" }, commit: { author: { email: "bot@github.com" } } },
];

const meting = telSignalen({
  repository,
  repositoryGegevens,
  uitgaven,
  issues,
  commits,
  opgenomen: "2026-10-19T12:00:00.000Z",
});

// 1. De vaste cijfers van de repository.
assert.equal(meting.repository, repository, "de repository staat in de meting");
assert.equal(meting.sterren, 3, "sterren komen uit de repositorygegevens");
assert.equal(meting.forks, 1, "forks komen uit de repositorygegevens");
assert.equal(meting.licentie, "AGPL-3.0", "de licentie wordt overgenomen");
assert.equal(meting.repositorySinds, "2026-10-18T09:00:00Z", "de datum van de eerste commit staat erbij");

// 2. Releases: concepten tellen niet mee, proefversies wel, en downloads zijn de som per asset.
assert.equal(meting.uitgaven, 2, "een concept-release telt niet als uitgave");
assert.equal(meting.downloads, 106, "downloads zijn de som van alle assets van gepubliceerde releases");
assert.equal(meting.eersteUitgave, "v0.1.10", "de eerste uitgave is de oudste op publicatiedatum");
assert.equal(meting.laatsteUitgave, "v0.1.11", "de laatste uitgave is de nieuwste op publicatiedatum");
assert.equal(meting.proefversies, 1, "proefversies worden apart geteld");

// 3. Issues en pull requests: gescheiden, en alleen wat echt van iemand anders komt.
assert.equal(meting.issues, 2, "pull requests worden niet als issue geteld");
assert.equal(meting.issuesVanBuitenaf, 1, "een eigen issue telt niet als van buitenaf");
assert.equal(meting.pullRequests, 3, "pull requests worden apart geteld");
assert.equal(meting.pullRequestsVanBuitenaf, 1, "een bot en de maintainer zelf tellen niet mee");
assert.equal(meting.openVanBuitenaf, 2, "openstaand werk van buitenaf telt issues en pull requests");

// 4. Auteurs: de bot telt niet, en de eigenaar onder een tweede identiteit is geen buitenstaander.
assert.equal(meting.commits, 5, "een bot-commit telt niet als commit");
assert.equal(meting.auteurs, 3, "drie identiteiten, zonder de bot");
assert.equal(
  meting.eigenIdentiteit,
  "noreply@localhost",
  "de identiteit met de meeste commits geldt als die van het project"
);
assert.equal(meting.auteursVanBuitenaf, 1, "de eigenaar en een bot tellen niet als auteur van buitenaf");

// 5. Een leeg antwoord mag geen fout opleveren: een project zonder sterren of releases bestaat.
const leeg = telSignalen({ repository, opgenomen: "2026-10-19T12:00:00.000Z" });
assert.equal(leeg.sterren, 0, "zonder gegevens is het aantal sterren nul");
assert.equal(leeg.downloads, 0, "zonder releases is het aantal downloads nul");
assert.equal(leeg.eersteUitgave, null, "zonder releases is er geen eerste uitgave");
assert.equal(leeg.auteurs, 0, "zonder commits zijn er geen auteurs");
assert.equal(leeg.eigenIdentiteit, null, "zonder commits is er geen eigen identiteit");
assert.equal(leeg.auteursVanBuitenaf, 0, "zonder commits is er niemand van buitenaf");

// 6. De historie is één meting per dag, en de rest blijft staan.
const gisteren = { opgenomen: "2026-10-18T08:00:00.000Z", sterren: 1 };
const eerderVandaag = { opgenomen: "2026-10-19T06:00:00.000Z", sterren: 2 };
const historie = werkHistorieBij(werkHistorieBij([gisteren], eerderVandaag), meting);
assert.equal(historie.length, 2, "twee metingen op één dag worden één meting");
assert.deepEqual(
  historie.map((rij) => rij.opgenomen.slice(0, 10)),
  ["2026-10-18", "2026-10-19"],
  "de metingen staan op datum"
);
assert.equal(historie[1].sterren, 3, "de laatste meting van de dag wint");

// 7. Het bestand waar het script naartoe schrijft hoort bij de documentatie van de aanvraag.
assert.equal(path.basename(HISTORIE), "signpath-signalen.json", "de metingen komen in signpath-signalen.json");
assert.equal(path.basename(path.dirname(HISTORIE)), "docs", "de metingen horen in docs/");

console.log(
  `Signalen: ${meting.sterren} sterren, ${meting.downloads} downloads, ${meting.issuesVanBuitenaf} issues, ` +
    `${meting.pullRequestsVanBuitenaf} pull requests en ${meting.auteursVanBuitenaf} auteurs van buitenaf — ` +
    "concepten, bots en eigen werk niet meegeteld."
);
