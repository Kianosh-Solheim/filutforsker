'use strict';
// Sorter bilder: samme regler som Photo Gatherer.
// Bilder og videoer flyttes til ~/All Photos/ÅÅÅÅ/MM etter opprettelsesdato.
// Duplikater (lik MD5) legges i All Photos/Duplicates. Ingenting slettes.
// Mappen, .hashes-filen og move-log.txt er kompatible med Photo Gatherer,
// så begge kan brukes om hverandre uten at noe dobles.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const cloud = require('./cloud');

const HOME = os.homedir();
const DEST = path.join(HOME, 'All Photos');
const EXT = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'gif', 'tif', 'tiff', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'webp', 'bmp',
  'mov', 'mp4', 'm4v', 'avi', '3gp', 'mts']);

let cancelled = false;
function cancel() { cancelled = true; }

function isMedia(name) {
  const i = name.lastIndexOf('.');
  return i > 0 && EXT.has(name.slice(i + 1).toLowerCase());
}

function shouldSkipDir(p, name, roots, includeDest) {
  if (name.startsWith('.')) return true;
  if (name.endsWith('.photoslibrary') || name.endsWith('.app') || name.endsWith('.photolibrary')) return true;
  if (p === DEST && !includeDest) return true;
  const lib = path.join(HOME, 'Library');
  if (p === lib) return true; // skytjenestene i Library legges til som egne startpunkter
  if (p.startsWith(lib + path.sep) && !roots.some(r => p === r.path || p.startsWith(r.path + path.sep))) return true;
  return false;
}

// ---------- Skanning ----------

async function scan(opts, onProgress) {
  cancelled = false;
  const roots = cloud.cloudRoots();
  let starts;
  if (opts.scope === 'mac') {
    starts = [...new Set([HOME, ...roots.map(r => r.path)])];
  } else {
    starts = [opts.dir];
  }
  const files = [];
  const folders = new Set();
  let seen = 0;
  const stack = [...starts];
  const visited = new Set();
  while (stack.length) {
    if (cancelled) throw new Error('avbrutt');
    const dir = stack.pop();
    if (visited.has(dir)) continue;
    visited.add(dir);
    let ents;
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!shouldSkipDir(p, e.name, roots, opts.includeDest)) stack.push(p);
      } else if (e.isFile() && !e.name.startsWith('.') && isMedia(e.name)) {
        const inDest = p.startsWith(DEST + path.sep);
        if (inDest && !opts.includeDest) continue;
        let st;
        try { st = await fs.promises.stat(p); } catch { continue; }
        const prov = cloud.providerFor(p, roots);
        const onlineOnly = !!prov && st.size > 0 && st.blocks === 0;
        files.push({ path: p, name: e.name, size: st.size, blocks: st.blocks, birth: st.birthtimeMs, mtime: st.mtimeMs, provider: prov ? prov.label : null, onlineOnly, moved: inDest });
        folders.add(dir);
      }
      if (++seen % 500 === 0) onProgress && onProgress({ phase: 'scan', found: files.length, dir });
    }
  }
  const byProvider = {};
  let onlineOnly = 0, bytes = 0, onlineBytes = 0;
  for (const f of files) {
    const key = f.provider || 'Denne Macen';
    byProvider[key] = (byProvider[key] || 0) + 1;
    if (f.onlineOnly) { onlineOnly++; onlineBytes += f.size; }
    bytes += f.size;
  }
  return { files, folders: folders.size, byProvider, onlineOnly, onlineBytes, bytes, dest: DEST };
}

// ---------- Datoer ----------

function mdlsDates(paths) {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin' || !paths.length) return resolve(paths.map(() => null));
    execFile('/usr/bin/mdls', ['-raw', '-name', 'kMDItemContentCreationDate', ...paths],
      { maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
        if (err && !stdout) return resolve(paths.map(() => null));
        const parts = String(stdout).split('\0');
        resolve(paths.map((_, i) => {
          const v = (parts[i] || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
          const d = new Date(v.replace(' ', 'T').replace(' +0000', 'Z').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'));
          return isNaN(d) ? null : d;
        }));
      });
  });
}

function ym(d) {
  return [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0')];
}

// ---------- Flytting ----------

function md5(file) {
  return new Promise((resolve) => {
    const h = crypto.createHash('md5');
    const s = fs.createReadStream(file);
    s.on('data', d => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', () => resolve(null));
  });
}

async function uniqueTarget(dir, name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let out = path.join(dir, name), i = 1;
  while (true) {
    try { await fs.promises.access(out); } catch { return out; }
    out = path.join(dir, `${base}_${i}${ext}`); i++;
  }
}

async function moveFile(src, dst) {
  try {
    await fs.promises.rename(src, dst);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    await fs.promises.copyFile(src, dst, fs.constants.COPYFILE_EXCL);
    const a = await fs.promises.stat(src), b = await fs.promises.stat(dst);
    if (a.size !== b.size) throw new Error('kopien ble ufullstendig');
    await fs.promises.unlink(src);
  }
}

// Lag fil-objekter for enkeltfiler valgt i galleriet.
async function describe(paths) {
  const roots = cloud.cloudRoots();
  const out = [];
  for (const p of paths) {
    try {
      const st = await fs.promises.stat(p);
      if (!st.isFile() || p.startsWith(DEST + path.sep)) continue;
      const prov = cloud.providerFor(p, roots);
      out.push({ path: p, size: st.size, birth: st.birthtimeMs, mtime: st.mtimeMs, provider: prov ? prov.label : null, onlineOnly: !!prov && st.size > 0 && st.blocks === 0 });
    } catch {}
  }
  return out;
}

async function run(files, opts, onProgress) {
  cancelled = false;
  await fs.promises.mkdir(path.join(DEST, 'Duplicates'), { recursive: true });
  const hashFile = path.join(DEST, '.hashes');
  const logFile = path.join(DEST, 'move-log.txt');
  let known = new Set();
  try { known = new Set((await fs.promises.readFile(hashFile, 'utf8')).split('\n').map(s => s.trim()).filter(Boolean)); } catch {}

  const todo = files.filter(f => opts.includeOnline || !f.onlineOnly);
  let moved = 0, dups = 0, failed = [], skipped = files.length - todo.length;
  const moves = [];
  const BATCH = 100;
  for (let i = 0; i < todo.length; i += BATCH) {
    if (cancelled) break;
    const batch = todo.slice(i, i + BATCH);
    const dates = await mdlsDates(batch.map(f => f.path));
    for (let j = 0; j < batch.length; j++) {
      if (cancelled) break;
      const f = batch[j];
      onProgress && onProgress({ phase: 'move', done: i + j, total: todo.length, file: f.path });
      try {
        await fs.promises.access(f.path);
        // Spotlight-datoen (når bildet ble tatt) først; ellers den eldste av opprettet/endret,
        // siden kopiering ofte nullstiller opprettelsesdatoen.
        const fsDates = [f.birth, f.mtime].filter(x => x && x > 0);
        const d = dates[j] || new Date(fsDates.length ? Math.min(...fsDates) : Date.now());
        const h = await md5(f.path); // leser fila, så skyfiler lastes ned før flytting
        let targetDir;
        if (h && known.has(h)) { targetDir = path.join(DEST, 'Duplicates'); dups++; }
        else {
          const [y, m] = ym(d);
          targetDir = path.join(DEST, y, m);
          if (h) { known.add(h); await fs.promises.appendFile(hashFile, h + '\n'); }
        }
        await fs.promises.mkdir(targetDir, { recursive: true });
        const out = await uniqueTarget(targetDir, path.basename(f.path));
        await moveFile(f.path, out);
        await fs.promises.appendFile(logFile, `${f.path} -> ${out}\n`);
        moves.push({ from: f.path, to: out });
        moved++;
      } catch (e) {
        failed.push({ path: f.path, error: e.message });
      }
    }
  }
  onProgress && onProgress({ phase: 'move', done: todo.length, total: todo.length });
  return { moved, dups, failed, skipped, cancelled, moves, dest: DEST };
}

module.exports = { scan, run, describe, cancel, DEST, isMedia };
