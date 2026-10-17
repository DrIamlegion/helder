# Code-signingbeleid

Dit is het ondertekeningsbeleid van Helder, zoals SignPath Foundation dat van deelnemende
open-sourceprojecten vraagt. Het beschrijft wat er wordt ondertekend, hoe vastgesteld wordt dat
een build echt uit deze repository komt, en wie een release goedkeurt.

## Uitgever en certificaat

- Helder wordt ondertekend met het certificaat van **SignPath Foundation**. Windows toont die
  naam als uitgever; het is niet de naam van de individuele ontwikkelaar of van een bedrijf.
- De privésleutel staat in de HSM van SignPath en komt nooit op een ontwikkelmachine of in een
  CI-secret terecht.
- Dezelfde uitgeversnaam (`SignPath Foundation`) staat in `app-update.yml`, zodat
  `electron-updater` updates kan verifiëren.

## Wat wordt ondertekend

Per release worden twee dingen ondertekend, in deze volgorde:

1. **De applicatiebestanden** in `release/win-unpacked` (de `Helder.exe` en de bijbehorende
   binaries en DLL's).
2. **De installer** `Helder-Setup-<versie>.exe`, gebouwd met `--prepackaged` bovenop de al
   ondertekende bestanden, zodat de installer geen ongetekende kopieën meeneemt.

Daarna wordt `latest.yml` opnieuw gegenereerd, omdat ondertekenen de bytes en dus de sha512
verandert (`node scripts/latest-yml.mjs`).

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
