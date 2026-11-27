# Endringslogg

Hver versjon har en overskrift `## x.y.z`. Teksten under vises i appen når far trykker «Hva er nytt».

## 1.5.1

- «Sorter bilder» og flytting fra Galleriet går mye raskere:
  - 8 bilder behandles samtidig i stedet for ett og ett.
  - Bilder som bare ligger i skyen, bestilles nedlastet i forkant, mens tidligere bilder flyttes.
  - Loggen skrives i bunker i stedet for etter hvert bilde.
- Avbryter du en sortering og starter på nytt, fortsetter den der den slapp. Duplikatsjekken husker alt som allerede er flyttet.

## 1.5.0

- Nytt: Fremdrift i menylinjen øverst på skjermen. Mens filer kopieres, flyttes eller slettes, eller bilder sorteres, vises et lite ikon med en ring som fylles og prosent ved siden av.
  - Klikk på ikonet for å se hva som pågår, hvor lang tid som er igjen, og for å avbryte.
- Du kan lukke vinduet mens arbeidet pågår. Det fortsetter i bakgrunnen, og når det er ferdig, kommer et varsel og Filutforsker avslutter av seg selv.
- ⌘Q midt i arbeid spør om du vil fortsette i bakgrunnen eller stoppe.

## 1.4.0

- Forhåndsvisning: Marker en fil og trykk mellomromstasten for å se den uten å åpne et program. Piltastene bytter fil, og mellomrom eller Esc lukker.
- Angre med ⌘Z (eller høyreklikk › Angre): nytt navn, ny mappe, kopiering, flytting og sletting. Slettede filer legges tilbake fra papirkurven.
- Når et element med samme navn allerede finnes, spør appen nå: Erstatt, Hopp over eller Behold begge. Det som erstattes, legges i papirkurven.
- Hurtigtilgang: Høyreklikk en mappe og velg «Fest i Hurtigtilgang», eller «Løsne» for å fjerne den.
- Gamle OneDrive-kopier («Personlig (dato)», «Personlig(2)») skjules automatisk fra sidepanelet. De kan vises igjen med «skjult – vis».

## 1.3.0

- Nytt: Fremdriftsvindu når du kopierer, flytter eller sletter filer, nederst til høyre i vinduet.
  - Viser prosent fullført, hastighet med graf, gjenstående tid, hvilken fil som behandles og hvor mye som er igjen.
  - «Avbryt» stopper når som helst. Ferdige filer beholdes, den halvferdige fjernes, og originalene røres ikke.
  - Når filer lastes ned fra skyen underveis, står det tydelig.
- Flytting mellom ulike disker kopierer først og legger originalen i papirkurven først når alt er kopiert uten feil.
- Appen advarer hvis du prøver å avslutte midt i en kopiering.

## 1.2.0

- Nytt: Galleri. Viser alle bilder og videoer på Macen og i iCloud Drive, OneDrive, Google Drive og Dropbox.
  - Bilder som ligger i All Photos har et grønt merke. De andre har en «Flytt»-knapp.
  - Søk etter navn eller mappe, og filtrer på Alle, Ikke flyttet eller Flyttet.
  - Velg flere bilder med klikk, ⌘-klikk, ⇧-klikk, avkrysningsrundingen eller ved å dra over dem, og flytt alle med «Flytt valgte».
- Ny knapp «Se etter oppdateringer» nederst til høyre i vinduet.

## 1.1.1

- «Sorter bilder» forklarer nå tydelig når bilder bare ligger i skyen, og viser hvor mye som må lastes ned.
- Valget om å laste ned og flytte disse bildene ligger nå direkte i oversikten, så du slipper å starte på nytt.
- Advarsel hvis det ikke er nok ledig plass på Macen til nedlastingen.

## 1.1.0

- Filutforsker kan nå oppdatere seg selv. Når en ny versjon finnes, vises en blå linje med knappen «Oppdater nå».
- «Se etter oppdateringer» finnes i Filutforsker-menyen og under «···».
- Rettet krasj når Programmer-mappen ble åpnet.
- Bildeforhåndsvisninger lages nå litt etter litt, så store bildemapper går jevnere.

## 1.0.0

- Første versjon: filutforsker i Windows 11-stil med skystatus for iCloud Drive, OneDrive, Google Drive og Dropbox, og «Sorter bilder».
