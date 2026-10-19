# De inrichting in SignPath

De aanvraag is verstuurd en de configuraties staan in de repository. Wat hieronder staat is het
werk in het SignPath-portaal zodra het account er is: een half uur, en daarna kan de eerste
ondertekende release eruit.

De twee configuraties staan klaar als XML:

- [`docs/signpath/artifact-configurations/helder-app.xml`](signpath/artifact-configurations/helder-app.xml)
  — ondertekent `Helder.exe` uit de app-map.
- [`docs/signpath/artifact-configurations/helder-installer.xml`](signpath/artifact-configurations/helder-installer.xml)
  — ondertekent `Helder-Setup-<versie>.exe`.

Wat er in de workflow al op staat: project `helder`, signing policy `release-signing` en de twee
slugs hierboven. Wijkt een slug in het portaal af, dan faalt de eerste release op een onbekende
configuratie — houd ze dus precies zo.

## Stap voor stap

1. **Project aanmaken**: naam `Helder`, slug `helder`, met de repository-URL
   `https://github.com/DrIamlegion/helder`. Voeg GitHub toe als *trusted build system*
   (GitHub.com) en koppel het aan het project; zonder dat weigert SignPath een aanvraag uit deze
   workflow.
2. **Signing policy** `release-signing` met het certificaat van de Foundation. Zet de
   goedkeuring op handmatig: de voorwaarden van de Foundation vragen dat elke release door een
   mens wordt goedgekeurd voordat er ondertekend wordt.
3. **Artifact configurations** toevoegen onder het project (knop *Add* → zelf XML opgeven) en de
   inhoud van de twee bestanden plakken. Gebruik de slugs `helder-app` en `helder-installer`.
   Het portaal kan ook zelf een configuratie uit een proefartefact genereren; dat mag, maar houd
   dan dezelfde afspraken aan: één ondertekend bestand per configuratie, en de
   metadata-restricties hieronder.
4. **Secrets zetten** onder *Settings → Secrets and variables → Actions*:
   `SIGNPATH_API_TOKEN` (een gebruiker met submitter-recht op het project) en
   `SIGNPATH_ORGANIZATION_ID` (het nummer van de organisatie, te vinden in het portaal). Zonder
   die twee bouwt de workflow ongetekend door en staat er een waarschuwing in de samenvatting.
5. **Een nieuwe tag pushen.** De workflow zet de versie uit `package.json` in `VERSIE` en geeft
   die als parameter `version` mee aan beide ondertekeningsaanvragen. Ondertekenen verandert de
   bytes, dus daarna wordt `latest.yml` opnieuw gemaakt en controleert
   `scripts/verify-signature.mjs --strict` de handtekening.

## Waarom de restricties erin staan

De voorwaarden van de Foundation eisen dat een ondertekende binary zijn metadata vastlegt:

> All signed binaries must have metadata attributes set and enforced using file metadata
> restrictions. Set all product name attributes to your project's name. Set all product version
> attributes to the same value in each build.
>
> — [signpath.org/terms.html](https://signpath.org/terms.html), *SignPath configuration requirements*

Daarom staat in beide configuraties `product-name="Helder"`, `company-name="Helder"`,
`product-version="${version}…"` en `file-version="${version}"`. Die waarden zijn geen aanname: ze
zijn afgelezen van echte builds. Electron-builder zet in de app-exe een vierdelige productversie
(`0.1.10.0` bij versie `0.1.10`) en een driedelige fileversie, en in de installer allebei
driedelig. Controleer dat bij twijfel zo:

```powershell
(Get-Item release\win-unpacked\Helder.exe).VersionInfo |
  Select-Object ProductName, ProductVersion, FileVersion, CompanyName
(Get-Item release\Helder-Setup-*.exe).VersionInfo |
  Select-Object ProductName, ProductVersion, FileVersion, CompanyName
```

Klopt een waarde niet, dan weigert SignPath het artefact met een metadata-mismatch. Dat is de
bedoeling: de release stopt dan in plaats van iets te ondertekenen dat niet bij het project hoort.
Verandert electron-builder ooit zijn versienummering, pas dan de configuratie én
`scripts/test-signpath-configuraties.mjs` samen aan.

## Wat de test bewaakt

`npm run test:signpath-configuraties` leest de XML met een echte parser en controleert:

- het root-element en de namespace die SignPath verwacht, met daaronder precies één `<zip-file>`
  (want `actions/upload-artifact` verpakt de upload zelf);
- precies één ondertekeningsopdracht, op ons eigen bestand — de Foundation staat niet toe dat
  binaries van upstream met dit certificaat ondertekend worden;
- de metadata-restricties, met de parameter `version` in plaats van een hardcoded nummer;
- dat de workflow die parameter ook echt meegeeft;
- dat het pad van de installer past op de naam die `electron-builder.cjs` maakt, en niet op de
  blockmap.

Samen met `npm run test:signpath` (de opbouw van de workflow) en `npm run test:documentatie` (de
eisen die de Foundation aan de documentatie stelt) staat de inrichting dus vast vóór er een
account is.
