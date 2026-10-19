# De SignPath-aanvraag, veld voor veld

Dit is het invulblad voor <https://signpath.org/apply>. De velden hieronder zijn overgenomen van
het formulier zoals het op 19 oktober 2026 live stond (HubSpot-formulier
`bf62807d-bb72-4e45-9bde-1f3a53ba2472`), inclusief de keuzelijsten. De antwoorden staan in het
Engels omdat het formulier Engels is; de rest van dit document is Nederlands.

**Lees eerst [Verwachting](#verwachting) hieronder.** Een aanvraag die nu wordt afgewezen, kost
weken; dezelfde aanvraag over een maand of twee heeft een reële kans.

## Verwachting

De voorwaarden van de Foundation zeggen letterlijk dat zij *"cannot sign binaries based on source
code that nobody knows"* en dat zij *"a certain verifiable reputation"* eisen
([signpath.org/terms](https://signpath.org/terms.html), *Common misunderstandings*). Daar staat
tegenover wat deze repository op dit moment laat zien:

| Signaal | Stand op 19 oktober 2026 |
| --- | --- |
| Eerste commit | 18 oktober 2026 (één dag oud) |
| Sterren / forks / issues | 0 / 0 / 0 |
| Releases | 4 tags, samen 1 download van een installer |
| Media, blogs, discussies | geen |
| Onderhoud | 15 commits, CI groen op elke PR |

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

Wat je hoeft te doen voordat je op *Submit* drukt, staat in [Vooraf](#vooraf).

## Vooraf

De voorwaarden vragen meer dan een formulier. Deze lijst is afgevinkt zodra alles klopt:

- [ ] **Deze documenten staan op GitHub** — de URL's in dit blad wijzen naar de branch `main`;
      commit en push ze voordat je het formulier verstuurt, anders krijgt de Foundation een 404.
- [ ] **Repository openbaar** — <https://github.com/DrIamlegion/helder> is openbaar.
- [ ] **Eén OSI-licentie voor alle componenten** — AGPL-3.0, `"license": "AGPL-3.0-only"`, elke
      bronfile met een SPDX-header (`npm run license:check`).
- [ ] **Released in de vorm die ondertekend wordt** — de NSIS-installer bestaat en is
      downloadbaar: <https://github.com/DrIamlegion/helder/releases>
- [ ] **Gedocumenteerd op de downloadpagina** — [download.md](download.md) beschrijft wat de app
      doet en hoe je hem installeert.
- [ ] **Code signing policy op de homepage en de downloadpagina**, met de letterlijke regel en de
      teamrollen — zie [README → Code signing policy](../README.md#code-signing-policy) en
      [code-signing-policy.md](code-signing-policy.md).
- [ ] **Privacybeleid** — [privacy.md](privacy.md). Nodig omdat de app bij het starten contact
      maakt met GitHub Releases; de formulering "verstuurt nooit iets" zou daarom onwaar zijn.
- [ ] **MFA aan** op GitHub (Settings → Password and authentication) *en* later op SignPath; de
      voorwaarden eisen dat van ieder teamlid.
- [ ] **Rollen bekend**: auteurs/committers, reviewers en approvers zijn één persoon
      ([@DrIamlegion](https://github.com/DrIamlegion)). Externe pull requests worden door hem
      beoordeeld; elke tag wordt door hem goedgekeurd.
- [ ] **Repo-instellingen**: zet onder *About* de homepage op
      `https://github.com/DrIamlegion/helder` en voeg de onderwerpen `boekhouding`, `facturen`,
      `electron`, `agpl` toe. Dat maakt de repository vindbaar — wat weer helpt bij de volgende
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

Deze pagina moet volgens het formulier *"mention that the project uses the SignPath Foundation
for code signing"*; [download.md](download.md) doet dat, en de README linkt er vanaf de
homepage naar. Elke releasepagina krijgt dezelfde regel automatisch onderaan de release-opmerkingen
(`scripts/release-body.mjs`), met een link naar de downloadpagina.

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

Dit is het veld dat over de aanvraag beslist. Hieronder de eerlijke versie: geen verzonnen
gebruikers, geen opgeblazen cijfers.

```
Helder is a new project. The repository became public on 18 October 2026 and the first release (v0.1.7) was published the same day; four tagged releases have followed, the latest v0.1.10.

What can be verified today:
- Every release is built and published by GitHub Actions from a tag in this repository, with the installer, its blockmap and latest.yml as release assets: https://github.com/DrIamlegion/helder/releases
- CI runs on every pull request: license headers, release-note extraction, typecheck and build, an end-to-end test that starts the real Electron app and exercises the VAT calculation, packaging, and a hash check that ties the packaged app back to the commit (https://github.com/DrIamlegion/helder/actions).
- The complete source is published under AGPL-3.0, with an SPDX header in every source file and the license shipped inside the installer.
- The application's functionality is documented feature by feature in the README and on the download page.

I want to be straightforward about the limits: there is no press coverage, no community discussion and no meaningful download record yet, and the project has a single maintainer. If verifiable reputation is a hard requirement, I would rather withdraw and apply again once the project has that history than have the Foundation vouch for software that nobody knows yet.
```

Als er inmiddels wél signalen zijn (downloads, sterren, een draadje, een issue van iemand anders),
vervang dan de laatste alinea door die concrete cijfers en links. Verzin niets: de Foundation
controleert de repository, en een overdreven claim is een reden om af te wijzen.

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

De inrichting in SignPath staat in [README → De aanvraag in stappen](../README.md#de-aanvraag-in-stappen)
en de workflow staat er al op: `SIGNPATH_API_TOKEN` en `SIGNPATH_ORGANIZATION_ID` als
Actions-secrets, daarna een nieuwe tag. Zonder die secrets bouwt de workflow ongetekend door.
