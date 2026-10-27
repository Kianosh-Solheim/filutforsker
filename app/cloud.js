'use strict';
// Skystatus via macOS' egne grensesnitt.
// iCloud Drive og File Provider-tjenester (OneDrive, Google Drive, Dropbox) rapporterer
// status gjennom NSURL sine "ubiquitous item"-nøkler. Vi leser dem med JavaScript for
// Automation (osascript -l JavaScript), som finnes på alle Macer uten ekstra installasjon.

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const ICLOUD = path.join(HOME, 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
const CLOUDSTORAGE = path.join(HOME, 'Library', 'CloudStorage');

// ---------- Tjenester ----------

function providerFromDirName(name) {
  const n = name.toLowerCase();
  if (n.startsWith('onedrive')) {
    const rest = name.slice('OneDrive'.length).replace(/^-/, '');
    let label = 'OneDrive';
    if (/personal/i.test(rest)) label = 'OneDrive – Personlig';
    else if (rest) label = 'OneDrive – ' + rest;
    return { id: 'onedrive', label };
  }
  if (n.startsWith('googledrive')) {
    const acct = name.slice('GoogleDrive'.length).replace(/^-/, '');
    return { id: 'gdrive', label: 'Google Drive', account: acct };
  }
  if (n.startsWith('dropbox')) return { id: 'dropbox', label: name.replace(/-/g, ' – ') };
  if (n.startsWith('box')) return { id: 'box', label: 'Box' };
  if (n.startsWith('protondrive')) return { id: 'proton', label: 'Proton Drive' };
  return { id: 'cloud', label: name };
}

function cloudRoots() {
  const roots = [];
  try {
    if (fs.statSync(ICLOUD).isDirectory()) roots.push({ id: 'icloud', label: 'iCloud Drive', path: ICLOUD });
  } catch {}
  let entries = [];
  try { entries = fs.readdirSync(CLOUDSTORAGE, { withFileTypes: true }); } catch {}
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(CLOUDSTORAGE, e.name);
    let isDir = e.isDirectory();
    if (!isDir) { try { isDir = fs.statSync(p).isDirectory(); } catch {} }
    if (!isDir) continue;
    const prov = providerFromDirName(e.name);
    roots.push({ ...prov, path: p });
  }
  // Eldre plasseringer (før File Provider)
  for (const [id, label, p] of [
    ['dropbox', 'Dropbox', path.join(HOME, 'Dropbox')],
    ['gdrive', 'Google Drive', path.join(HOME, 'Google Drive')],
    ['onedrive', 'OneDrive', path.join(HOME, 'OneDrive')],
  ]) {
    try {
      const st = fs.lstatSync(p);
      if (st.isDirectory() && !roots.some(r => r.id === id)) roots.push({ id, label, path: p, legacy: true });
    } catch {}
  }
  return roots;
}

function providerFor(p, roots) {
  roots = roots || cloudRoots();
  let best = null;
  for (const r of roots) {
    if (p === r.path || p.startsWith(r.path + path.sep)) {
      if (!best || r.path.length > best.path.length) best = r;
    }
  }
  return best;
}

// ---------- JXA-hjelper ----------

const JXA = `
ObjC.import('Foundation');
function readJSON(p) {
  var s = $.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null);
  return JSON.parse(ObjC.unwrap(s));
}
function k(name) {
  try { var v = $[name]; if (v && ObjC.unwrap(v)) return ObjC.unwrap(v); } catch (e) {}
  return name;
}
function run(argv) {
  var job = readJSON(argv[0]);
  var fm = $.NSFileManager.defaultManager;
  if (job.action === 'status') {
    var keys = [
      'NSURLIsUbiquitousItemKey',
      'NSURLUbiquitousItemDownloadingStatusKey',
      'NSURLUbiquitousItemIsDownloadingKey',
      'NSURLUbiquitousItemIsUploadedKey',
      'NSURLUbiquitousItemIsUploadingKey',
      'NSURLUbiquitousItemHasUnresolvedConflictsKey',
      'NSURLUbiquitousItemDownloadingErrorKey',
      'NSURLUbiquitousItemUploadingErrorKey',
      'NSURLUbiquitousItemIsSharedKey'
    ].map(k);
    var out = {};
    for (var i = 0; i < job.paths.length; i++) {
      var p = job.paths[i];
      try {
        var url = $.NSURL.fileURLWithPath(p);
        var vals = url.resourceValuesForKeysError($(keys), null);
        var r = {};
        if (vals && !vals.isNil()) {
          var get = function (key) { var v = vals.objectForKey(key); return (v && !v.isNil()) ? v : null; };
          var b = function (key) { var v = get(key); return v ? !!ObjC.unwrap(v) : null; };
          r.u = b(keys[0]);
          var ds = get(keys[1]); r.ds = ds ? ObjC.unwrap(ds) : null;
          r.dl = b(keys[2]); r.up = b(keys[3]); r.upl = b(keys[4]); r.cf = b(keys[5]);
          var de = get(keys[6]); r.de = de ? ObjC.unwrap(de.localizedDescription) : null;
          var ue = get(keys[7]); r.ue = ue ? ObjC.unwrap(ue.localizedDescription) : null;
          r.sh = b(keys[8]);
        }
        out[p] = r;
      } catch (e) { out[p] = { err: String(e) }; }
    }
    return JSON.stringify(out);
  }
  if (job.action === 'download' || job.action === 'evict') {
    var res = { ok: 0, failed: [] };
    for (var j = 0; j < job.paths.length; j++) {
      var u = $.NSURL.fileURLWithPath(job.paths[j]);
      var err = Ref();
      var ok = job.action === 'download'
        ? fm.startDownloadingUbiquitousItemAtURLError(u, err)
        : fm.evictUbiquitousItemAtURLError(u, err);
      if (ok) res.ok++;
      else {
        var msg = '';
        try { msg = ObjC.unwrap(err[0].localizedDescription); } catch (e) { msg = 'ukjent feil'; }
        res.failed.push({ path: job.paths[j], error: msg });
      }
    }
    return JSON.stringify(res);
  }
  return '{}';
}
`;

let jxaPath = null;
function ensureScript() {
  if (jxaPath && fs.existsSync(jxaPath)) return jxaPath;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filutforsker-'));
  jxaPath = path.join(dir, 'cloud.js');
  fs.writeFileSync(jxaPath, JXA);
  return jxaPath;
}

function runJob(job) {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') return resolve(null);
    const script = ensureScript();
    const jobFile = path.join(path.dirname(script), `job-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(jobFile, JSON.stringify(job));
    execFile('/usr/bin/osascript', ['-l', 'JavaScript', script, jobFile],
      { maxBuffer: 64 * 1024 * 1024, timeout: 60000 },
      (err, stdout) => {
        fs.unlink(jobFile, () => {});
        if (err) return resolve(null);
        try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
      });
  });
}

// Oversett rådata til én tilstand som grensesnittet kan vise.
function classify(raw, fallback) {
  if (raw && !raw.err && raw.u) {
    if (raw.cf) return { state: 'conflict' };
    if (raw.de || raw.ue) return { state: 'error', message: raw.de || raw.ue };
    if (raw.dl) return { state: 'downloading' };
    if (raw.upl) return { state: 'uploading' };
    const notDl = raw.ds && /NotDownloaded/.test(raw.ds);
    if (raw.up === false && !notDl) return { state: 'pending' };
    if (notDl) return { state: 'online' };
    return { state: 'local', shared: !!raw.sh };
  }
  // Reserve: en fil i en skymappe som ikke bruker plass på disken er bare på nett.
  if (fallback && fallback.inCloud) {
    if (!fallback.isDir && fallback.size > 0 && fallback.blocks === 0) return { state: 'online' };
    return { state: 'local' };
  }
  return { state: 'none' };
}

async function statusFor(items) {
  // items: [{path, isDir, size, blocks}]
  const roots = cloudRoots();
  const result = {};
  const inCloud = items.filter(it => providerFor(it.path, roots));
  for (const it of items) if (!inCloud.includes(it)) result[it.path] = { state: 'none' };
  if (!inCloud.length) return result;
  const raw = {};
  for (let i = 0; i < inCloud.length; i += 400) {
    const chunk = inCloud.slice(i, i + 400);
    const r = await runJob({ action: 'status', paths: chunk.map(c => c.path) });
    if (r) Object.assign(raw, r);
  }
  for (const it of inCloud) {
    const prov = providerFor(it.path, roots);
    const c = classify(raw[it.path], { inCloud: true, isDir: it.isDir, size: it.size, blocks: it.blocks });
    result[it.path] = { ...c, provider: prov.id, providerLabel: prov.label };
  }
  return result;
}

async function walkFiles(paths, limit = 20000) {
  const out = [];
  async function walk(p) {
    if (out.length >= limit) return;
    let st;
    try { st = await fs.promises.lstat(p); } catch { return; }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      let names = [];
      try { names = await fs.promises.readdir(p); } catch { return; }
      for (const n of names) { if (!n.startsWith('.')) await walk(path.join(p, n)); }
    } else out.push(p);
  }
  for (const p of paths) await walk(p);
  return out;
}

async function download(paths) {
  const all = await walkFiles(paths);
  return (await runJob({ action: 'download', paths: all })) || { ok: 0, failed: [] };
}

async function evict(paths) {
  // Frigjør plass fil for fil (fungerer likt for iCloud og File Provider-tjenester).
  const files = await walkFiles(paths);
  return (await runJob({ action: 'evict', paths: files })) || { ok: 0, failed: [] };
}

module.exports = { cloudRoots, providerFor, statusFor, download, evict, ICLOUD, CLOUDSTORAGE };
