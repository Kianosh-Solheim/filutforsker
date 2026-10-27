"""Gjør Electron.app om til Filutforsker.app: navn, ikon, versjon og tilgangsforklaringer i Info.plist."""
import plistlib
import sys

path, version = sys.argv[1], sys.argv[2]
with open(path, "rb") as f:
    d = plistlib.load(f)

d.update({
    "CFBundleName": "Filutforsker",
    "CFBundleDisplayName": "Filutforsker",
    "CFBundleIdentifier": "no.solheim.filutforsker",
    "CFBundleIconFile": "app.icns",
    "CFBundleShortVersionString": version,
    "CFBundleVersion": version,
    "CFBundleDevelopmentRegion": "nb",
    "LSApplicationCategoryType": "public.app-category.productivity",
    "NSHumanReadableCopyright": "github.com/Kianosh-Solheim/filutforsker",
    "NSDesktopFolderUsageDescription": "Filutforsker viser filene på Skrivebordet.",
    "NSDocumentsFolderUsageDescription": "Filutforsker viser filene i Dokumenter.",
    "NSDownloadsFolderUsageDescription": "Filutforsker viser filene i Nedlastinger.",
    "NSRemovableVolumesUsageDescription": "Filutforsker viser filene på minnepinner og eksterne disker.",
    "NSNetworkVolumesUsageDescription": "Filutforsker viser filene på nettverksdisker.",
    "NSFileProviderDomainUsageDescription": "Filutforsker viser filene og synkroniseringsstatusen i OneDrive, Google Drive og Dropbox.",
    "NSAppleEventsUsageDescription": "Filutforsker bruker dette for å åpne Terminal i en mappe.",
})
for k in ("ElectronAsarIntegrity",):
    d.pop(k, None)

with open(path, "wb") as f:
    plistlib.dump(d, f)
