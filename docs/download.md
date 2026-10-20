# Download Helder

Helder is een boekhoudapp voor zzp en mkb: facturen, offertes, terugkerende facturen,
klanten, uitgaven, bankafschriften, aanmaningen en de btw-aangifte in één programma. Je
administratie staat op je eigen computer — er is geen account, geen server en geen abonnement.

**[Download de nieuwste versie](https://github.com/DrIamlegion/helder/releases/latest)** —
`Helder-Setup-<versie>.exe` op de releasepagina. Eerdere versies staan onder
[Releases](https://github.com/DrIamlegion/helder/releases), met per versie de wijzigingen uit
[CHANGELOG.md](../CHANGELOG.md).

## Wat je krijgt

- **Facturen** — nummering, btw-tarieven, betaaltermijn, status, dupliceren, CSV-export en een
  printbare factuur.
- **Offertes** — eigen nummerreeks, geldigheidsduur, status en omzetten naar factuur.
- **Terugkerende facturen** — week, maand, kwartaal of jaar; concepten worden automatisch
  klaargezet.
- **Aanmaningen** — betaalherinnering, aanmaning en laatste aanmaning met incassokosten volgens
  de wettelijke staffel, plus een voorstel voor een betaalregeling in termijnen. Versturen doe je
  zelf.
- **Uitgaven en bank** — bonnen en abonnementen met btw, en CSV-afschriften importeren en aan
  openstaande facturen koppelen.
- **Rapporten en btw** — omzet en kosten per maand, ouderdomsanalyse, btw per kwartaal met de
  rubrieken 1a–5c en CSV-export.
- **Lokale opslag en back-ups** — de desktop-app bewaart je administratie zelf en schrijft
  automatisch een leesbare kopie in `%APPDATA%\Helder\back-ups`; terugzetten kan met één knop.
- **Automatische updates** — een geïnstalleerde app haalt nieuwe versies zelf op en toont vooraf
  wat er verandert.

De app is er ook als installeerbare web-app (PWA). De volledige functielijst staat in de
[README](../README.md#wat-werkt).

## Installeren

1. Download `Helder-Setup-<versie>.exe`.
2. Start het bestand. Windows kan vragen om bevestiging; de installer installeert per gebruiker,
   zonder beheerdersrechten.
3. Bij de eerste start vult een wizard je bedrijfsgegevens in; daarna begin je met een lege
   administratie.
4. Bijwerken gaat daarna vanzelf via *Instellingen → Updates* of **Help → Controleren op updates**.
   Verwijderen kan via *Instellingen → Apps* in Windows, of met de uninstaller in de installatiemap;
   je gegevens in `%APPDATA%\Helder` blijven daarbij staan tot je ze zelf weghaalt.

**Systeemeisen:** Windows 10 of 11, x64. De download is ongeveer 110 MB, de geïnstalleerde app
neemt ongeveer 400 MB in beslag. Geen internet nodig om te werken; alleen voor updates.

**Over de waarschuwing van Windows.** De installers zijn **niet ondertekend**, waardoor Windows
SmartScreen kan melden dat de uitgever onbekend is. Dat is geen foutmelding: kies *Meer informatie →
Toch uitvoeren*. De gratis ondertekeningsroute via de SignPath Foundation is op 20 oktober 2026
afgewezen omdat het project nog te onbekend was, en een betaald certificaat is er nog niet. Zodra er
wél ondertekend wordt, verdwijnt de melding "onbekende uitgever" (SmartScreen-reputatie wordt daarna
nog apart opgebouwd). Zie [Ondertekening](#code-signing-policy).

## Code signing policy

Er zit **geen handtekening** op deze bestanden: `Get-AuthenticodeSignature` meldt *NotSigned*. Het
beleid dat geldt zodra dat wel zo is — wat er ondertekend wordt, hoe de build geverifieerd wordt en
wie een release goedkeurt — staat in [docs/code-signing-policy.md](code-signing-policy.md). De rollen
en hun leden staan in de [README](../README.md#code-signing-policy).

## Privacy

Helder bewaart je administratie lokaal en verstuurt die niet. De enige verbinding die de app uit
zichzelf maakt is de updatecontrole bij GitHub Releases. Wat er precies waar staat:
[privacybeleid](privacy.md).

## Licentie

Helder is vrije software onder de [GNU GPL-3.0](../LICENSE); de volledige broncode staat in deze
repository. De licentietekst wordt meegeleverd in de installatiemap en is in de app te openen via
**Help → Licentie (GPL-3.0)**.
