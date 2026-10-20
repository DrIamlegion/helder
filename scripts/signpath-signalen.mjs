// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: GPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU General Public License, versie 3. Zie LICENSE.

// Legt vast wat er op dit moment aan het project te zien is: sterren, forks, downloads,
// releases, en of er iemand van buiten de maintainer meedoet. SignPath Foundation weegt de
// reputatie van een project mee, en "we zijn actief" is geen argument; een getal met een datum
// erbij wel. Elke meting blijft bewaard, zodat een tweede aanvraag het verschil kan laten zien
// in plaats van hetzelfde verhaal nog eens te vertellen.
//
//   npm run signalen                → meet en schrijft docs/signpath-signalen.json bij
//   npm run signalen -- --print     → alleen tonen, niets opslaan
//
// Zonder GITHUB_TOKEN doet het script een handvol anonieme verzoeken (60 per uur toegestaan);
// staat er wel een token in de omgeving, dan gebruikt het die. Het draait bewust niet in de CI:
// een test hoort niet van GitHub af te hangen, en een meting van een pull request zegt niets.
// Wat er wél in de CI zit, is scripts/test-signpath-signalen.mjs: dat test het telwerk op
// vaste antwoorden, zonder netwerk.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORTEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const STANDAARD_REPOSITORY = "DrIamlegion/helder";
export const HISTORIE = path.join(WORTEL, "docs", "signpath-signalen.json");

const KOP = {
  Accept: "application/vnd.github+json",
  "User-Agent": `helder-signalen (+https://github.com/${STANDAARD_REPOSITORY})`,
  "X-GitHub-Api-Version": "2022-11-28",
};

/**
 * Telt de signalen uit de antwoorden van de GitHub-API. Los van het netwerk, zodat de test
 * dezelfde functie kan voeren met vaste antwoorden.
 *
 * `issues` is het hele /issues-antwoord: GitHub zet pull requests in dezelfde lijst, met een
 * `pull_request`-veld erbij. Wie de repository beheert telt niet als "van buitenaf", en bots
 * al helemaal niet — een bot die een taak opent is geen gebruiker die het project kent.
 *
 * `commits` is /commits. Die lijst is de enige betrouwbare bron voor "doet er iemand anders
 * mee?": /contributors geeft hier een lege lijst, omdat de commits onder een naam en adres
 * staan die niet aan een GitHub-account hangen. Daarom telt de identiteit per commit zoals
 * GitHub hem teruggeeft — de login als die er is, anders het e-mailadres of de naam — en geldt
 * de identiteit met de meeste commits als die van het project zelf. Alles daarnaast, behalve de
 * eigenaar en bots, is iemand van buitenaf.
 */
export function telSignalen({
  repository = STANDAARD_REPOSITORY,
  repositoryGegevens = {},
  uitgaven = [],
  issues = [],
  commits = [],
  opgenomen = new Date().toISOString(),
}) {
  const eigenaar = String(repository).split("/")[0].toLowerCase();

  const vanBuitenaf = (item) => {
    const gebruiker = item.user || item;
    const login = String(gebruiker.login || "").toLowerCase();
    const isBot = gebruiker.type === "Bot" || login.endsWith("[bot]");
    return login !== "" && login !== eigenaar && !isBot;
  };

  const gepubliceerd = uitgaven.filter((uitgave) => !uitgave.draft);
  const opDatum = [...gepubliceerd].sort((a, b) =>
    String(a.published_at || "").localeCompare(String(b.published_at || ""))
  );
  const downloads = gepubliceerd.reduce(
    (som, uitgave) =>
      som +
      (uitgave.assets || []).reduce((rij, bestand) => rij + (Number(bestand.download_count) || 0), 0),
    0
  );

  const echteIssues = issues.filter((item) => !item.pull_request);
  const pullRequests = issues.filter((item) => item.pull_request);
  const open = (item) => item.state === "open";

  const identiteitVan = (commit) => {
    const auteur = commit.author || {};
    if (auteur.login && !auteur.login.endsWith("[bot]")) return auteur.login.toLowerCase();
    const gegevens = (commit.commit && commit.commit.author) || {};
    return String(gegevens.email || gegevens.name || "onbekend").toLowerCase();
  };
  const isBot = (commit) => {
    const auteur = commit.author || {};
    return auteur.type === "Bot" || String(auteur.login || "").endsWith("[bot]");
  };

  const perIdentiteit = new Map();
  for (const commit of commits) {
    if (isBot(commit)) continue;
    const identiteit = identiteitVan(commit);
    perIdentiteit.set(identiteit, (perIdentiteit.get(identiteit) || 0) + 1);
  }
  let eigenIdentiteit = null;
  for (const [identiteit, aantal] of perIdentiteit) {
    if (eigenIdentiteit === null || aantal > perIdentiteit.get(eigenIdentiteit)) eigenIdentiteit = identiteit;
  }
  const auteursVanBuitenaf = [...perIdentiteit.keys()].filter(
    (identiteit) => identiteit !== eigenIdentiteit && identiteit !== eigenaar
  ).length;

  return {
    opgenomen,
    repository,
    sterren: Number(repositoryGegevens.stargazers_count) || 0,
    forks: Number(repositoryGegevens.forks_count) || 0,
    kijkers: Number(repositoryGegevens.subscribers_count) || 0,
    licentie: (repositoryGegevens.license && repositoryGegevens.license.spdx_id) || null,
    repositorySinds: repositoryGegevens.created_at || null,
    laatstePush: repositoryGegevens.pushed_at || null,
    uitgaven: gepubliceerd.length,
    proefversies: gepubliceerd.filter((uitgave) => uitgave.prerelease).length,
    eersteUitgave: (opDatum[0] && opDatum[0].tag_name) || null,
    laatsteUitgave: (opDatum[opDatum.length - 1] && opDatum[opDatum.length - 1].tag_name) || null,
    downloads,
    issues: echteIssues.length,
    issuesVanBuitenaf: echteIssues.filter(vanBuitenaf).length,
    pullRequests: pullRequests.length,
    pullRequestsVanBuitenaf: pullRequests.filter(vanBuitenaf).length,
    openVanBuitenaf: [...echteIssues, ...pullRequests].filter((item) => vanBuitenaf(item) && open(item))
      .length,
    commits: commits.length - commits.filter(isBot).length,
    auteurs: perIdentiteit.size,
    eigenIdentiteit,
    auteursVanBuitenaf,
  };
}

/**
 * De historie met de nieuwe meting erin. Eén meting per dag: draai je het script twee keer op
 * dezelfde dag, dan vervangt de laatste de eerste in plaats van hem ernaast te zetten. Zo blijft
 * het bestand een reeks dagen en geen reeks pogingen.
 */
export function werkHistorieBij(historie, meting) {
  const vandaag = String(meting.opgenomen).slice(0, 10);
  const ouder = (historie || []).filter((metingUit) => String(metingUit.opgenomen).slice(0, 10) !== vandaag);
  return [...ouder, meting];
}

async function haalOp(pad) {
  const kop = { ...KOP };
  if (process.env.GITHUB_TOKEN) kop.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const antwoord = await fetch(`https://api.github.com${pad}`, { headers: kop });
  if (!antwoord.ok) {
    const tip =
      antwoord.status === 403 || antwoord.status === 429
        ? " (waarschijnlijk de limiet voor anonieme verzoeken; zet GITHUB_TOKEN in je omgeving)"
        : antwoord.status === 404
          ? " (bestaat de repository nog, en is hij openbaar?)"
          : "";
    throw new Error(`GitHub antwoordde ${antwoord.status} op ${pad}${tip}`);
  }
  return antwoord.json();
}

async function haalAllesOp(pad, maximaalPaginas = 10) {
  const alles = [];
  for (let pagina = 1; pagina <= maximaalPaginas; pagina++) {
    const scheiding = pad.includes("?") ? "&" : "?";
    const deel = await haalOp(`${pad}${scheiding}per_page=100&page=${pagina}`);
    if (!Array.isArray(deel)) throw new Error(`Verwachtte een lijst van ${pad}, kreeg iets anders.`);
    alles.push(...deel);
    if (deel.length < 100) break;
  }
  return alles;
}

async function main() {
  const alleenTonen = process.argv.includes("--print");
  const repository = process.env.HELDER_REPO || STANDAARD_REPOSITORY;
  const basis = `/repos/${repository}`;

  const [repositoryGegevens, uitgaven, issues, commits] = await Promise.all([
    haalOp(basis),
    haalAllesOp(`${basis}/releases`),
    haalAllesOp(`${basis}/issues?state=all`),
    haalAllesOp(`${basis}/commits`),
  ]);

  // De commits worden tot duizend opgehaald (tien pagina's van honderd). Zit een project daar
  // ooit boven, dan is het aantal commits in de meting een ondergrens; de auteurs zijn het niet,
  // want die staan in de eerste duizend al. Zeg dat hardop in plaats van een te laag getal als
  // waarheid op te schrijven.
  const commitsAfgekapt = commits.length >= 1000;

  const meting = telSignalen({ repository, repositoryGegevens, uitgaven, issues, commits });

  console.log(`Signalen voor ${repository} — ${meting.opgenomen.slice(0, 10)}`);
  const regels = [
    ["sterren", meting.sterren],
    ["forks", meting.forks],
    ["kijkers", meting.kijkers],
    ["releases", `${meting.uitgaven} (${meting.eersteUitgave} → ${meting.laatsteUitgave})`],
    ["downloads", meting.downloads],
    ["issues van buitenaf", `${meting.issuesVanBuitenaf} van ${meting.issues}`],
    ["pull requests van buitenaf", `${meting.pullRequestsVanBuitenaf} van ${meting.pullRequests}`],
    ["auteurs van buitenaf", `${meting.auteursVanBuitenaf} van ${meting.auteurs}`],
    ["commits", `${meting.commits} (eigen identiteit: ${meting.eigenIdentiteit || "—"})`],
  ];
  for (const [naam, waarde] of regels) console.log(`  ${naam.padEnd(26)} ${waarde}`);
  if (commitsAfgekapt) {
    console.log("  let op: alleen de nieuwste 1000 commits zijn geteld; het aantal commits is een ondergrens.");
  }

  if (alleenTonen) {
    console.log("\nNiets opgeslagen (--print).");
    return;
  }

  let historie = [];
  try {
    historie = JSON.parse(readFileSync(HISTORIE, "utf8"));
    if (!Array.isArray(historie)) historie = [];
  } catch (fout) {
    if (fout.code !== "ENOENT") throw new Error(`${HISTORIE} is geen leesbare JSON: ${fout.message}`);
  }

  const nieuw = werkHistorieBij(historie, meting);
  writeFileSync(HISTORIE, `${JSON.stringify(nieuw, null, 2)}\n`);
  console.log(
    `\nOpgeslagen in ${path.relative(WORTEL, HISTORIE).replace(/\\/g, "/")}` +
      ` (${nieuw.length} ${nieuw.length === 1 ? "meting" : "metingen"}).`
  );
  console.log("Neem de cijfers over in docs/signpath-aanvraag-log.md zodra je een nieuwe poging doet.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((fout) => {
    console.error(`Kon de signalen niet ophalen: ${fout.message}`);
    process.exit(1);
  });
}
