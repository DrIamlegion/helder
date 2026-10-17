# Helder — boekhouden zonder ruis

Een werkende demo van een compacte boekhoudapp voor zzp en mkb, geïnspireerd op SnelStart:
facturen, klanten, uitgaven en de btw-aangifte in één overzicht.

Gebouwd met **Vite**, **React** en **TypeScript**, zonder backend. De data staat in
`localStorage` van je browser.

## Snel starten

```bash
npm install
npm run dev
```

Open daarna <http://localhost:5173/>.

| Script              | Wat het doet                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Dev-server met hot reload op poort 5173           |
| `npm run build`     | Typecheck (`tsc --noEmit`) en productie-build     |
| `npm run preview`   | De productie-build lokaal bekijken                |
| `npm run typecheck` | Alleen de TypeScript-controle                     |

## Wat werkt

- **Dashboard** — omzet dit kwartaal, openstaand, btw en resultaat; omzet/kosten per maand;
  openstaande facturen en snelacties.
- **Facturen** — zoeken, filteren, automatisch oplopende nummering (`2026-0001`), regels met
  21%, 9% of 0% btw, betaaltermijn en vervaldatum, status (concept/verzonden/betaald/vervallen),
  dupliceren, verwijderen, CSV-export en een printbare factuur (Print / PDF).
- **Aanmaningen** — Helder zet zelf een brief klaar zodra een factuur lang genoeg vervallen is
  (betaalherinnering, aanmaning of laatste aanmaning), met een melding op het dashboard, een
  printbare brief, incassokosten volgens de wettelijke staffel en een logboek van alles wat je al
  hebt verstuurd. Voorstellen kun je afwijzen; versturen doe je altijd zelf. Op de laatste
  aanmaning staat een voorstel voor een betaalregeling in termijnen, met een aflosschema; zolang
  die regeling loopt, pauzeert Helder de aanmaningen.
- **Offertes** — eigen nummering (`OFF-2026-0001`), geldigheidsduur, status
  (concept/verzonden/geaccepteerd/afgewezen/verlopen), pipeline- en conversiecijfers, printbare
  offerte en omzetten naar factuur met behoud van klant en regels.
- **Producten & diensten** — catalogus met prijs, btw en eenheid; in de factuur- en offerte-editor
  voeg je een product met één klik als regel toe.
- **Terugkerende facturen** — plan vaste facturen per week, maand, kwartaal of jaar. Helder maakt
  op de geplande datum automatisch een conceptfactuur, houdt de volgende datum bij en stopt bij
  een optionele einddatum. Regels zijn te pauzeren, te bewerken en handmatig te factureren.
- **Klanten** — klantkaarten met omzet dit jaar en openstaand bedrag, toevoegen en bewerken,
  doorklikken naar de facturen van die klant.
- **Uitgaven** — bonnen en abonnementen met categorie, btw-berekening en de vraag of de btw
  aftrekbaar is; direct verwerkt in de btw-aangifte.
- **Bank** — CSV-afschriften importeren (puntkomma of komma, Nederlandse bedragen),
  ontvangsten aan openstaande facturen koppelen op basis van een exact bedrag, koppelingen
  ongedaan maken en uitgaande mutaties negeren of heropenen.
- **Rapporten** — omzet en kosten per maand, ouderdomsanalyse van openstaande facturen, top
  klanten en btw per kwartaal, met een jaarfilter en CSV-export voor je accountant.
- **Btw-aangifte** — per kwartaal de rubrieken 1a, 1b, 1c, 5a, 5b en 5c, met deadline,
  indienstatus, onderbouwing en CSV-export.
- **Instellingen** — bedrijfsgegevens, IBAN, betaaltermijn, automatisch klaarzetten van
  aanmaningen aan/uit, JSON-back-up downloaden én terugzetten (met validatie en migratie van
  oudere back-ups) en demo-data resetten.

Sneltoetsen: `N` nieuwe factuur, `O` nieuwe offerte, `R` herhalingen, `B` btw-aangifte,
`U` uitgaven, `K` klanten, `P` producten, `A` rapporten, `H` aanmaningen. Met `Ctrl / ⌘ + K` open je vanaf
elke pagina de zoekbalk voor pagina's, facturen, offertes, klanten en producten.

## Structuur

```
index.html              HTML-entry met de root-node
vite.config.ts          Vite-configuratie met React-plugin
tsconfig.json           stricte TypeScript-configuratie
src/main.tsx            React-root, router en providers
src/App.tsx             app-shell, sidebar, sneltoetsen en routes
src/types.ts            datamodel (bedrijf, klant, factuur, offerte, product, herhaling, btw)
src/data.ts             demo-data, migratie, herhaalplanning, opslagsleutel en btw-berekening
src/bank.ts             CSV-parser voor bankafschriften en factuurherkenning
src/reminders.ts        niveaus, incassokosten en briefteksten voor herinneringen en aanmaningen
src/paymentPlans.ts     betaalregelingen: termijnen, aflosschema, voortgang en achterstand
src/planLink.ts         deelbare acceptatielink, bevestigingscode en iDEAL-betaallink
src/lib.ts              valuta, datums, documentberekeningen, CSV en download
src/store.tsx           React-context met localStorage-persistentie
src/components/         iconen, modals, formulieren, toast, factuur- en offertedocument
src/pages/              dashboard, facturen, aanmaningen en brief, offertes, herhalingen, producten, klanten, uitgaven, bank, rapporten, btw, instellingen
src/styles.css          design system en print-stijl
```

## Offertes en producten

- Offertes hebben een eigen nummerreeks en tellen niet mee in de btw-aangifte.
- Een offerte is "verlopen" zolang de geldigheidsdatum voorbij is en er nog geen beslissing is.
- "Maak factuur" kopieert klant en regels naar een nieuwe conceptfactuur en koppelt beide
  documenten; de offerte blijft daarna naar de factuur verwijzen.
- Producten zijn voorgevulde regels (naam, omschrijving, prijs, btw, eenheid) en worden niet
  met terugwerkende kracht aangepast op bestaande documenten.

## Terugkerende facturen

- Een herhaling heeft een interval, een volgende factuurdatum, een betaaltermijn en optioneel een
  einddatum.
- Bij het openen van de app worden alle actieve herhalingen doorgerekend tot vandaag; per
  gemiste datum komt er één conceptfactuur bij (maximaal 24 per keer).
- Concepten hebben de geplande factuurdatum; de vervaldatum volgt uit de betaaltermijn.
- De volgende datum schuift na elke run door. Een gepauzeerde herhaling maakt niets aan.
- "Nu factureren" maakt meteen één concept met de datum van vandaag en schuift de planning één
  interval op.

## Bank en rapporten

- Een bank-CSV heeft minimaal een datum- en bedragkolom; tegenpartij, omschrijving en rekening
  zijn optioneel. Puntkomma en komma worden allebei herkend.
- Importeren slaat regels over die al in de administratie staan (zelfde datum, bedrag,
  tegenpartij en omschrijving) en accepteert maximaal 1000 regels per bestand.
- Koppelen kan alleen bij een openstaande factuur met exact hetzelfde bedrag. De factuur wordt
  daarna betaald op de datum van de bankmutatie; de koppeling is bij beide kanten zichtbaar.
- Het rapport gebruikt factuurdatum voor omzet, net als de btw-aangifte. De ouderdomsanalyse
  kijkt naar alle openstaande facturen, ongeacht het gekozen boekjaar.

## Aanmaningen

- Alleen facturen die over de vervaldatum zijn (status "vervallen") komen in het overzicht.
- Niveaus: 1 betaalherinnering (14 dagen), 2 aanmaning (14 dagen) en 3 laatste aanmaning
  (7 dagen). Elke verstuurde brief zet de volgende stap een niveau hoger; bij 30 dagen te laat is
  niveau 2 het minimum en bij 60 dagen niveau 3.
- De brief is een printbare pagina met bedrijfsgegevens, factuurgegevens, onderwerp, aanhef en
  sluiting. De laatste aanmaning vermeldt de buitengerechtelijke incassokosten volgens de
  wettelijke staffel (minimaal € 40, nooit meer dan de openstaande hoofdsom) en de wettelijke
  rente.
- "Markeer als verzonden" legt vast wat er is verstuurd, met datum en niveau. Verstuurde brieven
  staan op de factuur en in het overzicht, en zijn daar ook weer te verwijderen.
- Automatisch klaarzetten (aan te zetten in de instellingen) werkt met drempels van 14, 30 en 60
  dagen over de vervaldatum. Er staat nooit meer dan één voorstel per factuur open en tussen twee
  brieven zit minstens 14 dagen rust.
- Klaargezette voorstellen verschijnen bovenaan de aanmaningenpagina en als melding op het
  dashboard. "Afwijzen" laat dat niveau met rust, zodat Helder het niet opnieuw voorstelt.
- Een voorstel verdwijnt vanzelf zodra de factuur niet meer vervallen is, bijvoorbeeld omdat de
  betaling is binnengekomen of de factuur is verwijderd.

## Betaalregelingen

- Alleen de laatste aanmaning (niveau 3) stelt een regeling voor: standaard 3 termijnen, elke
  maand, met de eerste termijn 14 dagen na de brief. Boven de brief kies je 2–6 termijnen en een
  interval van een week, twee weken of een maand; het aflosschema op de brief rekent direct mee.
- De termijnen tellen op tot het openstaande factuurbedrag (de laatste termijn vangt het
  afrondingsverschil op). Zolang de klant de termijnen op tijd betaalt, blijven incassokosten en
  wettelijke rente buiten beschouwing.
- "Versturen + regeling vastleggen" verstuurt de laatste aanmaning en legt de afspraak in één keer
  vast (factuur, aantal termijnen, interval, eerste termijn). Er loopt per factuur maximaal één
  regeling; een nieuwe regeling sluit de oude af en blijft als historie bewaard.
- Zolang een regeling loopt, zet Helder geen nieuwe brieven voor die factuur klaar. Op de
  aanmaningenpagina zie je per regeling de volgende termijn, de voortgang en eventuele
  achterstand; daar kun je de regeling ook stopzetten, waarna het aanmanen weer hervat.
- De regeling stopt automatisch zodra de factuur betaald is of verdwijnt. Helder controleert niet
  of de termijnen echt betaald zijn: de datums gelden als afspraak.
- Bij de regeling hoort een **deelbare link** (`#/regeling/…`). De klant opent die zonder account,
  ziet het aflosschema en geeft akkoord; het tijdstip van akkoord wordt in de pagina vastgelegd.
  Omdat Helder lokaal draait en geen server heeft, stuurt de klant de **bevestigingscode** terug
  (kopiëren of via de mailknop). Op de aanmaningenpagina plak je die code bij de regeling; Helder
  controleert dat de code bij precies die afspraak en dat aflosschema hoort en zet het akkoord met
  tijdstip op de regeling. Daarna staat er "Geaccepteerd" in plaats van "Wacht op klant".
- Naast de deellink staat een veld voor een **iDEAL-betaallink**. Je maakt die aan in je
  betaalprovider (Mollie, Stripe, je bank) voor het bedrag van de eerste termijn en plakt hem in
  Helder; de link reist mee in de deellink. Na het akkoord ziet de klant meteen een betaalknop
  "Betaal € … met iDEAL" naar die betaalpagina. Zonder betaallink wijst de pagina op een gewone
  overboeking. Helder opent de link alleen: of er echt betaald is, lees je uit de bankmutaties,
  niet uit het akkoord.

## Btw-logica

- Omzet wordt geteld op factuurdatum, exclusief concepten.
- Voorbelasting komt uit uitgaven waarvan de btw als aftrekbaar staat.
- 5a = btw over 21% + 9%; 5b = voorbelasting; 5c = 5a − 5b.
- Een negatief saldo betekent terug te ontvangen.
- De deadline is de laatste dag van de maand ná het kwartaal (Q3 → 31 oktober).

## Windows-installer

Wil je Helder als gewoon Windows-programma met een installer, dan bouw je die zelf:

- `npm run installer` bouwt de app en maakt **`release/Helder-Setup-<versie>.exe`** (ongeveer 110 MB;
  Electron zit erin). Dubbelklikken installeert Helder **per gebruiker** in
  `%LOCALAPPDATA%\Programs\Helder` — geen beheerdersrechten nodig. Je krijgt een pictogram in het
  startmenu en op het bureaublad, en in *Apps en onderdelen* staat een uninstaller.
- De installer is **nog niet ondertekend**: de gratis route via SignPath Foundation staat klaar
  in de release-workflow, maar is pas actief zodra de repository openbaar is en het
  SignPath-project is goedgekeurd. Tot die tijd zegt SmartScreen de eerste keer "Windows heeft uw
  pc beschermd"; kies *Meer informatie* → *Toch uitvoeren*. Zie *Ondertekening (code signing)*.
- De app start direct op, zonder server en zonder internet. Je administratie staat in
  `%APPDATA%\Helder` en blijft ook na verwijderen bewaard (`deleteAppDataOnUninstall: false`).
- Het programma zelf is [electron/main.cjs](electron/main.cjs): het serveert de gebouwde bestanden
  via een eigen `app://`-adres, opent externe links (betaalpagina's, e-mail) in je browser en heeft
  een menu met *Map met gegevens openen*, zoomen en *Ontwikkelaarstools*.
- Zonder installer draaien kan ook: `npm run desktop`.
- Kom je uit de browser- of PWA-versie? Download daar een back-up (Instellingen → *Back-up
  downloaden*) en zet die in de desktop-app terug via *Back-up terugzetten*; het zijn twee aparte
  opslagplaatsen.
- Voor de bouw staat `electronDist` op `node_modules/electron/dist`, zodat electron-builder de
  Electron-distributie niet opnieuw hoeft uit te pakken (dat liep in deze omgeving stuk op een
  rename-fout van Windows).

## Ondertekening (code signing)

Een ondertekende app laat Windows de uitgever zien in plaats van "onbekende uitgever", en
`electron-updater` weigert updates waarvan de uitgeversnaam niet klopt. De hele bouwconfiguratie
staat in [electron-builder.cjs](electron-builder.cjs); ondertekening schakel je met
omgevingsvariabelen in, zodat een build zonder certificaat gewoon blijft werken.

**Eerlijk vooraf:** ondertekening haalt de SmartScreen-waarschuwing er niet meteen af. Microsoft
bouwt reputatie op uit de uitgever **én** de downloadgeschiedenis van dat specifieke bestand; in
de praktijk kan dat weken en honderden schone installaties van een breed publiek kosten. Een
EV-certificaat geeft tegenwoordig **geen** directe reputatie meer, dus EV alleen om SmartScreen te
omzeilen is weggegooid geld. ([Microsoft over SmartScreen-reputatie](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation))

Drie routes (prijzen peildatum oktober 2026, controleer ze voor aankoop):

1. **Azure Artifact Signing** (voorheen Trusted Signing) — cloudondertekening, geen token of
   HSM-beheer. Basic **$9,99/maand** (5.000 handtekeningen), Premium $99,99/maand; een betaalde
   Azure-subscriptie is verplicht ([prijzen](https://azure.microsoft.com/en-us/pricing/details/artifact-signing/)).
   Public Trust vraagt organisatievalidatie met bedrijfsgegevens en een identiteitscheck van de
   vertegenwoordiger (1–20 werkdagen); voor een Nederlandse eenmanszaak moet je vooraf laten
   bevestigen dat je KvK- en fiscale gegevens geaccepteerd worden.
2. **OV-certificaat** bij een CA, bijvoorbeeld Certum via een reseller (rond €177/jaar excl. btw),
   SSL.com ($129/jaar + token) of GlobalSign/Sectigo/DigiCert (hoger). Sinds 1 juni 2023 moet de
   privésleutel op een token of HSM staan (FIPS 140-2 Level 2 of vergelijkbaar), en certificaten
   zijn nog maar ±459 dagen geldig — je vernieuwt dus jaarlijks.
3. **EV-certificaat** — alleen zinvol als je het al hebt of om andere redenen; geen
   SmartScreen-voordeel meer.

### Gekozen gratis route: AGPL-3.0 + SignPath Foundation

Er bestaat **geen gratis publiek vertrouwd Authenticode-certificaat** voor een gesloten app die
je zelf als EXE verspreidt: sinds 1 juni 2023 moet de privésleutel op een token of HSM staan, en
Microsoft vertrouwt alleen uitgevers die een CA heeft gevalideerd. De twee routes die nul euro
kosten vragen iets anders van je — Helder gaat voor de eerste:

1. **Open source onder AGPL-3.0, ondertekend door SignPath Foundation.** SignPath ondertekent
   open-sourceprojecten gratis met een sleutel in hun HSM; de handtekening staat op naam van
   *SignPath Foundation*. Voorwaarden: één OSI-goedgekeurde licentie voor alle componenten
   (geen dual licensing, geen proprietary delen), een publieke repository met verifieerbare
   builds, actief onderhoud, MFA en handmatige goedkeuring per release
   ([SignPath Foundation](https://signpath.org/), [voorwaarden](https://signpath.org/terms.html)).
2. **Als MSIX via de Microsoft Store publiceren** — gratis account en Microsoft ondertekent na
   review, maar de Store doet dan de updates (dus zonder `electron-updater`), de app krijgt
   MSIX-bestandsvirtualisatie en moet door de Store-review. Niet gekozen.

Wat er in deze repo al voor klaarstaat:

- [LICENSE](LICENSE) (AGPL-3.0) en `"license": "AGPL-3.0-only"` in [package.json](package.json);
  de licentietekst wordt meegeleverd in de installatiemap en is via **Help → Licentie** te openen.
- [docs/code-signing-policy.md](docs/code-signing-policy.md) — het ondertekeningsbeleid dat
  SignPath van deelnemers vraagt (wat wordt ondertekend, hoe builds geverifieerd worden,
  wie goedkeurt).
- [.github/workflows/release.yml](.github/workflows/release.yml) — bouwt op een tag, laat de
  app-bestanden ondertekenen, bouwt de installer bovenop die ondertekende bestanden, laat de
  installer ondertekenen, werkt `latest.yml` bij en publiceert de release. Zonder SignPath-secrets
  bouwt de workflow ongetekend door, zodat de pijplijn testbaar blijft.
- [scripts/latest-yml.mjs](scripts/latest-yml.mjs) — maakt `latest.yml` opnieuw ná het
  ondertekenen (de sha512 verandert dan) en controleert met `--check` of hij klopt.

Wat alleen jij kunt doen: de repository **openbaar** maken op GitHub, een SignPath-account
aanvragen met dit project en beleid, de twee secrets (`SIGNPATH_API_TOKEN`,
`SIGNPATH_ORGANIZATION_ID`) zetten, en per release de ondertekeningsaanvraag goedkeuren.

**Let op bij het testen:** `HELDER_SIGN_PUBLISHER` zet de uitgever in `app-update.yml`, en
`electron-updater` weigert dan updates waarvan de handtekening niet van die uitgever is. Zet die
variabele dus alleen in de echte ondertekeningspijplijn — bouw je lokaal ongetekend verder, laat
hem dan weg, anders kan de app zijn eigen updates niet meer installeren.

Ongetekend blijven kan ook en kost niets. Windows toont dan bij een nieuwe versie opnieuw
"Windows heeft uw pc beschermd" (SmartScreen-reputatie hangt ook aan de hash van het bestand,
zodat elke release weer vanaf nul begint), en op pc's met Smart App Control wordt de installer
mogelijk helemaal geblokkeerd. Een **self-signed** certificaat helpt daar niet: Windows vertrouwt
het niet, dus SmartScreen gedraagt zich als bij een ongetekend bestand.

### Azure Artifact Signing in stappen

Alleen jij kunt dit doen: er hangt een betaalde Azure-subscriptie, een KvK-validatie en een
identiteitscheck aan. Zodra de stappen hieronder klaar zijn, ondertekent `npm run installer`
zichzelf.

1. **Voorbereiden** (Azure CLI, ingelogd op de juiste tenant):
   ```bash
   az login
   az account set -s <subscription-id>
   az provider register --namespace "Microsoft.CodeSigning"
   az extension add --name artifact-signing
   ```
2. **Account aanmaken** in een EU-regio (West Europe of North Europe):
   ```bash
   az group create -n helder-signing -l westeurope
   az artifact-signing create -n heldersigning -l westeurope -g helder-signing --sku Basic
   ```
3. **Identiteit valideren** — dat kan alleen in de portal: geef jezelf de rol *Artifact Signing
   Identity Verifier*, ga naar *Identity validations* → **Organization** → **Public**, en vul de
   juridische naam, website, een e-mailadres op je eigen domein, je KvK-nummer, adres en de naam
   van de vertegenwoordiger in. Daarna volgt een identiteitscheck van die persoon. Reken op
   1–20 werkdagen; bij een bedrijf dat korter dan drie jaar bestaat kan Microsoft om extra
   fiscale gegevens vragen — vraag dat vooraf na bij support.
   Public Trust is beschikbaar voor organisaties in de EU, dus een Nederlandse BV of
   eenmanszaak met KvK-inschrijving valt binnen de doelgroep.
4. **Certificaatprofiel** aanmaken met het id van de geslaagde validatie:
   ```bash
   az artifact-signing certificate-profile create -g helder-signing \
     --account-name heldersigning -n helder-public-trust \
     --profile-type PublicTrust --identity-validation-id <validatie-id>
   ```
5. **Service principal voor de bouw**, met alleen de rol die mag ondertekenen:
   ```bash
   az ad sp create-for-rbac --name helder-signing-ci --skip-assignment
   az role assignment create --assignee <appId> \
     --role "Artifact Signing Certificate Profile Signer" \
     --scope <resource-id-van-het-signing-account>
   ```
6. **Bouwen** met de eerder genoemde variabelen (`HELDER_SIGN=azure`,
   `HELDER_SIGN_PUBLISHER`, `HELDER_SIGN_AZURE_ACCOUNT`, `HELDER_SIGN_AZURE_PROFILE`,
   `HELDER_SIGN_AZURE_ENDPOINT`, `AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`). De
   eerste ondertekende build installeert eenmalig de PowerShell-module `TrustedSigning` en heeft
   dus internet nodig. De certificaten van Artifact Signing zijn kort geldig en worden automatisch
   vernieuwd; de **uitgeversnaam** blijft gelijk, zodat bestaande installaties updates blijven
   accepteren.
7. **Controleren** met `npm run sign:check`: status *Valid*, de juiste uitgever en een tijdstempel.

Aanzetten:

```bash
# Azure (cloudondertekening)
HELDER_SIGN=azure \
HELDER_SIGN_PUBLISHER="Helder B.V." \
HELDER_SIGN_AZURE_ACCOUNT="helder-signing" \
HELDER_SIGN_AZURE_PROFILE="helder-public-trust" \
HELDER_SIGN_AZURE_ENDPOINT="https://neu.codesigning.azure.net/" \
AZURE_TENANT_ID=… AZURE_CLIENT_ID=… AZURE_CLIENT_SECRET=… \
npm run installer

# PFX-bestand
CSC_LINK=/pad/helder.pfx CSC_KEY_PASSWORD=… npm run installer
```

- `HELDER_SIGN_PUBLISHER` moet **exact** de naam op het certificaat zijn; die naam komt in
  `app-update.yml` en wordt bij elke update gecontroleerd. Wijzigt je certificaatnaam, dan weigeren
  bestaande installaties de update — houd de uitgeversnaam dus stabiel.
- `HELDER_SIGN_REQUIRED=1` laat de bouw **falen** zolang er niets ondertekend is; gebruik dat in je
  release-pijplijn zodat je nooit per ongeluk een ongetekende update publiceert.
- `HELDER_SIGN=azure` zonder de benodigde variabelen stopt de bouw met een duidelijke melding in
  plaats van stil een ongetekende installer op te leveren.
- Controleer het resultaat met **`npm run sign:check`** (of `--strict` om te falen bij een
  ongetekend bestand): dat leest met `Get-AuthenticodeSignature` de status, uitgever en
  tijdstempel van de installer en `Helder.exe`.
- Voor een token of cloud-HSM met eigen software (bijvoorbeeld Certum SimplySign) hoort een eigen
  `sign`-hook in [electron-builder.cjs](electron-builder.cjs); de sleutel verlaat dan nooit de HSM.

## Automatische updates (desktop-app)

De geïnstalleerde app werkt zichzelf bij — je hoeft nooit meer een nieuwe installer te downloaden.

- Bij het starten (8 seconden na het openen) kijkt Helder op het updatekanaal of er een nieuwere
  versie is, en daarna elke zes uur opnieuw. Een gevonden update wordt **op de achtergrond
  gedownload**; bij het afsluiten installeert hij zichzelf en start de nieuwe versie. Je
  administratie in `%APPDATA%\Helder` blijft daarbij staan.
- In *Instellingen → Updates* zie je de stand (bijgewerkt, downloaden met percentage, klaar),
  kun je zelf controleren en een klaarstaande update meteen installeren en herstarten. Hetzelfde
  kan via het menu **Help → Controleren op updates**.
- **Wat er verandert** staat in de update-kaart: zodra er een nieuwe versie is, zie je de
  release-opmerkingen (met uitgiftedatum) nog voordat je installeert. Via **Versiegeschiedenis**
  open je het volledige overzicht van alle versies; je huidige versie is gemarkeerd als *In gebruik*.
- De opmerkingen komen uit [CHANGELOG.md](CHANGELOG.md). De bouw leest de sectie van de huidige
  versie en zet die als `releaseNotes` in `latest.yml` ([scripts/release-notes.cjs](scripts/release-notes.cjs));
  de app leest hetzelfde bestand voor het versieoverzicht ([src/changelog.ts](src/changelog.ts)).
  Een nieuwe versie uitbrengen betekent dus: **eerst de versie ophogen, dan de sectie in
  CHANGELOG.md schrijven**, en pas daarna bouwen — een versie zonder sectie komt zonder
  opmerkingen in het kanaal.
- De logica zit in [electron/updater.cjs](electron/updater.cjs); de app praat er via een smalle
  brug mee ([electron/preload.cjs](electron/preload.cjs) → [src/desktop.ts](src/desktop.ts)).
- Alleen de **geïnstalleerde** app kan bijwerken: `npm run desktop` meldt in Instellingen eerlijk
  "bijwerken kan alleen in de geïnstalleerde app".

**Kanaal instellen.** `npm run installer` schrijft naast de installer een `latest.yml` met versie en
sha512. Beide horen op één plek te staan die de app kan bereiken; dat adres staat in
`publish` in [electron-builder.cjs](electron-builder.cjs) — nu een placeholder
(`https://updates.helder.example/win`), dus vervang die door je eigen host (of door een GitHub-
release: `{ "provider": "github", "owner": "…", "repo": "…" }`). Publiceren gaat met
`npx electron-builder --win nsis --x64 --publish always`, of met de hand: zet
`Helder-Setup-<versie>.exe`, `latest.yml` en het `.blockmap`-bestand op die URL.

**Nieuwe versie uitbrengen** is dan: versie in [package.json](package.json) ophogen,
`npm run installer`, artifacts uploaden. Oudere installaties pikken hem vanzelf op.

**Lokaal testen zonder host**: start een statische server in `release/` en geef de app een ander
kanaal mee. `HELDER_UPDATE_URL=http://127.0.0.1:8931` wijst de updater naar die server en
`HELDER_UPDATE_TEST=install` installeert een gedownloade update direct (handig in een test).
`HELDER_UPDATE_LOG=<pad>` schrijft elke stap naar een logbestand.

## Als app op je computer (browser en PWA)

Helder is ook te installeren als web-app, zonder installer en zonder server:

- Bouw en serveer de app (`npm run build` en daarna `npm run preview`, standaard op
  http://localhost:4173). Open die pagina in Chrome of Edge en kies **App installeren** (of ga in
  Helder naar Instellingen → *Helder als app* → **Installeer Helder als app**). Je krijgt een eigen venster zonder browserbalk, een
  pictogram in het startmenu en een snelkoppeling op het bureaublad. Op een telefoon of tablet
  staat Helder tussen je apps (Safari: Deel → Zet op beginscherm).
- De app werkt **zonder internet**: bij de eerste keer openen wordt de hele app in de cache gezet
  (service worker). Lukt het laden zonder verbinding niet, dan zegt Instellingen eerlijk
  "nog niet gereed — open Helder één keer online".
- Updates gaan vanzelf: bij het starten haalt de app een nieuwe versie op en activeert die direct.
  (In de Windows-app werkt dat via het updatekanaal, zie *Automatische updates* hierboven.)
- De gegevens blijven lokaal in de app staan (localStorage), precies zoals in de browser. Er is
  geen server, dus blijf back-ups maken via *Je gegevens* → **Back-up downloaden**.
- Bovenaan verschijnt een **Offline**-chip zodra je geen verbinding hebt; Helder blijft dan
  gewoon werken.
- De app-iconen komen uit `scripts/make-icons.mjs` (opnieuw genereren: `node scripts/make-icons.mjs`).

## Licentie

Helder is vrije software onder de **GNU Affero General Public License v3.0** ([LICENSE](LICENSE)).
Kort gezegd:

- Je mag Helder gebruiken, bestuderen, aanpassen en verspreiden, ook commercieel.
- Verspreid je een aangepaste versie, dan moet de broncode daarvan onder dezelfde licentie
  openbaar zijn, inclusief de wijzigingen.
- Bied je een aangepaste versie als netwerkdienst aan, dan geldt dezelfde plicht voor gebruikers
  van die dienst.
- Er is geen garantie: de software wordt geleverd "as is".

De volledige tekst gaat mee met de installer (`resources/LICENSE`) en is in de app te openen via
**Help → Licentie (AGPL-3.0)**.

Elk bronbestand begint met een korte header met de SPDX-regel `AGPL-3.0-only`:

```bash
npm run license:add     # header toevoegen waar hij ontbreekt (idempotent)
npm run license:check   # faalt als een bronbestand de header mist (handig in CI)
```

## Bijdragen

- Bijdragen vallen onder dezelfde AGPL-3.0-licentie; door een pull request in te dienen ga je
  daarmee akkoord.
- Draai vóór een pull request `npm run typecheck`, `npm run build` en `npm run license:check`.
- Nieuwe versies: hoog de versie op, schrijf de sectie in [CHANGELOG.md](CHANGELOG.md) en tag
  `v<versie>`; de release-workflow doet de rest (zie *Ondertekening*).
- Het ondertekeningsbeleid staat in [docs/code-signing-policy.md](docs/code-signing-policy.md).

## Bewust nog niet gebouwd

Deze demo is een productprototype, geen productie-administratie:

- geen accounts, authenticatie of server-side opslag;
- geen live bankkoppeling (PSD2) en geen eigen betaalintegratie: iDEAL loopt via een hosted
  betaallink van je provider, die Helder niet kan uitlezen; bankimport gaat via CSV;
- geen e-mailverzending of e-factureren (Peppol/UBL): facturen en aanmaningen print je of sla je
  op als PDF;
- geen automatische verzending: Helder zet aanmaningen alleen klaar, jij verstuurt ze;
- geen BTW-plicht-hulp, KOR, verlegde btw, ICP of fiscale aangifte bij de Belastingdienst;
- geen jaarrekening, grootboek met dubbel boekhouden of samenwerking met een accountant;
- geen AVG/ISO-certificering en geen fiscaal advies.

## Logische volgende stappen

1. Backend met accounts en een database (per gebruiker geïsoleerd).
2. Echte factuur-PDF's en e-mailverzending van facturen en aanmaningen.
3. CAMT/MT940-import en automatisch afletteren op factuurnummer of klantnaam.
4. ICP/verlegde btw/KOR en een grootboek met journaalposten.
5. Accountant-uitnodiging en deelbare rapportages.
