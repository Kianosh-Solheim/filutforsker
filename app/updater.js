'use strict';
// Oppdateringer fra GitHub-utgivelser (github.com/Kianosh-Solheim/filutforsker/releases).
// Laster ned filutforsker-app.zip, sjekker SHA-256, pakker ut i updates/versions/<versjon>
// og lar oppstarteren (bootstrap.js) bruke den ved neste start.

const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const REPO = 'Kianosh-Solheim/filutforsker';
const ASSET = 'filutforsker-app.zip';
const CURRENT = require('./package.json').version;

function boot() { return global.__fxBoot || null; }
function updatesDir() { return (boot() && boot().updatesDir) || path.join(app.getPath('userData'), 'updates'); }
function shellApi() { return (boot() && boot().shellApi) || 0; }

function cmp(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

let latest = null;

async function check() {
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Filutforsker' },
  });
  if (res.status === 404) return { current: CURRENT, available: false };
  if (!res.ok) throw new Error(`GitHub svarte ${res.status}`);
  const rel = await res.json();
  const version = String(rel.tag_name || '').replace(/^v/i, '');
  const zip = (rel.assets || []).find(a => a.name === ASSET);
  const sum = (rel.assets || []).find(a => a.name === `${ASSET}.sha256`);
  const dmg = (rel.assets || []).find(a => /\.dmg$/i.test(a.name));
  latest = {
    version,
    notes: rel.body || '',
    page: rel.html_url,
    zipUrl: zip && zip.browser_download_url,
    size: zip && zip.size,
    sumUrl: sum && sum.browser_download_url,
    dmgUrl: dmg && dmg.browser_download_url,
  };
  return {
    current: CURRENT,
    available: !!(version && zip && cmp(version, CURRENT) > 0),
    version,
    notes: latest.notes,
    page: latest.page,
    canInstall: !!boot(),
  };
}

function sh(cmd, args) {
  return new Promise((resolve, reject) => execFile(cmd, args, { timeout: 120000 }, (err, out, errOut) => err ? reject(new Error(errOut || err.message)) : resolve(out)));
}

// Alt diskarbeid her er synkront med vilje: oppdateringen skal virke selv om appens diskarbeidere
// er opptatt (for eksempel av bildesortering som venter på nedlasting fra skyen).
async function install(onProgress) {
  await check().catch(() => {});
  if (!latest || !latest.zipUrl) throw new Error('Fant ingen oppdatering å laste ned.');
  if (!boot()) throw new Error('Denne installasjonen kan ikke oppdatere seg selv. Installer den nyeste DMG-en.');
  const dir = updatesDir();
  const versions = path.join(dir, 'versions');
  fs.mkdirSync(versions, { recursive: true });
  const tmpZip = path.join(dir, 'download.zip');
  const staging = path.join(dir, 'staging');

  // 1. Last ned med fremdrift; gi opp hvis det står stille i 60 sekunder
  const ctrl = new AbortController();
  let stallTimer = null;
  const stall = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => ctrl.abort(), 60000); };
  stall();
  let chunks = [], got = 0, total = 0;
  try {
    const res = await net.fetch(latest.zipUrl, { headers: { 'User-Agent': 'Filutforsker' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Nedlastingen feilet (${res.status}).`);
    total = Number(res.headers.get('content-length')) || latest.size || 0;
    onProgress && onProgress({ phase: 'download', got: 0, total });
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      stall();
      chunks.push(Buffer.from(value));
      got += value.length;
      onProgress && onProgress({ phase: 'download', got, total });
    }
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error('Nedlastingen stoppet opp. Sjekk internettforbindelsen og prøv igjen.');
    throw e;
  } finally {
    clearTimeout(stallTimer);
  }
  const data = Buffer.concat(chunks);
  chunks = null;

  // 2. Kontroller sjekksum
  onProgress && onProgress({ phase: 'verify' });
  if (latest.sumUrl) {
    const sres = await net.fetch(latest.sumUrl, { headers: { 'User-Agent': 'Filutforsker' } });
    const expected = (await sres.text()).trim().split(/\s+/)[0].toLowerCase();
    const actual = crypto.createHash('sha256').update(data).digest('hex');
    if (expected && expected !== actual) throw new Error('Den nedlastede filen var skadet. Prøv igjen.');
  }
  fs.writeFileSync(tmpZip, data);

  // 3. Pakk ut og kontroller innholdet
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  if (fs.existsSync('/usr/bin/ditto')) await sh('/usr/bin/ditto', ['-x', '-k', tmpZip, staging]);
  else await sh('unzip', ['-q', '-o', tmpZip, '-d', staging]);
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(path.join(staging, 'package.json'), 'utf8')); } catch {}
  if (!pkg || pkg.version !== latest.version || !fs.existsSync(path.join(staging, 'main.js'))) {
    throw new Error('Oppdateringspakken var ufullstendig.');
  }
  const needApi = (pkg.filutforsker && pkg.filutforsker.shellApi) || 1;
  if (needApi > shellApi()) {
    const e = new Error('Denne oppdateringen krever at Filutforsker installeres på nytt fra DMG-filen.');
    e.needsDmg = latest.dmgUrl || latest.page;
    throw e;
  }

  // 4. Flytt på plass og registrer som gjeldende versjon
  const target = path.join(versions, latest.version);
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(staging, target);
  fs.rmSync(tmpZip, { force: true });
  const statePath = path.join(dir, 'state.json');
  let state = {};
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch {}
  const keep = new Set([latest.version, state.good].filter(Boolean));
  state.current = latest.version;
  state.attempts = 0;
  state.bad = (state.bad || []).filter(v => v !== latest.version);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  // 5. Rydd bort gamle versjoner
  for (const v of fs.readdirSync(versions)) {
    if (!keep.has(v)) fs.rmSync(path.join(versions, v), { recursive: true, force: true });
  }
  return { version: latest.version };
}

function restart() {
  app.relaunch();
  app.exit(0);
}

module.exports = { check, install, restart, CURRENT };
