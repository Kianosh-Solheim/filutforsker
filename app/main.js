'use strict';
const { app, BrowserWindow, ipcMain, shell, nativeImage, Menu, clipboard, dialog, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const cloud = require('./cloud');
const photosort = require('./photosort');
const updater = require('./updater');

app.setName('Filutforsker');
const HOME = os.homedir();

// ---------- Vinduer ----------

function createWindow(startPath) {
  const win = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 720,
    minHeight: 460,
    title: 'Filutforsker',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202020' : '#f3f3f3',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { start: startPath || '' } });
  win.once('ready-to-show', () => {
    win.show();
    if (global.__fxBoot) global.__fxBoot.markGood();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  return win;
}

function send(cmd) {
  const w = BrowserWindow.getFocusedWindow();
  if (w) w.webContents.send('menu-cmd', cmd);
}

function buildMenu() {
  const item = (label, accelerator, cmd) => ({ label, accelerator, click: () => send(cmd) });
  const template = [
    {
      label: 'Filutforsker',
      submenu: [
        { role: 'about', label: 'Om Filutforsker' },
        item('Se etter oppdateringer …', undefined, 'check-updates'),
        { type: 'separator' },
        { role: 'hide', label: 'Skjul Filutforsker' },
        { role: 'hideOthers', label: 'Skjul andre' },
        { role: 'unhide', label: 'Vis alle' },
        { type: 'separator' },
        { role: 'quit', label: 'Avslutt Filutforsker' },
      ],
    },
    {
      label: 'Fil',
      submenu: [
        { label: 'Nytt vindu', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        item('Ny fane', 'CmdOrCtrl+T', 'new-tab'),
        item('Ny mappe', 'CmdOrCtrl+Shift+N', 'new-folder'),
        { type: 'separator' },
        item('Åpne', 'CmdOrCtrl+O', 'open'),
        item('Gi nytt navn (F2)', undefined, 'rename'),
        item('Flytt til papirkurven', 'CmdOrCtrl+Backspace', 'delete'),
        { type: 'separator' },
        item('Sorter bilder …', 'CmdOrCtrl+Shift+B', 'photo-sort'),
        { type: 'separator' },
        item('Lukk fane', 'CmdOrCtrl+W', 'close-tab'),
      ],
    },
    {
      label: 'Rediger',
      submenu: [
        { role: 'undo', label: 'Angre' },
        { role: 'redo', label: 'Gjør om' },
        { type: 'separator' },
        item('Klipp ut', 'CmdOrCtrl+X', 'cut'),
        item('Kopier', 'CmdOrCtrl+C', 'copy'),
        item('Lim inn', 'CmdOrCtrl+V', 'paste'),
        item('Merk alt', 'CmdOrCtrl+A', 'select-all'),
        { type: 'separator' },
        item('Søk', 'CmdOrCtrl+F', 'search'),
        item('Kopier bane', 'CmdOrCtrl+Alt+C', 'copy-path'),
      ],
    },
    {
      label: 'Vis',
      submenu: [
        item('Detaljer', 'CmdOrCtrl+1', 'view-details'),
        item('Liste', 'CmdOrCtrl+2', 'view-list'),
        item('Middels ikoner', 'CmdOrCtrl+3', 'view-medium'),
        item('Store ikoner', 'CmdOrCtrl+4', 'view-large'),
        { type: 'separator' },
        item('Detaljrute', 'CmdOrCtrl+Alt+P', 'toggle-details'),
        item('Skjulte filer', 'CmdOrCtrl+Shift+.', 'toggle-hidden'),
        { type: 'separator' },
        item('Oppdater', 'CmdOrCtrl+R', 'refresh'),
        { role: 'toggleDevTools', label: 'Utviklerverktøy', accelerator: 'Alt+CmdOrCtrl+I' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Fullskjerm' },
      ],
    },
    {
      label: 'Gå',
      submenu: [
        item('Tilbake', 'CmdOrCtrl+[', 'back'),
        item('Fremover', 'CmdOrCtrl+]', 'forward'),
        item('Opp ett nivå', 'CmdOrCtrl+Up', 'up'),
        { type: 'separator' },
        item('Hjem', 'CmdOrCtrl+Shift+H', 'go-home'),
        item('Gå til mappe …', 'CmdOrCtrl+L', 'focus-address'),
      ],
    },
    { role: 'windowMenu', label: 'Vindu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({ applicationName: 'Filutforsker', applicationVersion: updater.CURRENT, version: '', copyright: 'Kildekode: github.com/Kianosh-Solheim/filutforsker' });
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());

// ---------- Hjelpere ----------

function entryFrom(p, name, st, lst) {
  const isDir = st.isDirectory();
  return {
    name,
    path: p,
    isDir,
    isLink: lst ? lst.isSymbolicLink() : false,
    isApp: isDir && /\.app$/i.test(name),
    size: isDir ? null : st.size,
    blocks: st.blocks,
    mtime: st.mtimeMs,
    birth: st.birthtimeMs,
    hidden: name.startsWith('.'),
  };
}

async function statEntry(p) {
  const name = path.basename(p) || p;
  const lst = await fs.promises.lstat(p);
  let st = lst;
  if (lst.isSymbolicLink()) { try { st = await fs.promises.stat(p); } catch {} }
  return entryFrom(p, name, st, lst);
}

async function uniqueName(dir, name) {
  const ext = path.extname(name);
  const base = ext && name !== ext ? name.slice(0, -ext.length) : name;
  const e = ext && name !== ext ? ext : '';
  let candidate = path.join(dir, name), n = 2;
  while (true) {
    try { await fs.promises.access(candidate); } catch { return candidate; }
    candidate = path.join(dir, `${base} (${n})${e}`); n++;
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024, timeout: 20000, ...opts }, (err, stdout) => resolve(err && !stdout ? '' : String(stdout)));
  });
}

// ---------- IPC: plasseringer og lister ----------

ipcMain.handle('places', async () => {
  const q = (label, rel, icon) => ({ label, path: path.join(HOME, rel), icon });
  const quick = [
    { label: 'Hjem', path: HOME, icon: 'home' },
    q('Skrivebord', 'Desktop', 'desktop'),
    q('Dokumenter', 'Documents', 'documents'),
    q('Nedlastinger', 'Downloads', 'downloads'),
    q('Bilder', 'Pictures', 'pictures'),
    q('Filmer', 'Movies', 'videos'),
    q('Musikk', 'Music', 'music'),
  ];
  const allPhotos = photosort.DEST;
  try { if (fs.statSync(allPhotos).isDirectory()) quick.push({ label: 'All Photos', path: allPhotos, icon: 'pictures' }); } catch {}

  const clouds = cloud.cloudRoots().map(r => ({ label: r.label, path: r.path, icon: r.id, account: r.account || null }));

  const volumes = [{ label: 'Macintosh HD', path: '/', icon: 'drive' }, { label: 'Programmer', path: '/Applications', icon: 'apps' }];
  try {
    for (const v of fs.readdirSync('/Volumes')) {
      const p = path.join('/Volumes', v);
      try { if (fs.realpathSync(p) === '/') continue; } catch {}
      if (v.startsWith('.')) continue;
      volumes.push({ label: v, path: p, icon: 'usb' });
    }
  } catch {}
  return { home: HOME, quick, clouds, volumes };
});

ipcMain.handle('list', async (_e, dir) => {
  const ents = await fs.promises.readdir(dir, { withFileTypes: true });
  const out = [];
  await Promise.all(ents.map(async (d) => {
    const p = path.join(dir, d.name);
    try {
      const lst = await fs.promises.lstat(p);
      let st = lst;
      if (lst.isSymbolicLink()) { try { st = await fs.promises.stat(p); } catch {} }
      out.push(entryFrom(p, d.name, st, lst));
    } catch {}
  }));
  return out;
});

ipcMain.handle('stat', async (_e, p) => { try { return await statEntry(p); } catch { return null; } });

ipcMain.handle('exists', async (_e, p) => {
  try { return (await fs.promises.stat(p)).isDirectory() ? 'dir' : 'file'; } catch { return null; }
});

ipcMain.handle('cloud-status', async (_e, items) => cloud.statusFor(items));
ipcMain.handle('cloud-download', async (_e, paths) => cloud.download(paths));
ipcMain.handle('cloud-evict', async (_e, paths) => cloud.evict(paths));

ipcMain.handle('disk-info', async (_e, p) => {
  try {
    const s = await fs.promises.statfs(p || '/');
    return { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
  } catch { return null; }
});

// Begrens hvor mange bilder som lages samtidig, så systemet ikke overbelastes.
function limiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || !queue.length) return;
    active++;
    const { fn, resolve } = queue.shift();
    Promise.resolve().then(fn).catch(() => null).then((v) => { active--; resolve(v); next(); });
  };
  return (fn) => new Promise((resolve) => { queue.push({ fn, resolve }); next(); });
}
const thumbLimit = limiter(3);
const iconLimit = limiter(3);

const thumbCache = new Map();
ipcMain.handle('thumb', async (_e, p, size, mtime) => {
  const key = `${p}|${size}|${mtime}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const url = await thumbLimit(async () => {
    const img = await nativeImage.createThumbnailFromPath(p, { width: size, height: size });
    return img.isEmpty() ? null : img.toDataURL();
  });
  if (thumbCache.size > 3000) thumbCache.clear();
  thumbCache.set(key, url);
  return url;
});

// Programikoner: leses direkte fra programmets .icns-fil og gjøres om til PNG med macOS' eget
// verktøy (sips). Electrons app.getFileIcon krasjer når mange ikoner hentes samtidig.
const iconCache = new Map();
let iconDir = null;
async function findIcns(appPath) {
  const res = path.join(appPath, 'Contents', 'Resources');
  let name = '';
  const json = await run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Contents', 'Info.plist')]);
  try { const info = JSON.parse(json); name = info.CFBundleIconFile || info.CFBundleIconName || ''; } catch {}
  const candidates = [];
  if (name) candidates.push(/\.icns$/i.test(name) ? name : `${name}.icns`);
  candidates.push('AppIcon.icns');
  for (const c of candidates) {
    const p = path.join(res, c);
    try { await fs.promises.access(p); return p; } catch {}
  }
  try {
    const any = (await fs.promises.readdir(res)).find(f => /\.icns$/i.test(f));
    if (any) return path.join(res, any);
  } catch {}
  return null;
}
ipcMain.handle('file-icon', async (_e, p) => {
  if (iconCache.has(p)) return iconCache.get(p);
  const url = await iconLimit(async () => {
    if (process.platform !== 'darwin') return null;
    const icns = await findIcns(p);
    if (!icns) return null;
    if (!iconDir) { iconDir = path.join(app.getPath('userData'), 'icons'); await fs.promises.mkdir(iconDir, { recursive: true }); }
    const out = path.join(iconDir, `${require('crypto').createHash('sha1').update(icns).digest('hex')}.png`);
    try { await fs.promises.access(out); } catch {
      await run('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '128', icns, '--out', out]);
    }
    try { return `data:image/png;base64,${(await fs.promises.readFile(out)).toString('base64')}`; } catch { return null; }
  });
  iconCache.set(p, url);
  return url;
});

ipcMain.handle('search', async (_e, dir, query) => {
  if (!query) return [];
  let paths = [];
  if (process.platform === 'darwin') {
    const outp = await run('/usr/bin/mdfind', ['-onlyin', dir, '-name', query]);
    paths = outp.split('\n').filter(Boolean).slice(0, 1500);
  }
  if (!paths.length) {
    // Reserve (f.eks. mapper Spotlight ikke indekserer): enkel rekursiv navnesøk.
    const ql = query.toLowerCase();
    const stack = [dir];
    let visited = 0;
    while (stack.length && paths.length < 1500 && visited < 20000) {
      const d = stack.pop(); visited++;
      let ents = [];
      try { ents = await fs.promises.readdir(d, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(d, e.name);
        if (e.name.toLowerCase().includes(ql)) paths.push(p);
        if (e.isDirectory() && !e.name.endsWith('.app') && !e.name.endsWith('.photoslibrary')) stack.push(p);
      }
    }
  }
  const out = [];
  for (const p of paths) { try { out.push(await statEntry(p)); } catch {} }
  return out;
});

ipcMain.handle('recent', async () => {
  if (process.platform !== 'darwin') return [];
  const outp = await run('/usr/bin/mdfind', ['-onlyin', HOME, 'kMDItemLastUsedDate >= $time.today(-14) && kMDItemContentTypeTree != "public.folder"']);
  const paths = outp.split('\n').filter(p => p && !p.includes('/Library/') && !p.includes('/.')).slice(0, 400);
  const out = [];
  for (const p of paths) { try { const e = await statEntry(p); if (!e.isDir) out.push(e); } catch {} }
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, 40);
});

// ---------- IPC: filoperasjoner ----------

ipcMain.handle('open', async (_e, p) => shell.openPath(p));
ipcMain.handle('reveal', async (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('open-terminal', async (_e, p) => run('/usr/bin/open', ['-a', 'Terminal', p]));
ipcMain.handle('copy-text', async (_e, t) => clipboard.writeText(t));
ipcMain.handle('edit-action', async (e, a) => { if (['cut', 'copy', 'paste', 'selectAll'].includes(a)) e.sender[a](); });

ipcMain.handle('trash', async (_e, paths) => {
  const failed = [];
  for (const p of paths) { try { await shell.trashItem(p); } catch (e) { failed.push({ path: p, error: e.message }); } }
  return { failed };
});

ipcMain.handle('mkdir', async (_e, dir, name) => {
  const p = await uniqueName(dir, name || 'Ny mappe');
  await fs.promises.mkdir(p);
  return p;
});

ipcMain.handle('rename', async (_e, p, newName) => {
  if (!newName || /[/:]/.test(newName)) throw new Error('Ugyldig navn');
  const target = path.join(path.dirname(p), newName);
  if (target === p) return p;
  let exists = false;
  try { await fs.promises.access(target); exists = true; } catch {}
  if (exists && target.toLowerCase() !== p.toLowerCase()) throw new Error('Det finnes allerede et element med det navnet.');
  await fs.promises.rename(p, target);
  return target;
});

async function copyInto(srcs, destDir, move) {
  const results = { done: [], failed: [] };
  for (const src of srcs) {
    try {
      if (move && path.dirname(src) === destDir) continue;
      if ((destDir + path.sep).startsWith(src + path.sep)) throw new Error('Kan ikke legge en mappe inni seg selv.');
      const target = await uniqueName(destDir, path.basename(src));
      if (move) {
        try { await fs.promises.rename(src, target); }
        catch (e) {
          if (e.code !== 'EXDEV') throw e;
          await fs.promises.cp(src, target, { recursive: true, errorOnExist: true, preserveTimestamps: true });
          await shell.trashItem(src); // trygt: originalen havner i papirkurven, ikke slettet
        }
      } else {
        await fs.promises.cp(src, target, { recursive: true, errorOnExist: true, preserveTimestamps: true, verbatimSymlinks: true });
      }
      results.done.push(target);
    } catch (e) { results.failed.push({ path: src, error: e.message }); }
  }
  return results;
}
ipcMain.handle('copy-into', async (_e, srcs, destDir) => copyInto(srcs, destDir, false));
ipcMain.handle('move-into', async (_e, srcs, destDir) => copyInto(srcs, destDir, true));

// ---------- IPC: overvåking av mappe ----------

const watchers = new Map(); // webContents.id -> {watcher, dir}
ipcMain.handle('watch', async (e, dir) => {
  const id = e.sender.id;
  const old = watchers.get(id);
  if (old) { try { old.watcher.close(); } catch {} watchers.delete(id); }
  if (!dir) return;
  try {
    let t = null;
    const watcher = fs.watch(dir, () => {
      clearTimeout(t);
      t = setTimeout(() => { if (!e.sender.isDestroyed()) e.sender.send('dir-changed', dir); }, 350);
    });
    watcher.on('error', () => {});
    watchers.set(id, { watcher, dir });
    e.sender.once('destroyed', () => { try { watcher.close(); } catch {} watchers.delete(id); });
  } catch {}
});

// ---------- IPC: sorter bilder ----------

let lastScan = null;
ipcMain.handle('ps-scan', async (e, opts) => {
  lastScan = null;
  try {
    const r = await photosort.scan(opts, (p) => { if (!e.sender.isDestroyed()) e.sender.send('ps-progress', p); });
    lastScan = r.files;
    return { ...r, files: undefined, count: r.files.length };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle('ps-run', async (e, opts) => {
  if (!lastScan) return { error: 'Ingen skanning å bruke.' };
  const r = await photosort.run(lastScan, opts, (p) => { if (!e.sender.isDestroyed()) e.sender.send('ps-progress', p); });
  lastScan = null;
  return r;
});
ipcMain.handle('ps-cancel', async () => photosort.cancel());

// ---------- IPC: galleri ----------

ipcMain.handle('gallery-scan', async (e) => {
  try {
    const r = await photosort.scan({ scope: 'mac', includeDest: true }, (p) => { if (!e.sender.isDestroyed()) e.sender.send('gallery-progress', p); });
    return { files: r.files, dest: r.dest };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle('gallery-move', async (e, paths) => {
  const files = await photosort.describe(paths);
  return photosort.run(files, { includeOnline: true }, (p) => { if (!e.sender.isDestroyed()) e.sender.send('gallery-progress', p); });
});

ipcMain.handle('confirm', async (e, opts) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showMessageBox(win, { type: 'warning', buttons: opts.buttons || ['OK', 'Avbryt'], defaultId: 0, cancelId: 1, message: opts.message, detail: opts.detail || '' });
  return r.response;
});

// ---------- IPC: oppdateringer ----------

ipcMain.handle('app-info', async () => ({ version: updater.CURRENT, canUpdate: !!global.__fxBoot }));
ipcMain.handle('update-check', async () => {
  try { return await updater.check(); } catch (e) { return { error: e.message, current: updater.CURRENT }; }
});
ipcMain.handle('update-install', async (e) => {
  try {
    return await updater.install((p) => { if (!e.sender.isDestroyed()) e.sender.send('update-progress', p); });
  } catch (err) { return { error: err.message, needsDmg: err.needsDmg || null }; }
});
ipcMain.handle('update-restart', async () => updater.restart());
ipcMain.handle('open-external', async (_e, url) => {
  if (/^https:\/\/github\.com\/Kianosh-Solheim\/filutforsker\//.test(url)) await shell.openExternal(url);
});
