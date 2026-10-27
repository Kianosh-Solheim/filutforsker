#!/usr/bin/env bash
# Bygger utgivelsesfilene i out/:
#   Filutforsker.dmg               – full installasjon (Apple Silicon)
#   filutforsker-app.zip(.sha256)  – oppdateringspakken appen laster ned selv
#   notes.md                       – utgivelsesnotater fra CHANGELOG.md
#
# Krever: node, python3, curl, unzip, zip, xorriso, rcodesign. Kjøres av GitHub Actions ved ny tag,
# men fungerer også lokalt på Linux.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
B="$ROOT/build"
OUT="$ROOT/out"
WORK="$OUT/work"
EV="$(tr -d '[:space:]' < "$B/electron-version")"
VERSION="$(node -p "require('$ROOT/app/package.json').version")"
mkdir -p "$OUT" "$WORK"
echo "Bygger Filutforsker $VERSION (Electron $EV)"

# 1. Electron for macOS arm64, kontrollert mot Electrons egne sjekksummer
EZIP="$WORK/electron-$EV.zip"
if [ ! -f "$EZIP" ]; then
  curl -fsSL -o "$EZIP" "https://github.com/electron/electron/releases/download/v$EV/electron-v$EV-darwin-arm64.zip"
fi
curl -fsSL -o "$WORK/SHASUMS256.txt" "https://github.com/electron/electron/releases/download/v$EV/SHASUMS256.txt"
EXPECTED="$(grep " \*electron-v$EV-darwin-arm64.zip\$" "$WORK/SHASUMS256.txt" | cut -d' ' -f1)"
echo "$EXPECTED  $EZIP" | sha256sum -c -

# 2. Sett sammen app-pakken
rm -rf "$WORK/bundle" && mkdir -p "$WORK/bundle"
unzip -q "$EZIP" -d "$WORK/bundle"
APP="$WORK/bundle/Filutforsker.app"
mv "$WORK/bundle/Electron.app" "$APP"
R="$APP/Contents/Resources"
rm -f "$R/default_app.asar" "$R/electron.icns"
cp "$B/app.icns" "$R/app.icns"
python3 "$B/configure_bundle.py" "$APP/Contents/Info.plist" "$VERSION"
mkdir -p "$R/app/payload"
cp -R "$ROOT/bootstrap/." "$R/app/"
cp -R "$ROOT/app/." "$R/app/payload/"

# 3. Ad hoc-signering (gjør at macOS godtar appen etter «xattr»-kommandoen)
rcodesign sign "$APP" > "$WORK/sign.log" 2>&1

# 4. Oppdateringspakke
rm -f "$OUT/filutforsker-app.zip"
(cd "$ROOT/app" && zip -qr -X "$OUT/filutforsker-app.zip" .)
(cd "$OUT" && sha256sum filutforsker-app.zip | cut -d' ' -f1 > filutforsker-app.zip.sha256)

# 5. Diskbilde: HFS+ via xorriso, deretter komprimert UDIF (.dmg)
STAGE="$WORK/stage"
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp -a "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Programmer"
cp "$B/Les meg først.txt" "$STAGE/"
rm -f "$WORK/image.iso" "$OUT/Filutforsker.dmg"
LANG=C.UTF-8 LC_ALL=C.UTF-8 xorriso -as mkisofs -input-charset UTF-8 -V Filutforsker -hfsplus \
  -apm-block-size 2048 -R -J -joliet-long -o "$WORK/image.iso" "$STAGE" 2>&1 | tail -1
python3 "$B/udif.py" "$WORK/image.iso" "$OUT/Filutforsker.dmg"

# 6. Utgivelsesnotater
python3 "$B/changelog.py" "$ROOT/CHANGELOG.md" "$VERSION" > "$OUT/notes.md"

ls -la "$OUT"
