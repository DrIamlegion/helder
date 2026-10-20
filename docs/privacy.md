# Privacybeleid

Helder is een lokale boekhoudapp: je administratie staat op je eigen computer en gaat niet naar
een server van Helder. Dit beleid beschrijft precies welke gegevens waar terechtkomen, zodat je
het kunt controleren. Het geldt voor de Windows-app, de browser-versie en de installeerbare
web-app (PWA).

## Wie is verantwoordelijk

Helder wordt onderhouden door de maintainer van deze repository,
[@DrIamlegion](https://github.com/DrIamlegion). Vragen of een verzoek over je gegevens kun je
via een issue in deze repository stellen. Er is geen bedrijf achter Helder dat gegevens
verzamelt of doorverkoopt.

## Welke gegevens Helder opslaat

Alles wat je invoert — bedrijfsgegevens, klanten, facturen, offertes, producten, uitgaven,
bankmutaties, btw-aangiften, betaalregelingen en je instellingen — wordt **lokaal** bewaard:

- **Desktop-app:** in `%APPDATA%\Helder` op je eigen pc, in het bestand dat de app bij elke
  wijziging bijwerkt.
- **Browser en PWA:** in de `localStorage` van je browser, voor dat adres.

Daarnaast schrijft de desktop-app:

- **`back-ups\`** in dezelfde map: bij het starten en daarna hooguit elk uur een leesbare
  JSON-kopie van je administratie. De nieuwste veertien dagen en de nieuwste kopie van elke
  maand blijven staan. Je kunt die map openen en de bestanden verwijderen via *Instellingen →
  Je gegevens*.
- **`fouten.log`** (maximaal 1 MB, daarna `fouten.log.oud`): tijdstip, versie van Helder en van
  Electron, je platform en de fout met zijn stapel. Je administratie staat er **niet** in. Het
  bestand blijft lokaal; Helder verstuurt het niet, ook niet als je een fout meldt — dat doe je
  zelf, met de knop *Kopiëren voor een foutmelding*.

Er is geen account, geen aanmelding en geen wachtwoord. Er is geen database aan de andere kant.

## Wat Helder níet doet

- Geen telemetrie, geen analytics, geen crashrapportage naar een server, geen advertenties en
  geen tracking-pixels.
- Geen cookies in de desktop-app; de app laadt alleen zijn eigen bestanden via een eigen
  `app://`-adres.
- Geen e-mailverzending: facturen en aanmaningen print of bewaar je zelf.
- Geen bankkoppeling: je importeert een CSV-bestand dat je zelf bij je bank downloadt.
- Geen upload van je administratie, ook niet bij een back-up — die schrijft alleen lokaal.

## Netwerkverkeer dat wél plaatsvindt

Twee dingen verlaten je computer, en alleen deze:

1. **De updatecontrole.** De geïnstalleerde app vraagt bij het starten (acht seconden na het
   openen) en daarna elke zes uur bij de releases van deze repository op GitHub of er een nieuwe
   versie is, en downloadt die op de achtergrond. Dat verzoek gaat naar `github.com`; GitHub
   (Microsoft) ziet daarbij je IP-adres, het tijdstip en de gebruikelijke HTTP-headers van
   `electron-updater`, waaronder de versie van Helder. Er gaat **geen** administratie mee. De
   controle staat in *Instellingen → Updates*; de app werkt ook zonder internet, alleen zonder
   automatische updates.
2. **Links die je zelf opent.** Een betaallink, een e-mailadres of een andere externe link gaat
   naar je eigen browser (`shell.openExternal`). Wat daar gebeurt, valt onder het privacybeleid
   van die site — bijvoorbeeld je bank of je betaalprovider. Helder leest die pagina niet uit en
   krijgt geen betaalstatus terug.

Verder maakt de app geen verbinding. De PWA-versie haalt bij het eerste bezoek zijn eigen
bestanden op bij de server waar hij gehost staat; die ziet daarbij je IP-adres, net als elke
website.

## Bewaartermijn en verwijderen

Je gegevens blijven staan tot je ze zelf weghaalt:

- **Alles wissen:** *Instellingen → Je gegevens → Administratie wissen*.
- **Back-ups:** verwijder de bestanden in `%APPDATA%\Helder\back-ups`, of de hele map.
- **Browser/PWA:** wis de sitegegevens van dat adres in je browser.

Er is geen kopie elders, dus verwijderen is echt verwijderen. Maak vooraf een back-up als je
iets wilt bewaren.

## Exporteren

Je bent niet afhankelijk van Helder om bij je gegevens te komen: *Instellingen → Back-up
downloaden* geeft één JSON-bestand met alles, en facturen, uitgaven en rapporten zijn als CSV te
exporteren. De automatische back-ups zijn leesbare JSON.

## Wijzigingen

Dit beleid hoort bij de broncode en verandert dus mee met de app; de geschiedenis staat in de
git-historie van dit bestand. Wijzigingen die gevolgen hebben voor wat er de deur uit gaat,
komen in [CHANGELOG.md](../CHANGELOG.md) te staan.

## Licentie

Dit beleid is van toepassing op Helder, vrije software onder de
[GNU GPL-3.0](../LICENSE). De app gebruikt één externe bibliotheek voor QR-codes
([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT), die volledig
lokaal rekent en geen verbinding maakt.
