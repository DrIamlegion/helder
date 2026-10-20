# De SignPath-aanvraag, veld voor veld

Dit is het invulblad voor <https://signpath.org/apply>. De velden hieronder zijn overgenomen van
het formulier zoals het op 19 oktober 2026 live stond (HubSpot-formulier
`bf62807d-bb72-4e45-9bde-1f3a53ba2472`), inclusief de keuzelijsten. De antwoorden staan in het
Engels omdat het formulier Engels is; de rest van dit document is Nederlands.

**De aanvraag is op 19 oktober 2026 verstuurd en op 20 oktober 2026 afgewezen**; wat er werkelijk in
het formulier stond én wat er terugkwam staat in [signpath-aanvraag-log.md](signpath-aanvraag-log.md).
Dit blad blijft het invulblad voor een volgende poging: de velden zijn ongewijzigd, en de afweging in
[Verwachting](#verwachting) staat er nu met de uitkomst bij.

Wat er bij een eerdere poging werkelijk is verstuurd — en hoe de repository er toen voor stond —
staat in [signpath-aanvraag-log.md](signpath-aanvraag-log.md). Dit blad verandert mee met het
project; dat bestand niet, en juist daarom kun je de twee vergelijken.

## Verwachting

De voorwaarden van de Foundation zeggen letterlijk dat zij *"cannot sign binaries based on source
code that nobody knows"* en dat zij *"a certain verifiable reputation"* eisen
([signpath.org/terms](https://signpath.org/terms.html), *Common misunderstandings*). Daar staat
tegenover wat deze repository op dit moment laat zien:

| Signaal | Stand op 19 oktober 2026 |
| --- | --- |
| Eerste commit | 18 oktober 2026 (één dag oud) |
| Sterren / forks / issues | 0 / 0 / 0 |
| Releases | 5 tags (v0.1.7–v0.1.11), 13 downloads |
| Media, blogs, discussies | geen |
| Onderhoud | 19 commits, CI groen op elke PR |

Dat is een werkend, gedocumenteerd en controleerbaar project, maar nog geen *bekend* project. De
reputatievraag is in het formulier verplicht en dit is precies het veld waarop een prille
repository wordt afgewezen. Twee eerlijke opties:

1. **Wachten tot er iets te laten zien is** (aanbevolen). Richtlijn: een week of zes à acht
   releases uitbrengen, een paar honderd downloads, minstens één openbare plek waar het project
   genoemd wordt (een forum- of Reddit-draadje, een blogpost, een recensie, een fork van een
   gebruiker), en een issue of pull request van iemand anders dan de maintainer. Dan is het
   reputatieveld geen zwakke plek meer maar een opsomming.
2. **Nu aanvragen** en de eerlijke tekst uit [Reputation](#reputation) gebruiken. De kans op
   afwijzing is groot; vraag in dat geval om een nieuwe poging zodra het project geschiedenis
   heeft in plaats van te discussiëren over het beleid (de voorwaarden vragen daar ook om:
   *"Please don't argue with us"*).

Er is voor de tweede optie gekozen: de aanvraag is op 19 oktober 2026 verstuurd. Op 20 oktober 2026
kwam de afwijzing, met precies de reden die hierboven voorspeld is: *"your project doesn't yet show
enough of these signals … it's purely about the level of public visibility the Foundation program
requires"*, plus de uitnodiging om terug te komen zodra het project breder bekend is. Daarmee is de
eerste optie het antwoord, met [signpath-signalen.json](signpath-signalen.json) als bewijs dat het
project sindsdien gegroeid is. De volledige brief staat in
[signpath-aanvraag-log.md](signpath-aanvraag-log.md#uitkomst-poging-1-20-oktober-2026).

Wat je hoeft te doen voordat je op *Submit* drukt, staat in [Vooraf](#vooraf).

## Vooraf

De voorwaarden vragen meer dan een formulier. Deze lijst is afgevinkt zodra alles klopt; wat de
repository zelf bewijst staat aan, de drie punten die alleen jij kunt zien (MFA, de rolverdeling en
de repo-instellingen) blijven open tot je ze hebt nagelopen.

- [x] **Deze documenten staan op GitHub** — de URL's in dit blad wijzen naar de branch `main`;
      commit en push ze voordat je het formulier verstuurt, anders krijgt de Foundation een 404.
- [x] **Repository openbaar** — <https://github.com/DrIamlegion/helder> is openbaar.
- [x] **Eén OSI-licentie voor alle componenten** — GPL-3.0, `"license": "GPL-3.0-only"`, elke
      bronfile met een SPDX-header (`npm run license:check`).
- [x] **Released in de vorm die ondertekend wordt** — de NSIS-installer bestaat en is
      downloadbaar: <https://github.com/DrIamlegion/helder/releases>
- [x] **Gedocumenteerd op de downloadpagina** — [download.md](download.md) beschrijft wat de app
      doet en hoe je hem installeert.
- [x] **Code signing policy op de homepage en de downloadpagina**, met de letterlijke regel en de
      teamrollen — zie [README → Code signing policy](../README.md#code-signing-policy) en
      [code-signing-policy.md](code-signing-policy.md).
- [x] **Privacybeleid** — [privacy.md](privacy.md). Nodig omdat de app bij het starten contact
      maakt met GitHub Releases; de formulering "verstuurt nooit iets" zou daarom onwaar zijn.
- [ ] **MFA aan** op GitHub (Settings → Password and authentication) *en* later op SignPath; de
      voorwaarden eisen dat van ieder teamlid.
- [ ] **Rollen bekend**: auteurs/committers, reviewers en approvers zijn één persoon
      ([@DrIamlegion](https://github.com/DrIamlegion)). Externe pull requests worden door hem
      beoordeeld; elke tag wordt door hem goedgekeurd.
- [ ] **Repo-instellingen**: zet onder *About* de homepage op
      `https://github.com/DrIamlegion/helder` en voeg de onderwerpen `boekhouding`, `facturen`,
      `electron`, `gpl` toe. Dat maakt de repository vindbaar — wat weer helpt bij de volgende
      aanvraag.

## De velden

Kopieer per veld de regel uit het blok. Velden met *leeg* laat je leeg.

### Project Name

```
Helder
```

### Repository URL

```
https://github.com/DrIamlegion/helder
```

### Homepage URL

```
https://github.com/DrIamlegion/helder
```

Het formulier staat hier expliciet de repositorypagina toe ("This can be a dedicated website or
the repository page"). Heb je later een eigen domein, gebruik dat dan.

### Download URL

```
https://github.com/DrIamlegion/helder/blob/main/docs/download.md
```

Het formulier vraagt dat deze pagina zegt dat het project de SignPath Foundation gebruikt voor
ondertekening. Zolang er geen goedgekeurde aanvraag of abonnement is, staat er het tegenovergestelde:
[download.md](download.md) zegt eerlijk dat de installers **niet ondertekend** zijn, en waarom. Komt
ondertekening er wel, zet die regel er dan bij — in de README, op de downloadpagina en in de voet van
`scripts/release-body.mjs` — en pas `npm run test:documentatie` aan, dat nu juist bewaakt dat de claim
er niet staat.

### Privacy Policy URL

```
https://github.com/DrIamlegion/helder/blob/main/docs/privacy.md
```

### Wikipedia URL

*leeg* — er is geen artikel.

### Tagline

Eén zin, kan op de projectpagina van de Foundation komen te staan:

```
Local-first bookkeeping for Dutch freelancers and small businesses: invoices, quotes, expenses, bank imports, reminders and VAT returns.
```

### Category

```
Productivity
```

De keuzelijst heeft: Accessibility, AI Tools, Audio, Developer Tools, Educational, Gaming,
Graphics, Productivity, Science, Other. *Productivity* past bij een boekhoudapp; *Other* is de
terugvaloptie als de Foundation liever financiële software apart zet.

### Description

Eén alinea, zonder versiespecifieke functies of dependency-lijsten:

```
Helder is a Windows desktop application for bookkeeping by Dutch freelancers and small businesses. It keeps customers, invoices, quotes, recurring invoices, products, expenses, bank statement imports and the quarterly Dutch VAT return in one place, and it prepares payment reminders and instalment plans that the user sends themselves. All data is stored locally on the user's computer: there is no account, no server and no cloud storage, and a built-in backup writes a readable copy to the user's data folder. Helder is built with Electron, React and TypeScript and is published as an NSIS installer for Windows, with an installable web app (PWA) as a second way to run it.
```

### Reputation

Dit is het veld dat over de aanvraag beslist — en bij poging 1 ook beslist heeft. Hieronder eerst de
eerlijke tekst zoals die op 19 oktober 2026 verstuurd is (geen verzonnen gebruikers, geen opgeblazen
cijfers), daarna wat een tweede poging anders moet zeggen.

```
Helder is a new project. The repository became public on 18 October 2026 and the first release (v0.1.7) was published the same day; five tagged releases have followed, the latest v0.1.11.

What can be verified today:
- Every release is built and published by GitHub Actions from a tag in this repository, with the installer and latest.yml as release assets: https://github.com/DrIamlegion/helder/releases
- CI runs on every pull request: license headers, release-note extraction, typecheck and build, an end-to-end test that starts the real Electron app and exercises the VAT calculation, packaging, and a hash check that ties the packaged app back to the commit (https://github.com/DrIamlegion/helder/actions).
- The complete source is published under AGPL-3.0, with an SPDX header in every source file and the license shipped inside the installer.
- The application's functionality is documented feature by feature in the README and on the download page.

I want to be straightforward about the limits: there is no press coverage, no community discussion and no meaningful download record yet, and the project has a single maintainer. If verifiable reputation is a hard requirement, I would rather withdraw and apply again once the project has that history than have the Foundation vouch for software that nobody knows yet.
```

Dit is de tekst die op 19 oktober 2026 is verstuurd. Voor een tweede poging is de laatste alinea te
zwak: die vraagt om uitstel in plaats van dat hij iets laat zien. Vervang hem door de follow-up
tekst hieronder en vul elk streepje met iets dat je kunt openen.

```
The Foundation declined a first application for this project on 20 October 2026, when the repository was two days old, and encouraged me to reapply once the project had gained broader recognition. This is that follow-up.

What is new since that answer, all verifiable:
- ⟨X⟩ tagged releases, the latest v⟨versie⟩ (⟨datum⟩), each built and published by GitHub Actions from a tag in this repository.
- ⟨X⟩ stars, ⟨X⟩ forks and ⟨X⟩ downloads of the installer.
- ⟨issue/PR of iemand anders, met nummer en datum⟩
- ⟨vermelding buiten GitHub: URL, datum en wat er staat⟩

I am not going to overstate this: ⟨wat er nog steeds ontbreekt, in één zin⟩. If that is still not enough for a Foundation certificate, I would rather hear it again than have the Foundation vouch for software that nobody knows yet.
```

Verzin niets en laat een streepje weg in plaats van het op te vullen met iets vaags: de Foundation
leest de repository en de links, en een overdreven claim is op zichzelf al een reden om af te wijzen.
De cijfers komen uit `npm run signalen`, dat per dag één meting in
[signpath-signalen.json](signpath-signalen.json) zet.

### Maintainer Type

```
Individual maintainer(s)
```

Keuzelijst: Independent community project (no formal organization), Non-profit foundation or
research/educational institution, For-profit company or corporate-backed project, Individual
maintainer(s), Other (please specify). Kies *For-profit company* alleen als Helder echt vanuit een
onderneming wordt onderhouden.

### Build System

```
GitHub Actions
```

Keuzelijst: GitHub Actions, GitLab CI/CD. De release-workflow draait op door GitHub gehoste
runners, zoals de voorwaarden eisen.

### First Name / Last Name / Email

Je eigen naam en het adres waarop je de SignPath-uitnodiging wilt ontvangen. Dit wordt het
account in SignPath; gebruik hetzelfde e-mailadres als op je GitHub-account, dat scheelt later
uitleg.

### Company Name

*leeg*, tenzij je Helder vanuit een onderneming uitgeeft.

### Primary Discovery Channel

Kies wat voor jou klopt. Keuzelijst: Organic search, AI / LLM tools, Developer platforms (e.g.
GitHub), Community platforms, Social media, Events, Referral, Direct contact, Other. Kom je via
deze repository of een AI-assistent bij SignPath uit, dan zijn dat respectievelijk *Developer
platforms (e.g. GitHub)* en *AI / LLM tools*; het veld eronder vraagt om de exacte bron en mag
leeg blijven.

### Please specify the exact source

Optioneel. Bijvoorbeeld `GitHub search for "code signing open source"` of de URL van het artikel
waar je het las.

### Checkboxen

- **Code of Conduct** — verplicht; je verklaart dat certificaten op naam van de Foundation staan
  en ingetrokken kunnen worden.
- **Other communications** — optioneel.
- **Store and process my personal data** — verplicht.

## Na goedkeuring

Geldt zowel bij een nieuwe aanvraag die wél wordt goedgekeurd als bij een betaald abonnement: de
inrichting in het portaal staat in [signpath-inrichting.md](signpath-inrichting.md), en de workflow
staat er al op. Zet `SIGNPATH_API_TOKEN` en `SIGNPATH_ORGANIZATION_ID` als Actions-secrets en
`HELDER_SIGN_PUBLISHER` als repository-variabele met de naam die precies op het certificaat staat —
bij een eigen abonnement is dat je organisatie, niet de Foundation. Daarna een nieuwe tag. Zonder die
secrets bouwt de workflow ongetekend door.
