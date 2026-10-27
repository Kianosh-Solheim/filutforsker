'use strict';
// Oppstarter for Filutforsker.
//
// Selve app-koden ligger i to mulige steder:
//   1. payload/ inne i app-pakken (versjonen som fulgte med DMG-en)
//   2. ~/Library/Application Support/Filutforsker/updates/versions/<versjon> (lastet ned fra GitHub)
// Oppstarteren velger den nyeste. App-pakken endres aldri, så signaturen forblir gyldig.
//
// Krasjvern: en nedlastet versjon må vise et vindu (markGood) innen to oppstarter.
// Gjør den ikke det, merkes den som dårlig og den medfølgende versjonen brukes.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Øk dette tallet hvis oppstarteren endres slik at gammel app-kode ikke lenger passer.
const SHELL_API = 1;

app.setName('Filutforsker');

const bundledDir = path.join(__dirname, 'payload');
const updatesDir = path.join(app.getPath('userData'), 'updates');
const statePath = path.join(updatesDir, 'state.json');

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function versionOf(dir) { const pkg = readJSON(path.join(dir, 'package.json')); return pkg && pkg.version; }
function shellApiOf(dir) { const pkg = readJSON(path.join(dir, 'package.json')); return (pkg && pkg.filutforsker && pkg.filutforsker.shellApi) || 1; }
function cmp(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

let state = readJSON(statePath) || {};
function saveState() {
  try { fs.mkdirSync(updatesDir, { recursive: true }); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); } catch {}
}

let root = bundledDir;
const bundledVersion = versionOf(bundledDir);
const cand = state.current ? path.join(updatesDir, 'versions', state.current) : null;
const candVersion = cand ? versionOf(cand) : null;
const bad = state.bad || [];

if (candVersion && cmp(candVersion, bundledVersion) > 0 && !bad.includes(candVersion) && shellApiOf(cand) <= SHELL_API
    && fs.existsSync(path.join(cand, 'main.js'))) {
  if (state.good === candVersion) {
    root = cand;
  } else if ((state.attempts || 0) >= 2) {
    state.bad = [...bad, candVersion];
    state.attempts = 0;
    saveState();
  } else {
    state.attempts = (state.attempts || 0) + 1;
    saveState();
    root = cand;
  }
}

global.__fxBoot = {
  root,
  bundledDir,
  bundledVersion,
  updatesDir,
  shellApi: SHELL_API,
  markGood() {
    const v = versionOf(root);
    if (root !== bundledDir && state.good !== v) {
      state.good = v;
      state.attempts = 0;
      saveState();
    }
  },
};

require(path.join(root, 'main.js'));
