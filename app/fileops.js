'use strict';
// Kopier, flytt og flytt til papirkurven med fremdrift og mulighet til å avbryte.
//
// Kopiering bruker macOS' egen copyfile (via fs.copyFile), som tar med metadata og
// kloner filer øyeblikkelig på samme APFS-disk. Store filer til en annen disk kopieres
// med /usr/bin/ditto, slik at de kan avbrytes midt i. Fremdriften innenfor en stor fil
// måles ved å se hvor stor målfila har blitt.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BIG = 32 * 1024 * 1024;
const MAX_FAILED = 200;
const jobs = new Map();

class Cancelled extends Error {
  constructor() { super('Avbrutt'); this.cancelled = true; }
}

function active() { return jobs.size; }

function cancel(id) {
  const j = jobs.get(id);
  if (!j) return;
  j.cancelled = true;
  if (j.child) { try { j.child.kill('SIGTERM'); } catch {} }
}

async function uniqueName(dir, name) {
  const ext = path.extname(name);
  const base = ext && name !== ext ? name.slice(0, -ext.length) : name;
  const e = ext && name !== ext ? ext : '';
  let candidate = path.join(dir, name), n = 2;
  for (;;) {
    try { await fs.promises.lstat(candidate); } catch { return candidate; }
    candidate = path.join(dir, `${base} (${n})${e}`); n++;
  }
}

function fail(job, p, err) {
  if (job.failed.length < MAX_FAILED) job.failed.push({ path: p, error: err && err.message ? err.message : String(err) });
  else job.moreFailed++;
}

// ---------- Kartlegging ----------

async function scanTree(src, job) {
  if (job.cancelled) throw new Cancelled();
  const st = await fs.promises.lstat(src);
  if (st.isSymbolicLink()) {
    job.totalFiles++;
    return { src, type: 'link', st, link: await fs.promises.readlink(src) };
  }
  if (st.isDirectory()) {
    let names = [];
    try { names = await fs.promises.readdir(src); } catch (e) { fail(job, src, e); }
    const children = [];
    for (const n of names) {
      try { children.push(await scanTree(path.join(src, n), job)); }
      catch (e) { if (e.cancelled) throw e; fail(job, path.join(src, n), e); }
    }
    job.report();
    return { src, type: 'dir', st, children };
  }
  job.totalFiles++;
  job.totalBytes += st.size;
  return { src, type: 'file', st, cloudOnly: st.size > 0 && st.blocks === 0 };
}

// ---------- Kopiering ----------

function pollSize(dst, job) {
  return setInterval(() => {
    fs.stat(dst, (err, st) => {
      if (!err) { job.fileBytes = st.size; job.report(); }
    });
  }, 200);
}

async function copyFile(node, dst, job, sameDev) {
  if (job.cancelled) throw new Cancelled();
  job.current = path.basename(node.src);
  job.currentCloud = node.cloudOnly;
  job.fileBytes = 0;
  job.report(true);
  const size = node.st.size;
  const timer = size >= 1024 * 1024 ? pollSize(dst, job) : null;
  try {
    if (process.platform === 'darwin' && size >= BIG && !sameDev) {
      await new Promise((resolve, reject) => {
        const child = spawn('/usr/bin/ditto', [node.src, dst]);
        job.child = child;
        let err = '';
        child.stderr.on('data', (d) => { err += d; });
        child.on('error', reject);
        child.on('close', (code) => {
          job.child = null;
          if (job.cancelled) reject(new Cancelled());
          else if (code === 0) resolve();
          else reject(new Error(err.trim() || `ditto avsluttet med kode ${code}`));
        });
      });
    } else {
      await fs.promises.copyFile(node.src, dst, fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE);
    }
    try { await fs.promises.utimes(dst, node.st.atime, node.st.mtime); } catch {}
  } catch (e) {
    await fs.promises.rm(dst, { force: true }).catch(() => {});
    throw e;
  } finally {
    if (timer) clearInterval(timer);
  }
  job.fileBytes = 0;
  job.doneBytes += size;
  job.doneFiles++;
  job.report();
  if (job.cancelled) throw new Cancelled();
}

async function copyNode(node, dst, job, sameDev) {
  if (job.cancelled) throw new Cancelled();
  if (node.type === 'dir') {
    await fs.promises.mkdir(dst, { mode: node.st.mode & 0o7777 });
    for (const child of node.children) {
      const target = path.join(dst, path.basename(child.src));
      try { await copyNode(child, target, job, sameDev); }
      catch (e) { if (e.cancelled) throw e; fail(job, child.src, e); }
    }
    try { await fs.promises.utimes(dst, node.st.atime, node.st.mtime); } catch {}
    return;
  }
  if (node.type === 'link') {
    await fs.promises.symlink(node.link, dst);
    job.doneFiles++;
    job.report();
    return;
  }
  await copyFile(node, dst, job, sameDev);
}

// ---------- Hovedfunksjon ----------

// kind: 'copy' | 'move' | 'trash'. trashItem: (path) => Promise (Electrons shell.trashItem).
async function run({ id, kind, srcs, destDir }, { trashItem, onProgress }) {
  const job = {
    id, kind, cancelled: false, child: null,
    phase: kind === 'trash' ? 'trash' : 'scan',
    totalBytes: 0, doneBytes: 0, fileBytes: 0, totalFiles: 0, doneFiles: 0,
    items: srcs.length, itemsDone: 0,
    current: '', currentCloud: false,
    done: [], failed: [], moreFailed: 0,
    lastReport: 0,
  };
  job.report = (force) => {
    const now = Date.now();
    if (!force && now - job.lastReport < 100) return;
    job.lastReport = now;
    onProgress && onProgress({
      id, kind, phase: job.phase,
      totalBytes: job.totalBytes, doneBytes: job.doneBytes + job.fileBytes,
      totalFiles: job.totalFiles, doneFiles: job.doneFiles,
      items: job.items, itemsDone: job.itemsDone,
      current: job.current, currentCloud: job.currentCloud,
      cancelling: job.cancelled,
    });
  };
  jobs.set(id, job);

  try {
    if (kind === 'trash') {
      job.totalFiles = srcs.length;
      for (const src of srcs) {
        if (job.cancelled) break;
        job.current = path.basename(src);
        job.report(true);
        try { await trashItem(src); job.done.push(src); } catch (e) { fail(job, src, e); }
        job.doneFiles++;
        job.itemsDone++;
        job.report();
      }
      return finish(job);
    }

    const destSt = await fs.promises.stat(destDir);
    const toCopy = [];
    for (const src of srcs) {
      if (job.cancelled) break;
      try {
        if (kind === 'move' && path.dirname(src) === destDir) { job.itemsDone++; continue; }
        if ((destDir + path.sep).startsWith(src + path.sep)) throw new Error('Kan ikke legge en mappe inni seg selv.');
        const target = await uniqueName(destDir, path.basename(src));
        if (kind === 'move') {
          try {
            await fs.promises.rename(src, target);
            job.done.push(target);
            job.itemsDone++;
            continue;
          } catch (e) { if (e.code !== 'EXDEV') throw e; }
        }
        toCopy.push({ src, target });
      } catch (e) { fail(job, src, e); job.itemsDone++; }
    }

    // Kartlegg det som må kopieres
    job.phase = 'scan';
    job.report(true);
    for (const t of toCopy) {
      if (job.cancelled) break;
      const before = job.failed.length + job.moreFailed;
      try { t.tree = await scanTree(t.src, job); }
      catch (e) { if (e.cancelled) break; fail(job, t.src, e); }
      t.scanErrors = job.failed.length + job.moreFailed - before;
    }

    job.phase = 'copy';
    job.report(true);
    for (const t of toCopy) {
      if (job.cancelled) break;
      if (!t.tree) { job.itemsDone++; continue; }
      const failedBefore = job.failed.length + job.moreFailed;
      try {
        await copyNode(t.tree, t.target, job, t.tree.st.dev === destSt.dev);
        const clean = !t.scanErrors && job.failed.length + job.moreFailed === failedBefore;
        if (kind === 'move') {
          // Originalen fjernes bare når alt er kopiert uten feil, og havner i papirkurven.
          if (clean) await trashItem(t.src);
          else fail(job, t.src, new Error('Noen filer kunne ikke kopieres, så originalen ble beholdt.'));
        }
        job.done.push(t.target);
      } catch (e) {
        if (e.cancelled) {
          // Fjern det halvferdige elementet; ferdige elementer beholdes.
          await fs.promises.rm(t.target, { recursive: true, force: true }).catch(() => {});
          break;
        }
        fail(job, t.src, e);
      }
      job.itemsDone++;
      job.report();
    }
    return finish(job);
  } finally {
    jobs.delete(id);
  }
}

function finish(job) {
  job.phase = 'done';
  job.report(true);
  return { done: job.done, failed: job.failed, moreFailed: job.moreFailed, cancelled: job.cancelled, itemsDone: job.itemsDone, items: job.items };
}

module.exports = { run, cancel, active, uniqueName };
