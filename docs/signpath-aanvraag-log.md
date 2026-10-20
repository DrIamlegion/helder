# SignPath-aanvraag: wat er verstuurd is

Het invulblad [signpath-aanvraag.md](signpath-aanvraag.md) verandert mee met het project: er komen
releases bij, links worden anders, de reputatietekst groeit. Dit bestand niet: hier staat per poging
wat er op dat moment werkelijk in het formulier stond en wat er op terugkwam, zodat een tweede
aanvraag kan aantonen wat er sinds de vorige is veranderd in plaats van hetzelfde verhaal nog eens te
vertellen.

Twee regels die dit bestand nuttig houden:

- **De tekst hieronder wordt niet bijgewerkt.** Gaat het project verder, dan komt dat in een nieuwe
  poging te staan, niet in de oude. Anders is er niets meer om mee te vergelijken.
- **Geen persoonsgegevens.** Naam en e-mailadres horen in het SignPath-account, niet in een
  openbare repository. Wie de aanvraag deed staat er als GitHub-gebruiker.

## Pogingen

| # | Datum | Versie | Status | Uitkomst |
| --- | --- | --- | --- | --- |
| 1 | 19 oktober 2026 | 0.1.11 | ingediend, bevestigd per e-mail | **afgewezen** op 20 oktober 2026: te weinig publieke bekendheid |

## Poging 1 — 19 oktober 2026

- **Ingediend door:** [@DrIamlegion](https://github.com/DrIamlegion), als *Individual maintainer*.
- **Stand van de repository:** commit `dc2a8c2`, versie 0.1.11, vijf tags (v0.1.7–v0.1.11),
  repository openbaar sinds 18 oktober 2026.
- **Formulier:** HubSpot-formulier `bf62807d-bb72-4e45-9bde-1f3a53ba2472` op
  <https://signpath.org/apply>.
- **Status:** ingediend en bevestigd. Het formulier sloot af met *Form submitted — Thank you,
  we'll be in touch soon.*, en op 19 oktober 2026 kwam de bevestigingsmail: *"We've received your
  application and will review it shortly. Our team will get back to you within the next few
  business days with next steps or any follow-up questions."* De aanvraag is dus aangekomen en in
  behandeling; er is nog geen inhoudelijk antwoord.

### Waarden in de vaste velden

```
Project Name:          Helder
Repository URL:        https://github.com/DrIamlegion/helder
Homepage URL:          https://github.com/DrIamlegion/helder
Download URL:          https://github.com/DrIamlegion/helder/blob/main/docs/download.md
Privacy Policy URL:    https://github.com/DrIamlegion/helder/blob/main/docs/privacy.md
Wikipedia URL:         (leeg)
Category:              Productivity
Maintainer Type:       Individual maintainer(s)
Build System:          GitHub Actions
Company Name:          (leeg)
Discovery channel:     AI / LLM tools
Exact source:          AI assistant (Freebuff), while looking for free code signing for an
                       open-source Windows app
```

### Tagline

```
Local-first bookkeeping for Dutch freelancers and small businesses: invoices, quotes, expenses, bank imports, reminders and VAT returns.
```

### Description

```
Helder is a Windows desktop application for bookkeeping by Dutch freelancers and small businesses. It keeps customers, invoices, quotes, recurring invoices, products, expenses, bank statement imports and the quarterly Dutch VAT return in one place, and it prepares payment reminders and instalment plans that the user sends themselves. All data is stored locally on the user's computer: there is no account, no server and no cloud storage, and a built-in backup writes a readable copy to the user's data folder. Helder is built with Electron, React and TypeScript and is published as an NSIS installer for Windows, with an installable web app (PWA) as a second way to run it.
```

### Reputation

```
Helder is a new project. The repository became public on 18 October 2026 and the first release (v0.1.7) was published the same day; five tagged releases have followed, the latest v0.1.11.

What can be verified today:
- Every release is built and published by GitHub Actions from a tag in this repository, with the installer and latest.yml as release assets: https://github.com/DrIamlegion/helder/releases
- CI runs on every pull request: license headers, release-note extraction, typecheck and build, an end-to-end test that starts the real Electron app and exercises the VAT calculation, packaging, and a hash check that ties the packaged app back to the commit (https://github.com/DrIamlegion/helder/actions).
- The complete source is published under AGPL-3.0, with an SPDX header in every source file and the license shipped inside the installer.
- The application's functionality is documented feature by feature in the README and on the download page.

I want to be straightforward about the limits: there is no press coverage, no community discussion and no meaningful download record yet, and the project has a single maintainer. If verifiable reputation is a hard requirement, I would rather withdraw and apply again once the project has that history than have the Foundation vouch for software that nobody knows yet.
```

## Uitkomst poging 1 — 20 oktober 2026

Op 20 oktober 2026 om 08:10 kwam het antwoord van Phillip Deng (SignPath Foundation) in dezelfde
e-mailthread. De kern, letterlijk:

> After reviewing your submission, we're unable to approve your application at this time.

De reden is niet de kwaliteit van het project maar het ontbreken van signalen van buitenaf:

> The Foundation program is designed for projects that have already established a certain level of
> public trust and visibility, so when evaluating applications we look for external signals such as
> community adoption (GitHub stars, forks, contributors), external articles, independent references
> or discussions (Reddit, Stack Overflow, YouTube, etc.) or institutional backing, and evidence of
> sustained activity and engagement.

> At the moment your project doesn't yet show enough of these signals for us to issue a Foundation
> certificate in our name. This isn't a judgment on the quality or potential of your work, it's
> purely about the level of public visibility the Foundation program requires.

De brief zegt ook dat een nieuwe aanvraag welkom is zodra het project breder bekend is, en wijst op
een betaald abonnement als het sneller moet:

> We'd genuinely encourage you to keep developing the project, and you're very welcome to reapply
> once it has gained broader recognition, we'd be happy to review it again.
>
> If you'd like to move forward sooner, you can also use SignPath through a regular paid
> subscription instead of the Foundation program: <https://docs.signpath.io/change-subscription>

Dat is precies de afweging die in [signpath-aanvraag.md → Verwachting](signpath-aanvraag.md#verwachting)
vooraf is opgeschreven: optie 2 (nu aanvragen) met de wetenschap dat het reputatieveld de zwakke
plek is. De uitkomst bevestigt dat; er is niets misgegaan in het formulier, de velden klopten.

Op deze brief is niet geantwoord. De voorwaarden vragen om geen discussie over de uitkomst
(*"Please don't argue with us"*), en er valt ook niets te betwisten: de cijfers in de aanvraag zijn
eerlijk en de conclusie volgt daaruit.

## Wat dat betekent

De gratis route via de Foundation is voorlopig dicht. Er zijn drie dingen die je kunt doen, in
volgorde van wat het minst kost:

1. **Ongetekend blijven publiceren.** Releases werken, `latest.yml` klopt, de updatecontrole werkt;
   alleen toont Windows bij de eerste start "onbekende uitgever". Dat is de stand van nu, en de
documentatie zegt het ook zo.
2. **Opnieuw aanvragen bij de Foundation** zodra de signalen er zijn. De brief noemt dat expliciet
   als mogelijkheid. Wat er dan bij moet zijn staat hieronder bij *Bij een volgende poging*; de
   cijfers komen uit `npm run signalen`, niet uit een schatting.
3. **Een betaald SignPath-abonnement** als het niet kan wachten. Zelfde product, zelfde
   GitHub-actie, ander certificaat: dat staat op naam van je eigen organisatie in plaats van op die
   van de Foundation. De pijplijn in deze repository werkt daar ongewijzigd mee, maar de uitgever in
   `app-update.yml` moet dan de naam van dát certificaat zijn — vandaar dat de workflow hem uit de
   variabele `HELDER_SIGN_PUBLISHER` leest en niet langer de naam van de Foundation vastzet.

Wat in geen geval gebeurt: de documentatie laten staan alsof er ondertekend wordt. De regel *"Free
code signing provided by SignPath.io, certificate by SignPath Foundation"* hoort bij deelname aan
het Foundation-programma en is daarom uit de README, de downloadpagina, het beleid en de releasevoet
verdwenen. `npm run test:documentatie` laat de CI rood worden als iemand hem terugzet zonder dat er
weer een goedgekeurde aanvraag is.

Stuur geen tweede aanvraag en geen reeks herinneringen, en ga niet in discussie over de uitkomst.
Wat wel helpt is het enige dat de Foundation zelf kan controleren — releases blijven uitbrengen en
`npm run signalen` laten lopen, zodat er cijfers met data liggen als er een tweede poging komt.

## Bij een volgende poging

De eerste poging is afgewezen op het reputatieveld, dus begin niet bij het formulier maar bij deze
tabel: welke signalen zijn er sinds de vorige poging
écht bijgekomen? Alleen wat controleerbaar is telt — een download-teller, sterren, een draadje
waar het project genoemd wordt, een issue of pull request van iemand anders, een vermelding buiten
de repository. Verzin niets bij: de Foundation leest de repository en een overdreven claim is op
zichzelf al een reden om af te wijzen.

De cijfers hoef je niet uit je hoofd te doen: `npm run signalen` haalt ze bij de GitHub-API en
schrijft per dag één meting naar [signpath-signalen.json](signpath-signalen.json) — sterren,
forks, downloads, releases, issues en pull requests van buitenaf, en of er iemand anders dan de
maintainer gecommit heeft. Concept-releases, bots en je eigen werk tellen daar niet in mee; wat er
niet in staat, mag je ook niet beweren.

Schrijf die signalen als nieuwe poging onderaan dit bestand, met datum, versie en commit, en laat
de oude poging staan. De vergelijking tussen de twee is het argument.
