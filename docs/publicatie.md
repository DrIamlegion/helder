# Publiceren op GitHub

Deze map is een git-repository op `main`, gekoppeld aan de lege openbare repository
`DrIamlegion/helder` via `origin`. Hieronder staat wat er moet gebeuren om haar te publiceren,
en welke controles je daarvoor draait.

## Controlelijst vóór de eerste push

Alles hieronder is op deze repository al gedraaid en schoon bevonden; draai het opnieuw als je
sindsdien iets hebt toegevoegd.

```bash
git status                       # moet leeg zijn
npm run license:check            # elk bronbestand heeft de AGPL-header
npm run typecheck                # tsc --noEmit
npm run verify:build             # app.asar hoort bij HEAD (na een build)
git ls-files -z | xargs -0 du -cb | tail -1    # totale omvang van wat er meegaat
```

De controles van de CI-workflow draai je in één keer met `npm run ci`: licentieheaders,
release-opmerkingen, build, de btw-test in de echte app, de app-map en de hashcontrole.

Geen geheimen of grote bestanden in de repository:

```bash
# verdachte bestandsnamen
git ls-files | grep -Ei '\.env|\.pem|\.pfx|\.p12|\.key$|secret|credential|token|id_rsa'

# sleutels, tokens en wachtwoorden in de inhoud (let op een echte waarde,
# niet een plaatsvervanger als `…` of `<naam>`)
git grep -nEi 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|client[_-]?secret\s*[:=]\s*["'"'"']?[A-Za-z0-9_\-]{8,}|api[_-]?key\s*[:=]\s*["'"'"']?[A-Za-z0-9_\-]{16,}'

# persoonlijke paden
git grep -nEi 'C:\\Users\\|/Users/|AppData\\Local'

# grootste bestanden
git ls-files -z | xargs -0 du -b | sort -rn | head
```

`.gitignore` houdt `node_modules`, `dist`, `release`, `.env`, logs en editorbestanden buiten de
repository; `package-lock.json` is met ±340 kB het grootste bestand dat meegaat.

## Eerste push

1. **Repository** — `DrIamlegion/helder` bestaat al als lege openbare repository en `origin`
   wijst ernaar. De eerste push is dus alleen nog:

   ```bash
   git push -u origin main
   ```

   Begin je opnieuw (bijvoorbeeld in een verse kloon), maak de repository dan aan: openbaar,
   zonder README, licentie of `.gitignore` (die staan er al in, en GitHub zou ze anders laten
   conflicteren). Met de GitHub CLI:

   ```bash
   gh repo create <gebruiker>/helder --public --source=. --remote=origin --push
   ```

   Zonder CLI: maak de repository leeg aan op github.com en daarna

   ```bash
   git remote add origin https://github.com/<gebruiker>/helder.git
   git push -u origin main
   ```

   De commits staan nu op naam van `Helder-auteurs <noreply@localhost>`. Wil je ze aan je eigen
   GitHub-account koppelen, doe dat **vóór** de push:

   ```bash
   git config user.name "Je Naam"
   git config user.email "jouw-id+gebruikersnaam@users.noreply.github.com"
   git rebase --root --exec "git commit --amend --no-edit --reset-author"
   ```

2. **Repository-instellingen** die het verschil maken:
   - onder *About*: een korte beschrijving, de onderwerpen `boekhouding`, `facturen`,
     `electron`, `agpl` en de verwijzing naar de licentie;
   - onder *Branches*: bescherming voor `main` met de CI-workflow als verplichte controle, zodat
     een pull request met een afwijkende build niet gemerged kan worden;
   - onder *Actions → General*: de standaard `Read repository contents` is genoeg; de
     release-workflow vraagt zelf `contents: write` aan.

3. **Eerste tag** (dit start de release). Doe dit pas als je echt wilt publiceren:

   ```bash
   git tag v0.1.7
   git push origin v0.1.7
   ```

   Zonder SignPath-secrets bouwt de workflow een **ongetekende** installer en publiceert die;
   Windows toont dan SmartScreen-waarschuwingen. Zie README → *Ondertekening*.

4. **SignPath Foundation** aanvragen met de URL van de openbare repository, en daarna
   `SIGNPATH_API_TOKEN` en `SIGNPATH_ORGANIZATION_ID` als Actions-secrets zetten. Elke release
   moet daarna in SignPath worden goedgekeurd voordat er iets gepubliceerd wordt.

## Na de eerste push

- De CI-workflow draait op elke pull request: licentiecontrole, release-opmerkingen,
  typecheck en build, de **btw-test** (`scripts/test-btw.mjs`, die de app echt start op de
  Windows-runner), app-map bouwen en de hashcontrole (`scripts/verify-build.mjs`). Draai die
  btw-test ook lokaal met `npm test` — in CI staat hij vóór de inpakstap, zodat een gebroken
  btw-regel meteen opvalt.
- De release-workflow draait op elke `v*`-tag: de release-opmerkingen controleren, bouwen, de
  **btw-test** in de echte app, de app-map bouwen, app-bestanden ondertekenen, de installer
  bouwen en ondertekenen, `latest.yml` opnieuw genereren, hash- en handtekeningscontrole, en pas
  dan publiceren. De tests staan vóór het inpakken, zodat een gebroken btw-regel of afgekapte
  release-opmerking geen dure ondertekeningsaanvraag kost.
- Nieuwe versie: hoog `version` in `package.json` op, schrijf de sectie in `CHANGELOG.md`, commit,
  tag en push de tag.
