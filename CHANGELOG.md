# Wat is er nieuw

Wat er per versie verandert, nieuwste bovenaan. Dit bestand is de bron: de bouw zet de
notities van de huidige versie in `latest.yml`, en de app toont ze in de update-kaart
voordat je een update installeert.

## 0.1.12 — 20 oktober 2026

- Helder staat nu onder de **GPL-3.0** in plaats van de AGPL-3.0. Wat je mag blijft hetzelfde:
  gebruiken, bestuderen, aanpassen en verspreiden, ook commercieel, en de broncode van een
  aangepaste versie blijft openbaar. Wat vervalt is de netwerkclausule: zet je een aangepaste
  versie als dienst online, dan hoef je die broncode niet te publiceren.
- Versies tot en met 0.1.11 blijven onder de AGPL-3.0 vallen; die licentie kun je achteraf niet
  veranderen. De licentietekst in de installatiemap en onder **Help → Licentie** is de GPL-3.0,
  en elk bronbestand draagt die SPDX-regel.

## 0.1.11 — 19 oktober 2026

- Aan de app zelf verandert niets: deze uitgave test de vernieuwde release-pijplijn, waarin de
  ondertekeningsstappen van SignPath gerepareerd zijn.
- Updates werken zoals voorheen. De app haalt nog steeds de volledige installer op; alleen de
  bestanden op de releasepagina zijn anders, want de blockmap van de installer gaat niet meer mee.

## 0.1.10 — 18 oktober 2026

- De desktop-app bewaart je administratie nu zelf: bij het starten en daarna hooguit elk uur
  een leesbare kopie in de map `back-ups` in je gegevensmap. De nieuwste veertien dagen blijven
  staan, plus de nieuwste van elke maand — samen ruim een jaar geschiedenis.
- In Instellingen → Je gegevens zie je wanneer de laatste automatische back-up is gemaakt, en
  open je de map met één knop. Een kopie terugzetten gaat met **Back-up terugzetten**.

## 0.1.9 — 18 oktober 2026

- Helder haalt updates nu op uit de eigen releases van het project, in plaats van een adres
  waar nooit iets stond. Een geïnstalleerde app ziet daardoor weer nieuwe versies, en de
  update-kaart laat ze zien voordat je installeert.
- Gebruik je nog 0.1.8 of ouder? Installeer deze versie één keer met de hand; daarna werkt
  bijwerken vanzelf.

## 0.1.8 — 18 oktober 2026

- De update-kaart en de versiegeschiedenis tonen elk punt nu volledig. Liep een punt over
  twee of drie regels, dan stopte de app na de eerste regel midden in de zin; de rest van
  het punt blijft nu staan.
- De notities die met een update meekomen worden bij het bouwen uit dit bestand gehaald, en
  een controle vóór het inpakken voorkomt dat er weer een half punt in `latest.yml` belandt.

## 0.1.7 — 18 oktober 2026

- Een eigen logo op je facturen, offertes en aanmaningsbrieven: kies het in Instellingen →
  Bedrijfsgegevens, en het staat daarna linksboven op elk document.
- Dat logo staat nu ook boven de publieke betaalregeling die je klant via de deellink opent, en
  op de bevestiging die hij daarvan print. De link krijgt alleen een compacte thumbnail mee,
  zodat hij in mail en chat behapbaar blijft.
- De laatste aanmaning toont de deellink als QR-code, zodat de lange URL niet meer voluit op
  papier hoeft. De klant scant hem met zijn telefoon en geeft online akkoord.
- Printen en PDF maken houden nu ook marge als een printer of printdialoog de paginamarge
  negeert. De vaste regel “Pagina 1 / 1” is weg.
- De laatste aanmaning past standaard op één A4: het betaalschema en de QR staan naast elkaar,
  de adressen ook, en de handtekening staat naast de totalen.
- De gewone aanmaning en betaalherinnering gebruiken dezelfde compacte printopmaak, zodat de
  drie brieven er hetzelfde uitzien.
- In de desktop-app sla je de laatste aanmaning direct als PDF op met de vaste A4-opmaak. De
  knop **PDF opslaan** opent alleen de bestandskeuze, niet de printdialoog van het systeem.
- Op de briefpagina bekijk je elke brief vóór het printen als **A4-printvoorbeeld**: Helder zet
  daarvoor tijdelijk de printopmaak op het scherm, met dezelfde marges, leesmaat en paginamaat.
  Sluiten kan met de knop of met Escape.
- Nieuwe knop Versiegeschiedenis in de update-kaart, met per versie wat er is veranderd.
- De app toont overal zijn echte versienummer, in plaats van een vaste waarde.
- Struikelt Helder zelf, dan schrijft de app dat op in `fouten.log` in je gegevensmap. In
  Instellingen → Foutenlogboek lees je het terug en zet je het met één knop op je klembord, klaar
  om bij een foutmelding te plakken.
- Het venster opent op een maat die bij je scherm past, ook op een kleine of hoog geschaalde
  monitor, en de zijbalk scrolt als hij niet in de hoogte past.
- Helder onthoudt de maat en de plek van het venster tussen sessies. Instellingen → Venster toont
  beide en heeft een knop om terug te gaan naar de standaardmaat; dat kan ook met het menu
  Weergave → Venstermaat terugzetten of met Ctrl+Shift+0. Start de app gemaximaliseerd en
  verklein je hem voor het eerst, dan wijst een korte melding je daarop — één keer.

## 0.1.6 — 18 oktober 2026

- De update-kaart laat zien wat er in een nieuwe versie verandert, nog voordat je hem installeert.
- Release-opmerkingen komen uit dit bestand en reizen mee met `latest.yml` naar het updatekanaal.

## 0.1.5 — 18 oktober 2026

- Automatische updates: Helder kijkt bij het starten en daarna elke zes uur of er een nieuwe versie is, haalt die op de achtergrond binnen en installeert hem bij het afsluiten.
- Nieuwe kaart Instellingen → Updates met de stand, het downloadpercentage, Nu controleren en Installeren en herstarten.
- Voorbereiding op het ondertekenen van de installer, zodat Windows de uitgever laat zien.

## 0.1.0 — 17 oktober 2026

- Eerste versie: facturen, offertes, klanten, uitgaven, bankzaken, btw-aangifte, aanmaningen en betaalregelingen.
- Windows-installer en installeerbare web-app (PWA), met alle gegevens lokaal op de computer.
