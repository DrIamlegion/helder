# Code-signingbeleid

Dit is het ondertekeningsbeleid van Helder. Het beschrijft wat er ondertekend wordt, hoe vastgesteld
wordt dat een build echt uit deze repository komt, en wie een release goedkeurt. Het geldt zodra er
ondertekend wordt; op dit moment is dat niet het geval.

## Status: nog niet ondertekend

De releases van Helder zijn **niet ondertekend**. Windows noemt de uitgever daarom "onbekend" en kan
bij de eerste start waarschuwen; dat staat ook zo op [download.md](download.md) en in de
[README → Ondertekening](../README.md#ondertekening-code-signing).

De gratis route via de SignPath Foundation is op 20 oktober 2026 afgewezen: de Foundation ondertekent
alleen projecten met aantoonbare publieke bekendheid, en die had dit project op dat moment (twee
dagen oud) niet. Wat er verstuurd is en wat er terugkwam staat in
[signpath-aanvraag-log.md](signpath-aanvraag-log.md). Ondertekening blijft mogelijk met een betaald
SignPath-abonnement of een eigen certificaat; de pijplijn in deze repository staat daar klaar voor.

Zolang er niets ondertekend is, staat er ook geen claim op de homepage, de downloadpagina of de
releasepagina's dat SignPath Foundation dit project ondertekent. `npm run test:documentatie` bewaakt
dat: die regel hoort pas terug te komen als er weer een goedgekeurde aanvraag of een abonnement is.

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
  goed voordat er ondertekend wordt. Bij een betaald SignPath-abonnement is dat in het
  SignPath-portaal, net als bij de Foundation het geval zou zijn.

Alle leden gebruiken MFA op GitHub en op SignPath; dat is een voorwaarde om de repository te
kunnen publiceren en om een aanvraag te kunnen indienen.

## Privacy

Wat de app met gegevens doet staat in [privacy.md](privacy.md): alles blijft lokaal, er is geen
telemetrie, en de enige verbinding die de app zelf maakt is de updatecontrole bij GitHub
Releases.

## Uitgever en certificaat

Er is op dit moment geen uitgever: er wordt niets ondertekend. Zodra dat wel gebeurt, geldt het
volgende.

- De uitgever is de naam op het certificaat waarmee ondertekend wordt: bij een betaald
  SignPath-abonnement de organisatie achter dat abonnement, bij een eigen certificaat de naam
  daarvan. Windows toont die naam; het is niet de naam van de individuele ontwikkelaar.
- De privésleutel blijft in de HSM van de certificaatverlener of op een token, en komt nooit op een
  ontwikkelmachine of in een CI-secret terecht.
- Diezelfde naam staat in `app-update.yml`, zodat `electron-updater` updates kan verifiëren. De
  release-workflow leest hem uit de repository-variabele `HELDER_SIGN_PUBLISHER` en stopt als die
  ontbreekt terwijl er wél een token is: een verkeerde naam daar betekent dat elke volgende update
  wordt afgekeurd.

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

De twee artifact configurations staan als XML in de repository:
[helder-app](signpath/artifact-configurations/helder-app.xml) ondertekent `Helder.exe`,
[helder-installer](signpath/artifact-configurations/helder-installer.xml) ondertekent
`Helder-Setup-*.exe`. In beide staat één ondertekeningsopdracht, op ons eigen bestand, en leggen
ze de metadata vast die SignPath van een ondertekende binary eist (productnaam gelijk aan de
projectnaam, productversie in elke build dezelfde). Het pad van de installer is een patroon, geen
versienummer, zodat de configuratie niet bij elke release mee hoeft te veranderen. Hoe je ze in het
portaal zet, staat in [signpath-inrichting.md](signpath-inrichting.md).

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
Get-AuthenticodeSignature .\Helder-Setup-<versie>.exe | Format-List Status, SignerCertificate
```

Of in Verkenner: rechtsklik het bestand → *Eigenschappen* → tab *Digitale handtekeningen*.

Op dit moment meldt die controle **NotSigned**, en dat klopt: er is geen certificaat. Heeft een
release later wél een handtekening, dan toont dezelfde controle *Valid*, de uitgever van dat
certificaat en een tijdstempel — dezelfde naam die in de release-opmerkingen staat.

## Licentie en broncode

Helder is vrije software onder de [GNU GPL-3.0](../LICENSE). De volledige broncode van elke
uitgebrachte versie staat in deze repository, zodat de binaries controleerbaar uit de bron
voortkomen — en zodat een gebruiker zelf kan bouwen wat hier wordt gepubliceerd.

## Contact

Vragen of een vermoeden van misbruik: open een issue in deze repository of mail de maintainer
via het adres dat in het GitHub-profiel staat.
