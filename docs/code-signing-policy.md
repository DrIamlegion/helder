# Code-signingbeleid

Dit is het ondertekeningsbeleid van Helder, zoals SignPath Foundation dat van deelnemende
open-sourceprojecten vraagt. Het beschrijft wat er wordt ondertekend, hoe vastgesteld wordt dat
een build echt uit deze repository komt, en wie een release goedkeurt.

> Free code signing provided by SignPath.io, certificate by SignPath Foundation.

Die regel staat ook op de homepage en op de downloadpagina van het project —
[README → Code signing policy](../README.md#code-signing-policy) en [download.md](download.md) —
want de Foundation vraagt dat het beleid vanaf beide te vinden is.

## Rollen en hun leden

De Foundation vraagt een teamstructuur met drie rollen. Helder heeft één maintainer, dus alle
drie vallen bij hem samen:

- **Auteurs (committers)**: [@DrIamlegion](https://github.com/DrIamlegion) — schrijft de code en
  beheert de repository.
- **Reviewers**: [@DrIamlegion](https://github.com/DrIamlegion) — elke pull request van iemand
  anders wordt door hem beoordeeld voordat hij in `main` komt. Commits van de maintainer zelf
  gaan door dezelfde CI (licentieheaders, release-opmerkingen, typecheck, build, btw-test in de
  echte app, hashcontrole).
- **Approvers**: [@DrIamlegion](https://github.com/DrIamlegion) — keurt elke ondertekeningsaanvraag
  in het SignPath-portaal goed.

Alle leden gebruiken MFA op GitHub en op SignPath; dat is een voorwaarde om de repository te
kunnen publiceren en om een aanvraag te kunnen indienen.

## Privacy

Wat de app met gegevens doet staat in [privacy.md](privacy.md): alles blijft lokaal, er is geen
telemetrie, en de enige verbinding die de app zelf maakt is de updatecontrole bij GitHub
Releases.

## Uitgever en certificaat

- Helder wordt ondertekend met het certificaat van **SignPath Foundation**. Windows toont die
  naam als uitgever; het is niet de naam van de individuele ontwikkelaar of van een bedrijf.
- De privésleutel staat in de HSM van SignPath en komt nooit op een ontwikkelmachine of in een
  CI-secret terecht.
- Dezelfde uitgeversnaam (`SignPath Foundation`) staat in `app-update.yml`, zodat
  `electron-updater` updates kan verifiëren.

## Wat wordt ondertekend

Per release worden twee dingen ondertekend, in deze volgorde:

1. **`Helder.exe`** uit `release/win-unpacked`. Dat is het enige programma dat wij zelf hebben
   gebouwd; de Electron-bibliotheken, DLL's en hulpprogramma's eromheen komen van upstream en
   worden **niet** met ons certificaat ondertekend (dat mag volgens de voorwaarden ook niet: je
   ondertekent alleen je eigen binaries). Ze mogen wel ongetekend in het pakket mee.
2. **De installer** `Helder-Setup-<versie>.exe`, gebouwd met `--prepackaged` bovenop de al
   ondertekende `Helder.exe`, zodat de installer geen ongetekende kopie van ons programma
   meeneemt.

Hoe het artefact bij SignPath komt:

- De workflow uploadt de bestanden **onverpakt** met `actions/upload-artifact`; die actie maakt
  zelf de zip. Het root-element van beide artifact configurations is daarom `<zip-file>`, met
  daarin de bestanden uit de upload. Van die bestanden krijgt alleen onze eigen `<pe-file>` een
  ondertekeningsopdracht: `Helder.exe` respectievelijk `Helder-Setup-*.exe`.
- Zou de workflow zelf nog een zip maken, dan zit er een zip in een zip en past de configuratie
  niet meer op het artefact. Daarom staat er geen `Compress-Archive` in de workflow.
- Na het ondertekenen pakt de SignPath-actie het ondertekende archief zelf uit
  (`skip-decompress` staat standaard uit). De workflow kopieert die bestanden terug naar
  `release/win-unpacked` respectievelijk `release/` en faalt als `Helder.exe` of de installer
  ontbreekt, in plaats van stilletjes een ongetekende versie te publiceren.

Daarna wordt `latest.yml` opnieuw gegenereerd, omdat ondertekenen de bytes en dus de sha512
verandert (`node scripts/latest-yml.mjs`). De blockmap van electron-builder hoort bij de
óngetekende installer en wordt daarom verwijderd: `latest.yml` verwijst er niet naar (geen
`blockMapSize`), dus er zijn geen differentiële updates en een verouderde blockmap zou alleen
verwarren.

De artifact configurations maak je in SignPath het makkelijkst door een **proefartefact te
uploaden**; SignPath genereert dan de XML. Haal daarna de ondertekeningsopdracht weg bij alle
bestanden die niet van ons zijn (de DLL's en hulpprogramma's van Electron) en laat alleen
`Helder.exe` respectievelijk `Helder-Setup-*.exe` ondertekenen. Gebruik `Helder-Setup-*.exe`
liever dan een versienummer in het pad: anders moet de configuratie bij elke release mee
veranderen.

## Hoe een build wordt geverifieerd

- Releases komen uitsluitend uit de GitHub Actions-workflow
  [`.github/workflows/release.yml`](../.github/workflows/release.yml), getriggerd door een tag
  `v<versie>` die gelijk moet zijn aan de versie in `package.json`.
- Alle stappen tot en met de ondertekeningsaanvraag draaien op **door GitHub gehoste runners**
  (eis van SignPath voor open source); er is geen zelf-gehoste runner.
- SignPath controleert zelf dat het artefact als GitHub-workflowartefact is geüpload en dat de
  build door GitHub is uitgevoerd; de metadata kan niet door het buildscript verzonnen worden.
- Er wordt niet ondertekend vanaf een laptop, en niet uit een fork.

## Goedkeuring

- Elke ondertekeningsaanvraag wordt **handmatig goedgekeurd** door de maintainer van Helder
  (account met MFA) in het SignPath-portaal.
- Er wordt pas goedgekeurd als de wijzigingen in `main` staan, de tag bij de versie hoort en de
  `CHANGELOG.md`-sectie voor die versie bestaat.
- Bij twijfel wordt de aanvraag afgewezen en de tag verwijderd; er komt dan een nieuwe tag met
  een hogere versie.

## Controleren door gebruikers

```powershell
Get-AuthenticodeSignature .\Helder-Setup-0.1.7.exe | Format-List Status, SignerCertificate
```

Of in Verkenner: rechtsklik het bestand → *Eigenschappen* → tab *Digitale handtekeningen*.
Een geldige handtekening toont **SignPath Foundation** als ondertekenaar en een tijdstempel.

## Licentie en broncode

Helder is vrije software onder de [GNU AGPL-3.0](../LICENSE). De volledige broncode van elke
uitgebrachte versie staat in deze repository, zodat de binaries controleerbaar uit de bron
voortkomen — een voorwaarde om voor deze gratis ondertekeningsroute in aanmerking te komen.

## Contact

Vragen of een vermoeden van misbruik: open een issue in deze repository of mail de maintainer
via het adres dat in het GitHub-profiel staat.
