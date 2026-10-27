# Filutforsker

Filutforsker i Windows 11-stil for Mac (Apple Silicon), med synkroniseringsstatus for iCloud Drive, OneDrive, Google Drive og Dropbox, og en «Sorter bilder»-funksjon som samler bilder i `~/All Photos/År/Måned`.

Appen er bygget på Electron. Grensesnittet er på norsk.

## Installere

1. Last ned `Filutforsker.dmg` fra siste [utgivelse](https://github.com/Kianosh-Solheim/filutforsker/releases/latest).
2. Dra Filutforsker til Programmer.
3. Appen er ikke signert av en Apple-utvikler, så første gang må denne linjen kjøres i Terminal:

   ```
   xattr -cr /Applications/Filutforsker.app && codesign --force --deep --sign - /Applications/Filutforsker.app
   ```

Etter det oppdaterer appen seg selv. Terminal-kommandoen trengs ikke ved oppdateringer.

## Gi ut en oppdatering

1. Gjør endringene i `app/`.
2. Øk `version` i `app/package.json` (f.eks. `1.1.0` → `1.1.1`).
3. Skriv hva som er nytt under en ny overskrift `## 1.1.1` øverst i `CHANGELOG.md`.
4. Commit, lag tag og push:

   ```
   git commit -am "Versjon 1.1.1"
   git tag v1.1.1
   git push origin main v1.1.1
   ```

GitHub Actions bygger da `Filutforsker.dmg` og oppdateringspakken og publiserer dem som en utgivelse. Appen ser etter oppdateringer ved oppstart og hver sjette time, og viser «Oppdater nå» når en ny versjon finnes. Følg med under **Actions** i repositoriet; bygget tar noen minutter.

Taggen må være lik versjonen i `app/package.json`, ellers stopper bygget.

## Hvordan oppdateringene virker

- `bootstrap/` er en liten oppstarter som ligger fast i app-pakken. Den velger den nyeste av app-koden som fulgte med DMG-en (`payload/`) og den som er lastet ned til `~/Library/Application Support/Filutforsker/updates/`.
- `app/updater.js` henter siste utgivelse fra GitHub, laster ned `filutforsker-app.zip`, kontrollerer SHA-256 og pakker den ut. Selve app-pakken endres aldri, så signaturen forblir gyldig.
- Krasjvern: starter en ny versjon ikke ordentlig to ganger på rad, går appen automatisk tilbake til versjonen den ble installert med.
- Oppdateringer dekker alt i `app/`. Endres `bootstrap/`, `build/electron-version` eller Info.plist, må DMG-en installeres på nytt. Øk da `filutforsker.shellApi` i `app/package.json` og `SHELL_API` i `bootstrap/bootstrap.js`, så ber appen om ny DMG i stedet for å laste ned koden.

## Mappestruktur

| Mappe | Innhold |
|---|---|
| `app/` | Selve appen: hovedprosess, skystatus, bildesortering, oppdatering og grensesnitt (`renderer/`) |
| `bootstrap/` | Oppstarteren i app-pakken |
| `build/` | Byggeskript, ikon og DMG-verktøy |
| `.github/workflows/` | Automatisk bygg og utgivelse ved ny tag |

## Utvikling lokalt

```
npx electron app
```

Uten oppstarteren kan appen se etter oppdateringer, men ikke installere dem.
