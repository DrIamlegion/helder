// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Controleert of de gebouwde app-map (en de installer) precies bij deze commit hoort.
//
//   node scripts/verify-build.mjs                          → controleert release/win-unpacked
//   node scripts/verify-build.mjs --tag v0.1.7             → controleert ook de tag
//   node scripts/verify-build.mjs --tag v0.1.7 --installer → en de installer plus latest.yml
//   node scripts/verify-build.mjs --app-map <map>          → een andere app-map, bijv. een installatie
//
// Wat er vergeleken wordt, bestand voor bestand met sha256:
//   1. de werkmap hoort bij HEAD (anders een waarschuwing; de app-inhoud wordt hieronder
//      alsnog per bestand tegen HEAD gecontroleerd);
//   2. elk bestand in app.asar dat uit de repository komt (electron/**) is byte-voor-byte gelijk
//      aan de blob in HEAD, er staat geen electron-bestand in de asar dat niet in HEAD zit, en de
//      naam, versie, main en licentie in de meegebouwde package.json zijn dezelfde;
//   3. elk bestand in app.asar onder dist/ is gelijk aan de verse build in dist/ — dus de asar
//      bevat precies de frontend die deze bouw opleverde;
//   4. resources/LICENSE is gelijk aan LICENSE in HEAD (AGPL-verplichting);
//   5. de versie in package.json, in de asar en in de tag is dezelfde; met --installer ook dat
//      de installer van die versie bestaat en latest.yml hem noemt.
//
// De installer wordt met `--prepackaged` bovenop deze app-map gebouwd, dus als de app-map
// klopt, klopt de inhoud van de installer ook.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from "node:fs";
import path from "node:path";

const argumenten = process.argv.slice(2);
const optie = (naam) => {
  const plek = argumenten.indexOf(naam);
  return plek >= 0 ? argumenten[plek + 1] : undefined;
};

const tag = optie("--tag") ?? process.env.GITHUB_REF_NAME ?? "";
const appMap = path.resolve(optie("--app-map") ?? path.join("release", "win-unpacked"));
const asarPad = path.join(appMap, "resources", "app.asar");
const problemen = [];
let gecontroleerd = 0;

function meld(ok, tekst) {
  console.log(`${ok ? "OK  " : "FOUT"} ${tekst}`);
  if (!ok) problemen.push(tekst);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function git(...args) {
  return execFileSync("git", args, { maxBuffer: 256 * 1024 * 1024 });
}

function blobUitGit(pad) {
  return git("cat-file", "blob", `HEAD:${pad}`);
}

// --- 1. Herkomst: is de werkmap de getagde commit, en is de build niet ouder? -------
let commit = "";
try {
  commit = git("rev-parse", "--short", "HEAD").toString().trim();
  const vies = git("status", "--porcelain", "--untracked-files=no").toString().trim();
  if (vies) {
    // Geen fout: een gewijzigde README verandert de app niet. Wat er wél in de app zit,
    // wordt hieronder bestand voor bestand tegen HEAD gecontroleerd.
    console.log(`LET OP niet-gecommitte wijzigingen in de werkmap (${commit}):`);
    console.log(vies.split("\n").map((regel) => `     ${regel}`).join("\n"));
  } else {
    console.log(`OK   werkmap schoon ten opzichte van HEAD (${commit})`);
  }

  // Alleen src/ kan niet met een hash vergeleken worden (het komt via dist/ in de asar). Een
  // build die ouder is dan zijn bron is dus verdacht — maar mtimes zijn een zwak signaal (een
  // verse checkout zet ze allemaal op nu), dus dit waarschuwt en faalt niet.
  const bron = git("ls-files", "--", "src", "index.html")
    .toString()
    .split("\n")
    .filter((bestand) => bestand && existsSync(bestand));
  const asarTijd = statSync(asarPad).mtimeMs;
  const nieuwer = bron.filter((bestand) => statSync(bestand).mtimeMs > asarTijd);
  if (nieuwer.length > 0) {
    console.log(`LET OP de build is ouder dan ${nieuwer.length} bronbestand(en) in src/` +
      ` (${nieuwer.slice(0, 5).join(", ")}${nieuwer.length > 5 ? ", …" : ""}); bouw opnieuw voor een zekere controle`);
  }
} catch (fout) {
  meld(false, `kon de git-status niet lezen: ${fout.message}`);
}

if (!existsSync(asarPad)) {
  console.error(`Geen app.asar gevonden op ${asarPad}. Bouw eerst met electron-builder --dir.`);
  process.exit(1);
}

// --- Kleine, afhankelijkheidsvrije lezer voor het asar-formaat ---------------------
// Een asar is een pickle met daarin een JSON-index; de bestandsinhoud staat achter de index.
function leesAsar(pad) {
  const fd = openSync(pad, "r");
  const kop = Buffer.alloc(8);
  readSync(fd, kop, 0, 8, 0);
  // [4][lengte van de header-pickle]; daarin [payloadlengte][jsonlengte][json…]
  const indexLengte = kop.readUInt32LE(4);
  if (indexLengte <= 0 || indexLengte > 64 * 1024 * 1024) {
    closeSync(fd);
    throw new Error(`geen geldige asar-header (lengte ${indexLengte})`);
  }
  const indexBlok = Buffer.alloc(indexLengte);
  readSync(fd, indexBlok, 0, indexLengte, 8);
  const jsonLengte = indexBlok.readUInt32LE(4);
  if (indexBlok[8] !== 0x7b) throw new Error("asar-header begint niet met een JSON-object");
  const index = JSON.parse(indexBlok.toString("utf8", 8, 8 + jsonLengte));
  const basis = 8 + indexLengte;

  const bestanden = new Map();
  (function loop(map, voorvoegsel) {
    for (const [naam, invoer] of Object.entries(map?.files ?? {})) {
      const sleutel = voorvoegsel ? `${voorvoegsel}/${naam}` : naam;
      if (invoer.files) loop(invoer, sleutel);
      else bestanden.set(sleutel, invoer);
    }
  })(index, "");

  return {
    lees(sleutel) {
      const invoer = bestanden.get(sleutel);
      if (!invoer) return null;
      if (invoer.unpacked) {
        return readFileSync(path.join(`${pad}.unpacked`, sleutel));
      }
      const buffer = Buffer.alloc(Number(invoer.size));
      readSync(fd, buffer, 0, buffer.length, basis + Number(invoer.offset));
      return buffer;
    },
    heeft: (sleutel) => bestanden.has(sleutel),
    sleutels: () => [...bestanden.keys()],
    sluit: () => closeSync(fd),
  };
}

const asar = leesAsar(asarPad);

// --- 2. Repositorybestanden in de asar tegen HEAD --------------------------------
// package.json wordt hier niet byte-voor-byte vergeleken: electron-builder herschrijft hem
// (dev-afhankelijkheden en scripts eruit). De velden die de app gebruikt, vergelijken we wel.
try {
  const uitGit = git("ls-tree", "-r", "--name-only", "HEAD", "--", "electron")
    .toString()
    .split("\n")
    .filter(Boolean);

  let gelijk = 0;
  for (const bestand of uitGit) {
    const inhoud = asar.lees(bestand);
    if (!inhoud) {
      meld(false, `${bestand} ontbreekt in app.asar`);
      continue;
    }
    gecontroleerd += 1;
    if (sha256(inhoud) === sha256(blobUitGit(bestand))) {
      gelijk += 1;
    } else {
      meld(false, `${bestand} wijkt af van HEAD (sha256 verschilt)`);
    }
  }
  meld(gelijk === uitGit.length, `${gelijk}/${uitGit.length} electron-bestanden in app.asar gelijk aan HEAD`);

  const electronInAsar = asar.sleutels().filter((sleutel) => sleutel.startsWith("electron/"));
  const overdadig = electronInAsar.filter((sleutel) => !uitGit.includes(sleutel));
  meld(overdadig.length === 0, `geen electron-bestanden in app.asar die niet in HEAD staan` +
    (overdadig.length ? ` (${overdadig.join(", ")})` : ""));

  // package.json in HEAD versus de herschreven versie in de asar.
  const inGit = JSON.parse(blobUitGit("package.json").toString("utf8"));
  const inAsar = JSON.parse(asar.lees("package.json").toString("utf8"));
  const afwijkend = ["name", "version", "main", "productName", "description", "author", "license"]
    .filter((veld) => JSON.stringify(inAsar[veld] ?? null) !== JSON.stringify(inGit[veld] ?? null));
  meld(afwijkend.length === 0, "package.json in app.asar heeft dezelfde naam, versie, main en licentie" +
    (afwijkend.length ? ` (wijkt af op: ${afwijkend.join(", ")})` : ""));
} catch (fout) {
  meld(false, `kon de repositorybestanden niet vergelijken: ${fout.message}`);
}

// --- 3. Frontend in de asar tegen de verse build in dist/ -------------------------
function bestandenIn(map, voorvoegsel = "", uitkomst = []) {
  for (const naam of readdirSync(map)) {
    const pad = path.join(map, naam);
    if (statSync(pad).isDirectory()) bestandenIn(pad, `${voorvoegsel}${naam}/`, uitkomst);
    else uitkomst.push(`${voorvoegsel}${naam}`);
  }
  return uitkomst;
}

if (!existsSync("dist")) {
  meld(false, "geen dist/ gevonden; de frontend is niet gebouwd");
} else {
  const distBestanden = bestandenIn("dist");
  let gelijk = 0;
  for (const bestand of distBestanden) {
    const inhoud = asar.lees(`dist/${bestand}`);
    gecontroleerd += 1;
    if (!inhoud) {
      meld(false, `dist/${bestand} ontbreekt in app.asar`);
    } else if (sha256(inhoud) !== sha256(readFileSync(path.join("dist", bestand)))) {
      meld(false, `dist/${bestand} in app.asar wijkt af van de build in dist/`);
    } else {
      gelijk += 1;
    }
  }
  const teVeel = asar.sleutels().filter(
    (sleutel) => sleutel.startsWith("dist/") && !distBestanden.includes(sleutel.slice(5))
  );
  meld(gelijk === distBestanden.length && teVeel.length === 0,
    `${gelijk}/${distBestanden.length} frontendbestanden in app.asar gelijk aan dist/` +
      (teVeel.length ? ` (extra: ${teVeel.join(", ")})` : ""));
}

// --- 4. Licentie naast de asar, tegen HEAD --------------------------------------
const licentie = path.join(appMap, "resources", "LICENSE");
try {
  const meegeleverd = existsSync(licentie);
  gecontroleerd += 1;
  meld(meegeleverd, "resources/LICENSE aanwezig");
  if (meegeleverd) {
    meld(sha256(readFileSync(licentie)) === sha256(blobUitGit("LICENSE")), "resources/LICENSE gelijk aan LICENSE in HEAD");
  }
} catch (fout) {
  meld(false, `kon resources/LICENSE niet controleren: ${fout.message}`);
}

meld(existsSync(path.join(appMap, "resources", "app-update.yml")), "resources/app-update.yml aanwezig (updatekanaal)");

// --- 5. Versies: package.json, asar, tag en installer -----------------------------
try {
  const versie = JSON.parse(readFileSync("package.json", "utf8")).version;
  const asarPakket = JSON.parse(asar.lees("package.json").toString("utf8"));
  meld(asarPakket.version === versie, `versie in app.asar (${asarPakket.version}) gelijk aan package.json (${versie})`);

  if (tag) {
    const verwacht = tag.startsWith("v") ? tag.slice(1) : tag;
    meld(versie === verwacht, `versie ${versie} hoort bij tag ${tag}`);
  } else {
    console.log(`LET OP geen --tag opgegeven; de tag zelf is niet gecontroleerd`);
  }

  // Pas controleren als de installer gebouwd is: bij de eerste controle (ná de app-map, vóór
  // de installer) bestaat hij nog niet.
  const installer = path.join("release", `Helder-Setup-${versie}.exe`);
  if (argumenten.includes("--installer")) {
    meld(existsSync(installer), `installer ${installer} aanwezig`);
    const latest = path.join("release", "latest.yml");
    if (existsSync(latest)) {
      const regel = readFileSync(latest, "utf8").match(/^version:\s*(.+)$/m);
      meld(regel?.[1]?.trim() === versie, `latest.yml noemt versie ${regel?.[1]?.trim() ?? "—"} (verwacht ${versie})`);
    }
  }
} catch (fout) {
  meld(false, `kon de versies niet controleren: ${fout.message}`);
}

asar.sluit();
console.log(`\n${gecontroleerd} bestanden hash-voor-hash vergeleken met commit ${commit || "onbekend"}.`);
if (problemen.length > 0) {
  console.error(`\n${problemen.length} controle(s) mislukt:`);
  for (const probleem of problemen) console.error(`- ${probleem}`);
  process.exit(1);
}
console.log("De gebouwde app hoort bij deze commit.");
