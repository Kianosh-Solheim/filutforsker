'use strict';
/* Filutforsker – grensesnitt */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const svg = (str) => { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content.firstChild; };
const ic = (name) => svg(ICONS.cmd[name]);

const collator = new Intl.Collator('nb', { numeric: true, sensitivity: 'base' });
const dtf = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
const dtfLong = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long', timeStyle: 'short' });
const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });

function fmtSize(b) {
  if (b == null) return '';
  if (b < 1024) return `${b} byte`;
  const u = ['kB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${nf.format(b < 10 ? Math.round(b * 10) / 10 : Math.round(b))} ${u[i]}`;
}
const fmtDate = (ms) => (ms ? dtf.format(new Date(ms)) : '');
const plural = (n, one, many) => `${n.toLocaleString('nb-NO')} ${n === 1 ? one : many}`;
const basename = (p) => p === '/' ? 'Macintosh HD' : p.replace(/\/+$/, '').split('/').pop();
const dirname = (p) => { const s = p.replace(/\/+$/, ''); const i = s.lastIndexOf('/'); return i <= 0 ? '/' : s.slice(0, i); };
const join = (a, b) => (a.endsWith('/') ? a + b : `${a}/${b}`);
const cleanErr = (e) => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

// ---------- Filtyper ----------

const KIND = {
  image: 'jpg jpeg png gif heic heif webp bmp tif tiff svg raw dng cr2 cr3 nef arw raf orf rw2 ico psd',
  video: 'mov mp4 m4v avi mkv webm wmv 3gp mts mpg mpeg',
  audio: 'mp3 m4a aac wav aiff aif flac ogg wma m4b',
  pdf: 'pdf',
  word: 'doc docx rtf odt dotx',
  excel: 'xls xlsx csv ods xlsm',
  ppt: 'ppt pptx odp key-ppt',
  pages: 'pages', numbers: 'numbers', keynote: 'key',
  archive: 'zip rar 7z tar gz tgz bz2 xz dmg iso pkg',
  code: 'js ts json py html css xml sh c cpp h swift java rb go rs php yml yaml toml',
  text: 'txt md log ini cfg conf epub',
};
const EXT_KIND = {};
for (const [k, v] of Object.entries(KIND)) for (const e of v.split(' ')) EXT_KIND[e] = k;
const extOf = (name) => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };
function kindOf(it) {
  if (it.isApp) return 'app';
  if (it.isDir) return 'folder';
  return EXT_KIND[extOf(it.name)] || 'file';
}
const TYPE_NAMES = {
  jpg: 'JPEG-bilde', jpeg: 'JPEG-bilde', png: 'PNG-bilde', gif: 'GIF-bilde', heic: 'HEIC-bilde', heif: 'HEIF-bilde', webp: 'WebP-bilde',
  tif: 'TIFF-bilde', tiff: 'TIFF-bilde', svg: 'SVG-bilde', dng: 'RAW-bilde (DNG)', cr2: 'RAW-bilde (Canon)', cr3: 'RAW-bilde (Canon)',
  nef: 'RAW-bilde (Nikon)', arw: 'RAW-bilde (Sony)', psd: 'Photoshop-bilde', bmp: 'BMP-bilde',
  mov: 'QuickTime-video', mp4: 'MP4-video', m4v: 'MP4-video', avi: 'AVI-video', mkv: 'MKV-video',
  mp3: 'MP3-lyd', m4a: 'AAC-lyd', wav: 'WAV-lyd', aiff: 'AIFF-lyd', flac: 'FLAC-lyd',
  pdf: 'PDF-dokument', doc: 'Word-dokument', docx: 'Word-dokument', rtf: 'RTF-dokument', odt: 'OpenDocument-tekst',
  xls: 'Excel-regneark', xlsx: 'Excel-regneark', csv: 'CSV-fil', ppt: 'PowerPoint-presentasjon', pptx: 'PowerPoint-presentasjon',
  pages: 'Pages-dokument', numbers: 'Numbers-regneark', key: 'Keynote-presentasjon',
  zip: 'ZIP-arkiv', rar: 'RAR-arkiv', '7z': '7-Zip-arkiv', dmg: 'Diskbilde', pkg: 'Installasjonspakke', iso: 'Diskbilde',
  txt: 'Tekstdokument', md: 'Markdown-dokument', epub: 'E-bok (EPUB)', html: 'HTML-dokument', json: 'JSON-fil',
};
function typeName(it) {
  if (it.isApp) return 'Program';
  if (it.isDir) return 'Filmappe';
  const e = extOf(it.name);
  return TYPE_NAMES[e] || (e ? `${e.toUpperCase()}-fil` : 'Fil');
}
const THUMBABLE = new Set(['image', 'video', 'pdf', 'word', 'excel', 'ppt', 'pages', 'numbers', 'keynote', 'text']);

// ---------- Skystatus ----------

const STATUS_INFO = {
  online: { icon: 'online', text: 'Kun på nett', long: 'Tilgjengelig når du er på nett. Tar ikke plass på Macen.' },
  local: { icon: 'local', text: 'På denne Macen', long: 'Lastet ned og tilgjengelig uten nett. Synkronisert med skyen.' },
  downloading: { icon: 'sync', text: 'Laster ned …', long: 'Lastes ned fra skyen nå.' },
  uploading: { icon: 'sync', text: 'Laster opp …', long: 'Lastes opp til skyen nå.' },
  pending: { icon: 'sync', text: 'Venter på synkronisering', long: 'Endringer venter på å bli lastet opp.' },
  error: { icon: 'error', text: 'Synkroniseringsfeil', long: 'Kunne ikke synkronisere.' },
  conflict: { icon: 'conflict', text: 'Konflikt', long: 'Det finnes motstridende versjoner av denne filen.' },
};
const statusSvg = (state) => STATUS_INFO[state] ? svg(ICONS.status[STATUS_INFO[state].icon]) : null;

// ---------- Tilstand ----------

const LS = {
  get(k, d) { try { const v = localStorage.getItem('fx.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fx.' + k, JSON.stringify(v)); } catch {} },
};

const S = {
  places: { home: '', quick: [], clouds: [], volumes: [] },
  tabs: [],
  active: 0,
  view: LS.get('view', 'details'),
  showHidden: LS.get('showHidden', false),
  detailsPane: LS.get('detailsPane', false),
  cols: LS.get('cols', { name: 340, status: 170, mtime: 150, type: 160, size: 100 }),
  groupFolders: true,
  clip: null, // {mode, paths}
  collapsed: LS.get('collapsed', {}),
};
let tabSeq = 1;
const VIRTUAL = new Set(['start:', 'gallery:']);
const isVirtual = (loc) => VIRTUAL.has(loc);
const tab = () => S.tabs[S.active];

function newTabState(loc) {
  return { id: tabSeq++, loc, hist: [loc], idx: 0, items: [], sel: new Set(), focus: null, anchor: null, cloud: {}, sortKey: 'name', sortDir: 1, search: null, error: null, loading: false };
}

// ---------- Hjelpere for plasseringer ----------

function cloudRootOf(p) {
  let best = null;
  for (const c of S.places.clouds) if (p === c.path || p.startsWith(c.path + '/')) if (!best || c.path.length > best.path.length) best = c;
  return best;
}
function locLabel(loc) {
  if (loc === 'start:') return 'Start';
  if (loc === 'gallery:') return 'Galleri';
  const c = S.places.clouds.find(c => c.path === loc);
  if (c) return c.label;
  if (loc === S.places.home) return basename(loc);
  return basename(loc);
}
function locIcon(loc) {
  if (loc === 'start:') return ICONS.sidebar.start;
  if (loc === 'gallery:') return ICONS.sidebar.pictures;
  const c = S.places.clouds.find(c => c.path === loc);
  if (c) return ICONS.providerIcon(c.icon);
  const q = S.places.quick.find(q => q.path === loc);
  if (q) return ICONS.sidebar[q.icon] || ICONS.kinds.folder;
  if (loc === '/') return ICONS.sidebar.drive;
  return ICONS.kinds.folder;
}

// ---------- Navigasjon ----------

async function navigate(loc, { push = true, t = tab() } = {}) {
  if (!loc) return;
  if (!isVirtual(loc)) {
    loc = loc.replace(/^~(?=\/|$)/, S.places.home);
    if (loc.length > 1) loc = loc.replace(/\/+$/, '');
    const kind = await fx.exists(loc);
    if (kind !== 'dir') {
      if (kind === 'file') { fx.open(loc); return; }
      toast(`Fant ikke «${loc}».`, 'error');
      return;
    }
  }
  if (push && t.loc !== loc) {
    t.hist = t.hist.slice(0, t.idx + 1);
    t.hist.push(loc);
    t.idx = t.hist.length - 1;
  }
  t.loc = loc;
  t.search = null;
  t.sel.clear(); t.focus = null; t.anchor = null;
  $('#search-input').value = '';
  $('#searchbox').classList.remove('has-text');
  await load(t);
}

async function load(t = tab(), { keepSel = false } = {}) {
  t.error = null;
  if (t.loc === 'gallery:') {
    t.items = galleryVisible();
    t.cloud = {};
    fx.watch(null);
    if (t === tab()) render();
    if (!S.gallery.items && !S.gallery.scanning) startGalleryScan();
    return;
  }
  if (t.loc === 'start:') {
    t.items = [];
    fx.watch(null);
    if (t === tab()) render();
    return;
  }
  t.loading = true;
  try {
    t.items = await fx.list(t.loc);
  } catch (e) {
    t.items = [];
    t.error = /EPERM|EACCES/.test(String(e))
      ? 'Filutforsker har ikke tilgang til denne mappen. Gi tilgang i Systeminnstillinger › Personvern og sikkerhet › Filer og mapper.'
      : `Kunne ikke åpne mappen: ${cleanErr(e)}`;
  }
  t.loading = false;
  if (!keepSel) { t.sel.clear(); t.focus = null; }
  else {
    const paths = new Set(t.items.map(i => i.path));
    for (const p of [...t.sel]) if (!paths.has(p)) t.sel.delete(p);
  }
  if (t === tab()) {
    fx.watch(t.loc);
    render();
    if (!keepSel) $('#view').scrollTop = 0;
  }
  refreshCloud(t);
}

let cloudTimer = null;
async function refreshCloud(t = tab()) {
  clearTimeout(cloudTimer);
  if (isVirtual(t.loc)) return;
  const list = t.search ? t.search.results : t.items;
  const inCloud = list.filter(i => cloudRootOf(i.path));
  if (!inCloud.length) { t.cloud = {}; if (t === tab()) { updateStatusCells(); updateStatusBar(); updateCommandBar(); } return; }
  const loc = t.loc;
  const res = await fx.cloudStatus(inCloud.slice(0, 3000).map(i => ({ path: i.path, isDir: i.isDir, size: i.size, blocks: i.blocks })));
  if (t.loc !== loc) return;
  t.cloud = res || {};
  if (t === tab()) { updateStatusCells(); updateStatusBar(); updateCommandBar(); updateDetailsPane(); }
  const busy = Object.values(t.cloud).some(s => ['downloading', 'uploading', 'pending'].includes(s.state));
  cloudTimer = setTimeout(async () => {
    if (t !== tab() || t.loc !== loc) return;
    if (busy && !t.search) {
      // Oppdater størrelser/blokker også, slik at reservestatusen stemmer.
      try { t.items = await fx.list(t.loc); } catch {}
      renderView();
    }
    refreshCloud(t);
  }, busy ? 2500 : 12000);
}

function goBack() { const t = tab(); if (t.idx > 0) { t.idx--; navigate(t.hist[t.idx], { push: false }); } }
function goForward() { const t = tab(); if (t.idx < t.hist.length - 1) { t.idx++; navigate(t.hist[t.idx], { push: false }); } }
function goUp() {
  const t = tab();
  if (t.loc === 'start:' || t.loc === '/') return;
  if (t.loc === 'gallery:') return navigate('start:');
  const c = S.places.clouds.find(c => c.path === t.loc);
  if (c) return navigate('start:');
  const prev = t.loc;
  navigate(dirname(t.loc)).then(() => selectOnly(prev));
}

// ---------- Visningsliste ----------

function visibleItems(t = tab()) {
  let list = t.search ? t.search.results : t.items;
  if (!S.showHidden) list = list.filter(i => !i.hidden && !/^(Icon\r|\.DS_Store|desktop\.ini)$/.test(i.name));
  const dir = t.sortDir;
  const key = t.sortKey;
  const st = (i) => { const s = t.cloud[i.path]; return s ? ['online', 'local', 'downloading', 'uploading', 'pending', 'conflict', 'error', 'none'].indexOf(s.state) : 99; };
  const cmp = {
    name: (a, b) => collator.compare(a.name, b.name),
    mtime: (a, b) => a.mtime - b.mtime,
    type: (a, b) => collator.compare(typeName(a), typeName(b)) || collator.compare(a.name, b.name),
    size: (a, b) => (a.size || 0) - (b.size || 0),
    status: (a, b) => st(a) - st(b) || collator.compare(a.name, b.name),
    folder: (a, b) => collator.compare(a.path, b.path),
  }[key] || ((a, b) => collator.compare(a.name, b.name));
  return [...list].sort((a, b) => {
    if (S.groupFolders && a.isDir !== b.isDir && !a.isApp && !b.isApp) return a.isDir ? -1 : 1;
    return cmp(a, b) * dir;
  });
}

// ---------- Gjengivelse ----------

function render() {
  renderTabs();
  renderNav();
  renderSidebarActive();
  updateCommandBar();
  renderView();
  updateStatusBar();
  $('#details-pane').hidden = !S.detailsPane;
  $('#btn-details').classList.toggle('on', S.detailsPane);
  updateDetailsPane();
  document.title = locLabel(tab().loc);
}

function renderTabs() {
  const box = $('#tabs');
  box.innerHTML = '';
  S.tabs.forEach((t, i) => {
    const title = t.search ? `Søk: ${t.search.q}` : locLabel(t.loc);
    const el = h('div', { class: 'tab' + (i === S.active ? ' active' : ''), role: 'tab', title: t.loc === 'start:' ? 'Start' : t.loc },
      h('span', { class: 'tab-icon', html: t.search ? ICONS.sidebar.search : locIcon(t.loc) }),
      h('span', { class: 'tab-title' }, title),
      h('button', { class: 'tab-close', title: 'Lukk fane (⌘W)', onclick: (e) => { e.stopPropagation(); closeTab(i); } }, ic('close')));
    el.addEventListener('mousedown', (e) => { if (e.button === 0 && i !== S.active) switchTab(i); });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(i); });
    box.append(el);
  });
}

function switchTab(i) {
  S.active = i;
  const t = tab();
  $('#search-input').value = t.search ? t.search.q : '';
  $('#searchbox').classList.toggle('has-text', !!t.search);
  fx.watch(isVirtual(t.loc) ? null : t.loc);
  render();
  load(t, { keepSel: true });
}
function addTab(loc = 'start:') {
  S.tabs.push(newTabState(loc));
  S.active = S.tabs.length - 1;
  navigate(loc, { push: false });
}
function closeTab(i = S.active) {
  if (S.tabs.length === 1) { window.close(); return; }
  S.tabs.splice(i, 1);
  if (S.active >= S.tabs.length) S.active = S.tabs.length - 1;
  else if (i < S.active) S.active--;
  switchTab(S.active);
}

function renderNav() {
  const t = tab();
  $('#btn-back').disabled = t.idx <= 0;
  $('#btn-forward').disabled = t.idx >= t.hist.length - 1;
  $('#btn-up').disabled = t.loc === 'start:' || t.loc === '/';
  const placeholder = t.loc === 'start:' ? 'Søk' : t.loc === 'gallery:' ? 'Søk i bilder og mapper' : `Søk i ${locLabel(t.loc)}`;
  $('#search-input').placeholder = placeholder;
  renderCrumbs();
}

function crumbSegments(loc) {
  if (loc === 'start:') return [{ label: 'Start', path: 'start:' }];
  if (loc === 'gallery:') return [{ label: 'Galleri', path: 'gallery:' }];
  const segs = [];
  const c = cloudRootOf(loc);
  let base, rest;
  if (c) { base = c.path; segs.push({ label: c.label, path: c.path }); }
  else if (loc === S.places.home || loc.startsWith(S.places.home + '/')) { base = S.places.home; segs.push({ label: basename(S.places.home), path: base }); }
  else { base = '/'; segs.push({ label: 'Macintosh HD', path: '/' }); }
  rest = loc.slice(base.length).split('/').filter(Boolean);
  let acc = base;
  for (const r of rest) { acc = join(acc, r); segs.push({ label: r, path: acc }); }
  return segs;
}

function renderCrumbs() {
  const t = tab();
  const box = $('#crumbs');
  box.innerHTML = '';
  box.append(h('span', { class: 'crumb-root', html: t.search ? ICONS.sidebar.search : locIcon(t.loc === 'start:' ? 'start:' : (cloudRootOf(t.loc)?.path || t.loc)) }));
  let segs = crumbSegments(t.loc);
  if (t.search) segs = [...segs, { label: `Søkeresultater for «${t.search.q}»`, path: null }];
  const sepBtn = (p) => {
    const b = h('button', { class: 'crumb-sep', title: 'Vis undermapper' }, ic('chevron'));
    b.addEventListener('click', (e) => { e.stopPropagation(); subfolderMenu(p, b); });
    return b;
  };
  if (t.loc !== 'start:') box.append(h('button', { class: 'crumb', onclick: () => navigate('start:') }, 'Start'), sepBtn(null));
  segs.forEach((s, i) => {
    const b = h('button', { class: 'crumb', dataset: s.path ? { path: s.path } : {} }, s.label);
    if (s.path) {
      b.addEventListener('click', (e) => { e.stopPropagation(); navigate(s.path); });
      if (!isVirtual(s.path)) makeDropTarget(b, () => s.path);
    }
    box.append(b);
    if (i < segs.length - 1 || (s.path && !isVirtual(s.path) && !t.search)) box.append(sepBtn(s.path));
  });
  box.append(h('div', { class: 'crumb-fill' }));
  // Skjul tidlige ledd hvis det ikke er plass
  requestAnimationFrame(() => {
    const crumbs = $$('.crumb', box);
    let k = 1;
    while (box.scrollWidth > box.clientWidth + 1 && k < crumbs.length - 1) {
      crumbs[k].textContent = '…'; crumbs[k].classList.add('ellipsis');
      k++;
    }
  });
}

async function subfolderMenu(p, anchor) {
  const r = anchor.getBoundingClientRect();
  let entries;
  if (!p) {
    entries = [...S.places.quick, ...S.places.clouds, ...S.places.volumes].map(x => ({ label: x.label, path: x.path, icon: x.icon }));
    showMenu(entries.map(e => ({ label: e.label, iconHtml: ICONS.sidebar[e.icon] || ICONS.providerIcon(e.icon), action: () => navigate(e.path) })), r.left, r.bottom + 4, { scroll: true });
    return;
  }
  let list = [];
  try { list = await fx.list(p); } catch {}
  const dirs = list.filter(i => i.isDir && !i.isApp && (S.showHidden || !i.hidden)).sort((a, b) => collator.compare(a.name, b.name));
  if (!dirs.length) { showMenu([{ label: 'Ingen undermapper', disabled: true }], r.left, r.bottom + 4); return; }
  showMenu(dirs.slice(0, 400).map(d => ({ label: d.name, iconHtml: ICONS.kinds.folder, action: () => navigate(d.path) })), r.left, r.bottom + 4, { scroll: true });
}

// ---------- Sidepanel ----------

function renderSidebar() {
  const sb = $('#sidebar');
  sb.innerHTML = '';
  const item = (label, p, iconHtml, sub) => {
    const el = h('div', { class: 'side-item', dataset: { path: p }, title: p === 'start:' ? 'Start' : p },
      h('span', { class: 'si-icon', html: iconHtml }),
      h('span', { class: 'si-label' }, label),
      sub ? h('span', { class: 'si-sub' }, sub) : null);
    el.addEventListener('click', () => navigate(p));
    el.addEventListener('auxclick', (e) => { if (e.button === 1 && p) addTab(p); });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (isVirtual(p)) return;
      showMenu([
        { label: 'Åpne', icon: 'open', action: () => navigate(p) },
        { label: 'Åpne i ny fane', icon: 'plus', action: () => addTab(p) },
        { label: 'Vis i Finder', icon: 'finder', action: () => fx.open(p) },
        '-',
        { label: 'Kopier bane', icon: 'link', action: () => fx.copyText(p) },
      ], e.clientX, e.clientY);
    });
    if (!isVirtual(p)) makeDropTarget(el, () => p);
    return el;
  };
  const group = (key, title, items) => {
    const g = h('div', { class: 'side-group' + (S.collapsed[key] ? ' collapsed' : '') });
    const head = h('div', { class: 'side-head' }, h('span', { class: 'twisty' }, ic('chevronDown')), title);
    head.addEventListener('click', () => { g.classList.toggle('collapsed'); S.collapsed[key] = g.classList.contains('collapsed'); LS.set('collapsed', S.collapsed); });
    g.append(head, h('div', { class: 'side-items' }, items));
    return g;
  };

  sb.append(item('Start', 'start:', ICONS.sidebar.start));
  sb.append(item('Galleri', 'gallery:', ICONS.sidebar.pictures));
  sb.append(h('div', { class: 'side-sep' }));
  sb.append(group('quick', 'Hurtigtilgang', S.places.quick.map(q => item(q.icon === 'home' ? basename(q.path) : q.label, q.path, ICONS.sidebar[q.icon] || ICONS.kinds.folder))));
  const clouds = S.places.clouds.map(c => item(c.label, c.path, ICONS.providerIcon(c.icon), c.account ? c.account.split('@')[0] : null));
  if (!clouds.length) clouds.push(h('div', { class: 'side-item', style: 'color:var(--text-3)' }, 'Ingen skytjenester funnet'));
  sb.append(group('cloud', 'Skylagring', clouds));
  sb.append(group('mac', 'Denne Macen', S.places.volumes.map(v => item(v.label, v.path, ICONS.sidebar[v.icon] || ICONS.sidebar.drive))));
  renderSidebarActive();
}
function renderSidebarActive() {
  const loc = tab()?.loc;
  $$('#sidebar .side-item').forEach(el => el.classList.toggle('active', el.dataset.path === loc));
}

// ---------- Kommandolinje og statuslinje ----------

function selectedItems(t = tab()) {
  const list = t.search ? t.search.results : t.items;
  return list.filter(i => t.sel.has(i.path));
}

function updateCommandBar() {
  const t = tab();
  const sel = selectedItems(t);
  const isStart = isVirtual(t.loc);
  const inCloud = !isStart && (!!cloudRootOf(t.loc) || (t.search && t.search.results.some(r => cloudRootOf(r.path))));
  $('#commandbar').classList.toggle('in-cloud', !!inCloud);
  const set = (cmd, on) => { const b = $(`.cmd[data-cmd="${cmd}"]`); if (b) b.disabled = !on; };
  set('new-menu', !isStart && !t.search);
  set('cut', sel.length > 0);
  set('copy', sel.length > 0);
  set('paste', !!S.clip && !isStart && !t.search);
  set('rename', sel.length === 1);
  set('delete', sel.length > 0);
  set('sort-menu', !isStart);
  const cloudSel = sel.filter(i => cloudRootOf(i.path));
  set('download', cloudSel.some(i => i.isDir || (t.cloud[i.path] && t.cloud[i.path].state === 'online')));
  set('evict', cloudSel.some(i => i.isDir || (t.cloud[i.path] && t.cloud[i.path].state === 'local')));
}

function updateStatusBar() {
  const t = tab();
  const left = $('#status-left');
  const cl = $('#status-cloud');
  cl.innerHTML = '';
  if (t.loc === 'start:') { left.textContent = ''; }
  else {
    const vis = visibleItems(t);
    const sel = selectedItems(t);
    let s = plural(vis.length, 'element', 'elementer');
    if (sel.length) {
      s += `   |   ${plural(sel.length, 'element', 'elementer')} valgt`;
      const bytes = sel.filter(i => !i.isDir).reduce((a, i) => a + (i.size || 0), 0);
      if (bytes) s += `   ${fmtSize(bytes)}`;
    }
    left.textContent = s;
    const root = cloudRootOf(t.loc);
    if (root || t.search) {
      const counts = {};
      for (const i of vis) { const st = t.cloud[i.path]; if (st && STATUS_INFO[st.state]) { const k = STATUS_INFO[st.state].icon; counts[k] = (counts[k] || 0) + 1; } }
      const lab = { online: 'kun på nett', local: 'på Macen', sync: 'synkroniseres', error: 'feil', conflict: 'konflikt' };
      for (const k of ['local', 'online', 'sync', 'conflict', 'error']) {
        if (counts[k]) cl.append(h('span', { title: lab[k] }, svg(ICONS.status[k]), `${counts[k]} ${lab[k]}`));
      }
    }
  }
  $('#sb-details').classList.toggle('on', S.view === 'details');
  $('#sb-tiles').classList.toggle('on', S.view === 'large');
}

// ---------- Hovedvisning ----------

let thumbObserver = null;
function observeThumbs(root) {
  if (thumbObserver) thumbObserver.disconnect();
  thumbObserver = new IntersectionObserver(async (entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target;
      thumbObserver.unobserve(el);
      const { thumb, mtime, appicon, size } = el.dataset;
      const url = appicon ? await fx.fileIcon(thumb) : await fx.thumb(thumb, Number(size), Number(mtime));
      if (url && el.isConnected) {
        const holder = el.querySelector('.ic-holder') || el;
        holder.innerHTML = '';
        holder.append(h('img', { src: url, class: appicon ? 'appicon' : '', draggable: 'false' }));
      }
    }
  }, { root, rootMargin: '200px' });
  $$('[data-thumb]', root).forEach(el => thumbObserver.observe(el));
}

function canThumb(it, t) {
  if (it.isApp) return 'app';
  if (it.isDir) return null;
  const k = kindOf(it);
  if (!THUMBABLE.has(k)) return null;
  const st = t.cloud[it.path];
  if (st && st.state === 'online') return null; // ikke last ned bare for å lage miniatyr
  if (cloudRootOf(it.path) && it.size > 0 && it.blocks === 0) return null;
  if (it.size > 1024 * 1024 * 1024) return null;
  return 'thumb';
}

function iconEl(it, t, size) {
  const holder = h('span', { class: 'ic-holder', html: ICONS.kinds[kindOf(it)] || ICONS.kinds.file });
  const want = canThumb(it, t);
  const wrapper = h('span', {}, holder);
  if (want && (size > 24 || want === 'app')) {
    wrapper.dataset.thumb = it.path;
    wrapper.dataset.mtime = String(Math.round(it.mtime));
    wrapper.dataset.size = String(size * 2);
    if (want === 'app') wrapper.dataset.appicon = '1';
  }
  return wrapper;
}

function statusCell(it, t) {
  const cell = h('div', { class: 'cell status', dataset: { status: it.path } });
  fillStatus(cell, t.cloud[it.path], true);
  return cell;
}
function fillStatus(el, st, withText) {
  el.innerHTML = '';
  if (!st || !STATUS_INFO[st.state]) return;
  const info = STATUS_INFO[st.state];
  el.title = `${info.text}${st.message ? ` – ${st.message}` : ''}${st.providerLabel ? `\n${st.providerLabel}` : ''}`;
  el.append(statusSvg(st.state));
  if (withText) el.append(h('span', { class: 'st-text' }, info.text));
}

function updateStatusCells() {
  const t = tab();
  $$('#view [data-status]').forEach(el => fillStatus(el, t.cloud[el.dataset.status], el.classList.contains('cell')));
  $$('#view [data-overlay]').forEach(el => {
    const st = t.cloud[el.dataset.overlay];
    el.innerHTML = '';
    el.hidden = !(st && STATUS_INFO[st.state]);
    if (!el.hidden) el.append(statusSvg(st.state));
  });
}

function columns(t) {
  const cols = [
    { key: 'name', label: 'Navn' },
    ...(cloudRootOf(t.loc) || (t.search && t.search.results.some(r => cloudRootOf(r.path))) ? [{ key: 'status', label: 'Status' }] : []),
    ...(t.search ? [{ key: 'folder', label: 'Mappe' }] : []),
    { key: 'mtime', label: 'Endret dato' },
    { key: 'type', label: 'Type' },
    { key: 'size', label: 'Størrelse', right: true },
  ];
  return cols;
}
const colWidth = (k) => S.cols[k] || (k === 'folder' ? 260 : 140);

function renderView() {
  const t = tab();
  const view = $('#view');
  const empty = $('#empty');
  const keepScroll = view.scrollTop;
  view.innerHTML = '';
  view.style.overflowX = '';
  view.className = '';
  empty.hidden = true;
  if (t.loc === 'start:') { renderStart(view); return; }
  if (t.loc === 'gallery:') { renderGallery(view); observeThumbs(view); updateSelectionClasses(); view.scrollTop = keepScroll; return; }
  if (t.error) { empty.hidden = false; empty.textContent = t.error; return; }
  const items = visibleItems(t);
  if (t.search && t.search.loading) { empty.hidden = false; empty.textContent = 'Søker …'; }
  else if (!items.length) { empty.hidden = false; empty.textContent = t.search ? 'Ingen elementer samsvarer med søket.' : 'Denne mappen er tom.'; }

  if (S.view === 'details') renderDetails(view, t, items);
  else if (S.view === 'list') renderList(view, t, items);
  else renderTiles(view, t, items, S.view);
  observeThumbs(view);
  updateSelectionClasses();
  view.scrollTop = keepScroll;
}

function renderDetails(view, t, items) {
  const cols = columns(t);
  const tmpl = cols.map(c => `${colWidth(c.key)}px`).join(' ') + ' 1fr';
  const head = h('div', { class: 'details-head', style: `grid-template-columns:${tmpl}` });
  for (const c of cols) {
    const ch = h('div', { class: 'col-head' + (c.right ? ' right' : '') }, c.label);
    if (t.sortKey === c.key) ch.append(h('span', { class: 'sort-ind' }, svg(t.sortDir > 0 ? '<svg viewBox="0 0 10 10"><path d="M2 6.5 5 3.5l3 3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' : '<svg viewBox="0 0 10 10"><path d="M2 3.5 5 6.5l3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>')));
    ch.addEventListener('click', (e) => { if (e.target.classList.contains('resizer')) return; setSort(c.key); });
    const rz = h('div', { class: 'resizer' });
    rz.addEventListener('mousedown', (e) => startColResize(e, c.key));
    ch.append(rz);
    head.append(ch);
  }
  head.append(h('div'));
  const rows = h('div', { class: 'rows' });
  const frag = document.createDocumentFragment();
  for (const it of items) {
    const row = h('div', { class: 'row item', style: `grid-template-columns:${tmpl}`, dataset: { path: it.path }, draggable: 'true' });
    for (const c of cols) {
      if (c.key === 'name') {
        const fi = h('span', { class: 'fi' }, iconEl(it, t, 20));
        row.append(h('div', { class: 'cell name' }, fi, h('span', { class: 'nm' }, it.name)));
      } else if (c.key === 'status') row.append(statusCell(it, t));
      else if (c.key === 'folder') row.append(h('div', { class: 'cell', title: dirname(it.path) }, dirname(it.path).replace(S.places.home, '~')));
      else if (c.key === 'mtime') row.append(h('div', { class: 'cell' }, fmtDate(it.mtime)));
      else if (c.key === 'type') row.append(h('div', { class: 'cell' }, typeName(it)));
      else if (c.key === 'size') row.append(h('div', { class: 'cell right' }, it.isDir ? '' : fmtSize(it.size)));
    }
    if (S.clip && S.clip.mode === 'cut' && S.clip.paths.includes(it.path)) row.classList.add('cut');
    frag.append(row);
  }
  rows.append(frag);
  view.append(head, rows);
}

function renderList(view, t, items) {
  const rowsFit = Math.max(4, Math.floor((view.clientHeight - 16) / 26));
  const grid = h('div', { class: 'list-grid', style: `--list-rows:${rowsFit}` });
  for (const it of items) {
    const el = h('div', { class: 'list-item item', dataset: { path: it.path }, draggable: 'true', title: it.name },
      h('span', { class: 'fi' }, iconEl(it, t, 18)),
      h('span', { class: 'nm' }, it.name),
      cloudRootOf(it.path) ? h('span', { class: 'st', dataset: { overlay: it.path } }) : null);
    if (S.clip && S.clip.mode === 'cut' && S.clip.paths.includes(it.path)) el.classList.add('cut');
    grid.append(el);
  }
  view.append(grid);
  view.style.overflowX = 'auto';
  updateStatusCells();
}

function renderTiles(view, t, items, size) {
  const grid = h('div', { class: `tiles ${size}` });
  const px = size === 'large' ? 120 : 64;
  for (const it of items) {
    const thumb = h('div', { class: 'thumb' }, iconEl(it, t, px));
    if (cloudRootOf(it.path)) thumb.append(h('span', { class: 'overlay', dataset: { overlay: it.path }, hidden: true }));
    const el = h('div', { class: 'tile item', dataset: { path: it.path }, draggable: 'true', title: it.name }, thumb, h('div', { class: 'nm' }, it.name));
    if (S.clip && S.clip.mode === 'cut' && S.clip.paths.includes(it.path)) el.classList.add('cut');
    grid.append(el);
  }
  view.append(grid);
  updateStatusCells();
}

function setSort(key) {
  const t = tab();
  if (t.sortKey === key) t.sortDir *= -1; else { t.sortKey = key; t.sortDir = key === 'mtime' || key === 'size' ? -1 : 1; }
  renderView();
}

function startColResize(e, key) {
  e.preventDefault(); e.stopPropagation();
  const startX = e.clientX, startW = colWidth(key);
  const move = (ev) => {
    S.cols[key] = Math.max(60, startW + ev.clientX - startX);
    const t = tab();
    const tmpl = columns(t).map(c => `${colWidth(c.key)}px`).join(' ') + ' 1fr';
    $$('#view .details-head, #view .row').forEach(r => r.style.gridTemplateColumns = tmpl);
  };
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); LS.set('cols', S.cols); };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

// ---------- Startside ----------

async function renderStart(view) {
  const wrap = h('div', { class: 'start' });
  view.append(wrap);
  const qa = (label, p, iconHtml, sub, badge) => {
    const el = h('div', { class: 'qa', title: p },
      h('div', { class: 'qa-icon', html: iconHtml }, badge ? h('span', { class: 'badge', html: badge }) : null),
      h('div', { class: 'qa-text' }, h('div', { class: 'qa-title' }, label), h('div', { class: 'qa-sub' }, sub)));
    el.addEventListener('click', () => navigate(p));
    makeDropTarget(el, () => p);
    return el;
  };

  wrap.append(h('h2', {}, 'Hurtigtilgang'));
  wrap.append(h('div', { class: 'qa-grid' }, S.places.quick.map(q =>
    qa(q.icon === 'home' ? basename(q.path) : q.label, q.path, ICONS.kinds.folder, q.icon === 'home' ? 'Hjemmemappe' : 'Denne Macen', q.icon !== 'home' ? ICONS.sidebar[q.icon] : ICONS.sidebar.home))));

  wrap.append(h('h2', {}, 'Skylagring'));
  if (!S.places.clouds.length) {
    wrap.append(h('div', { class: 'empty-note' }, 'Fant ingen skytjenester. Installer og logg inn i iCloud Drive, OneDrive, Google Drive eller Dropbox, så dukker de opp her automatisk.'));
  } else {
    const cards = h('div', { class: 'cloud-cards' });
    for (const c of S.places.clouds) {
      const card = h('div', { class: 'cloud-card', title: c.path },
        h('div', { class: 'cc-icon', html: ICONS.providerIcon(c.icon) }),
        h('div', { class: 'cc-main' }, h('div', { class: 'cc-title' }, c.label), h('div', { class: 'cc-sub' }, c.account || 'Synkronisert mappe')));
      card.addEventListener('click', () => navigate(c.path));
      makeDropTarget(card, () => c.path);
      cards.append(card);
    }
    wrap.append(cards);
    const legend = h('div', { class: 'legend' });
    for (const k of ['online', 'local', 'downloading', 'error', 'conflict']) legend.append(h('span', {}, statusSvg(k), STATUS_INFO[k].text));
    wrap.append(h('div', { style: 'margin-top:10px' }, h('div', { class: 'empty-note', style: 'padding-bottom:2px' }, 'Slik leser du statusikonene:'), legend));
  }

  wrap.append(h('h2', {}, 'Lagring'));
  const disk = await fx.diskInfo('/');
  if (disk) {
    const used = disk.total - disk.free;
    const pct = Math.round(used / disk.total * 100);
    const card = h('div', { class: 'drive-card' },
      h('div', { class: 'dc-icon', html: ICONS.kinds.disk }),
      h('div', { class: 'dc-main' }, h('div', {}, 'Macintosh HD'),
        h('div', { class: 'bar' + (pct > 90 ? ' full' : '') }, h('div', { style: `width:${pct}%` })),
        h('div', { class: 'qa-sub' }, `${fmtSize(disk.free)} ledig av ${fmtSize(disk.total)}`)));
    card.addEventListener('click', () => navigate('/'));
    wrap.append(card);
  }

  const recentHead = h('h2', {}, 'Nylige filer');
  const recentBox = h('div', {}, h('div', { class: 'empty-note' }, 'Henter …'));
  wrap.append(recentHead, recentBox);
  const recent = await fx.recent();
  if (tab().loc !== 'start:') return;
  recentBox.innerHTML = '';
  if (!recent.length) { recentBox.append(h('div', { class: 'empty-note' }, 'Ingen nylig brukte filer.')); return; }
  const t = tab();
  t.items = recent;
  const tmpl = '360px 200px 150px 1fr';
  const rows = h('div', { class: 'rows', style: 'padding:0' });
  for (const it of recent) {
    const row = h('div', { class: 'row item', style: `grid-template-columns:${tmpl}`, dataset: { path: it.path } },
      h('div', { class: 'cell name' }, h('span', { class: 'fi', html: ICONS.kinds[kindOf(it)] || ICONS.kinds.file }), h('span', { class: 'nm' }, it.name)),
      h('div', { class: 'cell', title: dirname(it.path) }, (cloudRootOf(it.path)?.label) || basename(dirname(it.path))),
      h('div', { class: 'cell' }, fmtDate(it.mtime)),
      h('div', { class: 'cell' }, typeName(it)));
    rows.append(row);
  }
  recentBox.append(rows);
  updateSelectionClasses();
}

// ---------- Utvalg ----------

function updateSelectionClasses() {
  const t = tab();
  $$('#view .item').forEach(el => {
    el.classList.toggle('selected', t.sel.has(el.dataset.path));
    el.classList.toggle('focus', t.focus === el.dataset.path);
  });
  updateCommandBar();
  updateStatusBar();
  updateDetailsPane();
  if (t.loc === 'gallery:') { const old = $('#view .gal-bar'); if (old) old.replaceWith(buildGalleryBar()); }
}
function selectOnly(p) {
  const t = tab();
  t.sel = new Set(p ? [p] : []);
  t.focus = p; t.anchor = p;
  updateSelectionClasses();
  const el = p && $(`#view .item[data-path="${CSS.escape(p)}"]`);
  if (el) el.scrollIntoView({ block: 'nearest' });
}
function itemsInOrder() { return $$('#view .item').map(el => el.dataset.path); }
function findItem(p) { const t = tab(); return (t.search ? t.search.results : t.items).find(i => i.path === p); }

function onItemClick(e, p) {
  const t = tab();
  if (e.shiftKey && t.anchor) {
    const order = itemsInOrder();
    const a = order.indexOf(t.anchor), b = order.indexOf(p);
    if (a >= 0 && b >= 0) {
      if (!(e.metaKey || e.ctrlKey)) t.sel.clear();
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) t.sel.add(order[i]);
    }
    t.focus = p;
  } else if (e.metaKey || e.ctrlKey) {
    if (t.sel.has(p)) t.sel.delete(p); else t.sel.add(p);
    t.focus = p; t.anchor = p;
  } else {
    t.sel = new Set([p]); t.focus = p; t.anchor = p;
  }
  updateSelectionClasses();
}

function openItem(it) {
  if (!it) return;
  if (it.isDir && !it.isApp) navigate(it.path);
  else fx.open(it.path);
}

// ---------- Filoperasjoner ----------

function currentDir() { const t = tab(); return isVirtual(t.loc) || t.search ? null : t.loc; }

function doCopy(mode) {
  const sel = selectedItems();
  if (!sel.length) return;
  S.clip = { mode, paths: sel.map(i => i.path) };
  fx.copyText(sel.map(i => i.path).join('\n'));
  renderView();
  toast(mode === 'cut' ? `${plural(sel.length, 'element', 'elementer')} klar til å flyttes. Lim inn i en annen mappe.` : `${plural(sel.length, 'element', 'elementer')} kopiert.`);
}

async function doPaste(destDir = currentDir()) {
  if (!S.clip || !destDir) return;
  const { mode, paths } = S.clip;
  const r = mode === 'cut' ? await fx.moveInto(paths, destDir) : await fx.copyInto(paths, destDir);
  if (mode === 'cut') S.clip = null;
  reportFailures(r.failed, mode === 'cut' ? 'flytte' : 'kopiere');
  await load(tab(), { keepSel: false });
  const t = tab();
  r.done.forEach(p => t.sel.add(p));
  updateSelectionClasses();
}

async function transfer(paths, destDir, copy) {
  paths = paths.filter(p => p !== destDir);
  if (!paths.length) return;
  const r = copy ? await fx.copyInto(paths, destDir) : await fx.moveInto(paths, destDir);
  reportFailures(r.failed, copy ? 'kopiere' : 'flytte');
  if (r.done.length) toast(`${plural(r.done.length, 'element', 'elementer')} ${copy ? 'kopiert' : 'flyttet'} til ${locLabel(destDir)}.`);
  load(tab(), { keepSel: true });
}

function reportFailures(failed, verb) {
  if (!failed || !failed.length) return;
  toast(`Kunne ikke ${verb} ${plural(failed.length, 'element', 'elementer')}: ${failed[0].error}`, 'error');
}

async function doDelete() {
  const sel = selectedItems();
  if (!sel.length) return;
  const cloudCount = sel.filter(i => cloudRootOf(i.path)).length;
  if (cloudCount) {
    const r = await fx.confirm({
      message: sel.length === 1 ? `Flytte «${sel[0].name}» til papirkurven?` : `Flytte ${sel.length} elementer til papirkurven?`,
      detail: 'Elementer i skylagring fjernes også fra skyen og fra andre enheter. De kan hentes tilbake fra papirkurven.',
      buttons: ['Flytt til papirkurven', 'Avbryt'],
    });
    if (r !== 0) return;
  }
  const res = await fx.trash(sel.map(i => i.path));
  reportFailures(res.failed, 'slette');
  toast(`${plural(sel.length - res.failed.length, 'element', 'elementer')} flyttet til papirkurven.`);
  load(tab());
}

async function newFolder() {
  const dir = currentDir();
  if (!dir) return;
  try {
    const p = await fx.mkdir(dir, 'Ny mappe');
    await load(tab());
    selectOnly(p);
    startRename(p);
  } catch (e) { toast(`Kunne ikke lage mappe: ${cleanErr(e)}`, 'error'); }
}

function startRename(p) {
  const t = tab();
  p = p || [...t.sel][0];
  const it = p && findItem(p);
  if (!it) return;
  const el = $(`#view .item[data-path="${CSS.escape(p)}"]`);
  if (!el) return;
  const nm = el.querySelector('.nm');
  const input = h('input', { class: 'rename-input', value: it.name, spellcheck: 'false' });
  const original = nm.textContent;
  nm.replaceWith(input);
  el.draggable = false;
  input.focus();
  const dot = it.isDir ? -1 : it.name.lastIndexOf('.');
  input.setSelectionRange(0, dot > 0 ? dot : it.name.length);
  let done = false;
  const finish = async (commit) => {
    if (done) return; done = true;
    const val = input.value.trim();
    if (commit && val && val !== it.name) {
      try {
        const np = await fx.rename(p, val);
        await load(tab());
        selectOnly(np);
        return;
      } catch (e) { toast(cleanErr(e), 'error'); }
    }
    input.replaceWith(h('span', { class: 'nm' }, original));
    el.draggable = true;
    $('#content').focus();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('mousedown', (e) => e.stopPropagation());
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
}

async function cloudAction(kind, items = selectedItems()) {
  const paths = items.filter(i => cloudRootOf(i.path)).map(i => i.path);
  if (!paths.length) return;
  toast(kind === 'download' ? 'Laster ned …' : 'Frigjør plass …', 'sync');
  const r = kind === 'download' ? await fx.cloudDownload(paths) : await fx.cloudEvict(paths);
  if (r.failed && r.failed.length) toast(`${kind === 'download' ? 'Nedlasting' : 'Frigjøring'} feilet for ${plural(r.failed.length, 'fil', 'filer')}: ${r.failed[0].error}`, 'error');
  else toast(kind === 'download' ? `Nedlasting startet for ${plural(r.ok, 'fil', 'filer')}.` : `Frigjorde plass for ${plural(r.ok, 'fil', 'filer')}. De ligger fortsatt i skyen.`);
  setTimeout(() => refreshCloud(), 800);
}

// ---------- Søk ----------

let searchTimer = null;
function onSearchInput() {
  const q = $('#search-input').value.trim();
  $('#searchbox').classList.toggle('has-text', !!q);
  clearTimeout(searchTimer);
  const t = tab();
  if (t.loc === 'gallery:') { S.gallery.query = q; S.gallery.shown = 300; load(t); return; }
  if (!q) { if (t.search) { t.search = null; render(); refreshCloud(t); } return; }
  searchTimer = setTimeout(() => runSearch(q), 350);
}
async function runSearch(q) {
  const t = tab();
  let dir = t.loc === 'start:' ? S.places.home : t.loc;
  t.search = { q, dir, results: [], loading: true };
  t.sel.clear(); t.focus = null;
  render();
  const results = await fx.search(dir, q);
  if (!t.search || t.search.q !== q) return;
  t.search.results = results;
  t.search.loading = false;
  if (t === tab()) render();
  refreshCloud(t);
}
function clearSearch() {
  $('#search-input').value = '';
  onSearchInput();
}

// ---------- Detaljrute ----------

let dpToken = 0;
async function updateDetailsPane() {
  const pane = $('#details-pane');
  if (!S.detailsPane) return;
  const t = tab();
  const sel = selectedItems(t);
  const token = ++dpToken;
  pane.innerHTML = '';
  if (sel.length === 0) {
    if (isVirtual(t.loc)) { pane.append(h('div', { class: 'dp-empty' }, 'Velg en fil eller mappe for å se detaljer.')); return; }
    const root = cloudRootOf(t.loc);
    pane.append(h('div', { class: 'dp-preview', html: root && t.loc === root.path ? ICONS.providerIcon(root.icon) : ICONS.kinds.folder }),
      h('div', { class: 'dp-name' }, locLabel(t.loc)),
      h('div', { class: 'dp-type' }, root ? `Mappe i ${root.label}` : 'Filmappe'),
      h('div', { class: 'dp-empty', style: 'margin-top:24px' }, 'Velg en fil eller mappe for å se detaljer.'));
    return;
  }
  if (sel.length > 1) {
    const bytes = sel.filter(i => !i.isDir).reduce((a, i) => a + (i.size || 0), 0);
    pane.append(h('div', { class: 'dp-preview', html: ICONS.kinds.file }),
      h('div', { class: 'dp-name' }, `${sel.length} elementer valgt`),
      h('div', { class: 'dp-type' }, bytes ? fmtSize(bytes) : ''));
    const cloudSel = sel.filter(i => cloudRootOf(i.path));
    if (cloudSel.length) pane.append(h('div', { class: 'dp-actions' },
      h('button', { class: 'btn', onclick: () => cloudAction('download') }, ic('cloudDown'), 'Last ned'),
      h('button', { class: 'btn', onclick: () => cloudAction('evict') }, ic('cloudFree'), 'Frigjør plass')));
    return;
  }
  const it = sel[0];
  const prev = h('div', { class: 'dp-preview', html: ICONS.kinds[kindOf(it)] || ICONS.kinds.file });
  pane.append(prev);
  const want = canThumb(it, t);
  if (want) {
    (want === 'app' ? fx.fileIcon(it.path) : fx.thumb(it.path, 512, Math.round(it.mtime))).then(url => {
      if (url && token === dpToken) { prev.innerHTML = ''; prev.append(h('img', { src: url, class: want === 'app' ? 'appicon' : '' })); }
    });
  }
  pane.append(h('div', { class: 'dp-name' }, it.name), h('div', { class: 'dp-type' }, typeName(it)));
  const st = t.cloud[it.path];
  const actions = h('div', { class: 'dp-actions' },
    h('button', { class: 'btn accent', onclick: () => openItem(it) }, 'Åpne'),
    h('button', { class: 'btn', onclick: () => fx.reveal(it.path) }, 'Vis i Finder'));
  if (cloudRootOf(it.path)) {
    if (it.isDir || (st && st.state === 'online')) actions.append(h('button', { class: 'btn', onclick: () => cloudAction('download', [it]) }, ic('cloudDown'), 'Last ned'));
    if (it.isDir || (st && st.state === 'local')) actions.append(h('button', { class: 'btn', onclick: () => cloudAction('evict', [it]) }, ic('cloudFree'), 'Frigjør plass'));
  }
  pane.append(actions);
  const row = (k, v) => h('div', { class: 'dp-row' }, h('div', { class: 'k' }, k), v instanceof Node ? v : h('div', { class: 'v' }, v));
  const root = cloudRootOf(it.path);
  if (root) {
    pane.append(h('div', { class: 'dp-section' }, 'Skylagring'));
    pane.append(row('Tjeneste', root.label));
    if (st && STATUS_INFO[st.state]) {
      const info = STATUS_INFO[st.state];
      pane.append(row('Status', h('div', { class: 'v status' }, statusSvg(st.state), h('div', {}, h('div', {}, info.text), h('div', { style: 'color:var(--text-2);font-size:12px;margin-top:2px' }, st.message || info.long)))));
    }
  }
  pane.append(h('div', { class: 'dp-section' }, 'Egenskaper'));
  if (!it.isDir) pane.append(row('Størrelse', `${fmtSize(it.size)}${it.size >= 1024 ? ` (${it.size.toLocaleString('nb-NO')} byte)` : ''}`));
  if (!it.isDir && root) pane.append(row('På disken', it.blocks === 0 && it.size > 0 ? '0 byte (bare i skyen)' : fmtSize(it.blocks * 512)));
  pane.append(row('Endret', it.mtime ? dtfLong.format(new Date(it.mtime)) : ''));
  pane.append(row('Opprettet', it.birth ? dtfLong.format(new Date(it.birth)) : ''));
  pane.append(row('Plassering', dirname(it.path).replace(S.places.home, '~')));
  if (it.isDir && !it.isApp) {
    const r = row('Innhold', '…');
    pane.append(r);
    fx.list(it.path).then(list => { if (token === dpToken) r.lastChild.textContent = plural(list.filter(x => !x.hidden).length, 'element', 'elementer'); }).catch(() => { r.lastChild.textContent = '–'; });
  }
}

// ---------- Menyer ----------

function closeMenu() { const l = $('#menu-layer'); l.hidden = true; l.innerHTML = ''; }
function showMenu(items, x, y, { scroll = false, topRow = null } = {}) {
  const layer = $('#menu-layer');
  layer.innerHTML = '';
  layer.hidden = false;
  const m = h('div', { class: 'menu' + (scroll ? ' scroll' : '') });
  if (topRow) {
    const r = h('div', { class: 'mi-row' });
    for (const b of topRow) r.append(h('button', { title: b.label, disabled: b.disabled, onclick: () => { closeMenu(); b.action(); } }, ic(b.icon)));
    m.append(r);
  }
  for (const it of items) {
    if (it === '-') { m.append(h('div', { class: 'msep' })); continue; }
    if (!it) continue;
    const el = h('div', { class: 'mi' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '') },
      h('span', { class: 'mi-ic', html: it.iconHtml || (it.icon ? ICONS.cmd[it.icon] : (it.checked ? ICONS.cmd.check : '')) }),
      h('span', { class: 'mi-label' }, it.label),
      it.key ? h('span', { class: 'mi-key' }, it.key) : null);
    if (!it.disabled) el.addEventListener('click', () => { closeMenu(); it.action && it.action(); });
    m.append(el);
  }
  layer.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 6))}px`;
  m.style.top = `${y + r.height > innerHeight - 6 ? Math.max(4, y - r.height) : y}px`;
}

function sortMenuItems() {
  const t = tab();
  const keys = [['name', 'Navn'], ...(cloudRootOf(t.loc) ? [['status', 'Status']] : []), ['mtime', 'Endret dato'], ['type', 'Type'], ['size', 'Størrelse']];
  return [
    ...keys.map(([k, l]) => ({ label: l, checked: t.sortKey === k, action: () => { t.sortKey = k; renderView(); } })),
    '-',
    { label: 'Stigende', checked: t.sortDir === 1, action: () => { t.sortDir = 1; renderView(); } },
    { label: 'Synkende', checked: t.sortDir === -1, action: () => { t.sortDir = -1; renderView(); } },
    '-',
    { label: 'Mapper først', checked: S.groupFolders, action: () => { S.groupFolders = !S.groupFolders; renderView(); } },
  ];
}
function viewMenuItems() {
  return [
    { label: 'Store ikoner', icon: 'tiles', checked: S.view === 'large', key: '⌘4', action: () => setView('large') },
    { label: 'Middels ikoner', icon: 'view', checked: S.view === 'medium', key: '⌘3', action: () => setView('medium') },
    { label: 'Liste', icon: 'list', checked: S.view === 'list', key: '⌘2', action: () => setView('list') },
    { label: 'Detaljer', icon: 'rows', checked: S.view === 'details', key: '⌘1', action: () => setView('details') },
    '-',
    { label: 'Detaljrute', icon: 'details', checked: S.detailsPane, key: '⌥⌘P', action: toggleDetails },
    { label: 'Skjulte elementer', icon: S.showHidden ? 'eye' : 'hidden', checked: S.showHidden, key: '⇧⌘.', action: toggleHidden },
  ].map(i => (i === '-' ? i : { ...i, iconHtml: i.checked ? ICONS.cmd.check : ICONS.cmd[i.icon] }));
}
function setView(v) { S.view = v; LS.set('view', v); renderView(); updateStatusBar(); }
function toggleDetails() { S.detailsPane = !S.detailsPane; LS.set('detailsPane', S.detailsPane); render(); }
function toggleHidden() { S.showHidden = !S.showHidden; LS.set('showHidden', S.showHidden); renderView(); updateStatusBar(); toast(S.showHidden ? 'Viser skjulte elementer.' : 'Skjuler skjulte elementer.'); }

function moreMenuItems() {
  const dir = currentDir();
  return [
    { label: 'Merk alt', icon: 'check', key: '⌘A', action: selectAll },
    { label: 'Fjern merking', icon: 'close', action: () => selectOnly(null) },
    '-',
    { label: 'Åpne i Finder', icon: 'finder', disabled: !dir, action: () => fx.open(dir) },
    { label: 'Åpne i Terminal', icon: 'terminal', disabled: !dir, action: () => fx.openTerminal(dir) },
    { label: 'Kopier bane', icon: 'link', key: '⌥⌘C', action: copyPath },
    '-',
    { label: 'Ny fane', icon: 'plus', key: '⌘T', action: () => addTab(dir || 'start:') },
    '-',
    { label: 'Se etter oppdateringer', icon: 'refresh', action: () => checkUpdates(true) },
    { label: `Filutforsker ${appVersion}`, icon: 'details', disabled: true },
  ];
}

function itemContextMenu(e, p) {
  const t = tab();
  if (!t.sel.has(p)) { t.sel = new Set([p]); t.focus = p; t.anchor = p; updateSelectionClasses(); }
  const sel = selectedItems();
  const it = findItem(p);
  const cloudSel = sel.filter(i => cloudRootOf(i.path));
  const anyOnline = cloudSel.some(i => i.isDir || t.cloud[i.path]?.state === 'online');
  const anyLocal = cloudSel.some(i => i.isDir || t.cloud[i.path]?.state === 'local');
  const one = sel.length === 1;
  showMenu([
    { label: 'Åpne', icon: 'open', key: '↵', action: () => sel.forEach(openItem) },
    one && it.isDir && !it.isApp ? { label: 'Åpne i ny fane', icon: 'plus', action: () => addTab(it.path) } : null,
    t.search || t.loc === 'gallery:' ? { label: 'Åpne plasseringen', icon: 'folderNew', action: () => navigate(dirname(it.path)).then(() => selectOnly(it.path)) } : null,
    t.loc === 'gallery:' ? { label: 'Flytt til All Photos', icon: 'photos', disabled: !sel.some(i => !i.moved), action: () => galleryMove(sel.map(i => i.path)) } : null,
    { label: 'Vis i Finder', icon: 'finder', action: () => fx.reveal(p) },
    ...(cloudSel.length ? ['-',
      { label: 'Last ned til denne Macen', icon: 'cloudDown', disabled: !anyOnline, action: () => cloudAction('download') },
      { label: 'Frigjør plass (behold i skyen)', icon: 'cloudFree', disabled: !anyLocal, action: () => cloudAction('evict') }] : []),
    '-',
    { label: 'Kopier bane', icon: 'link', key: '⌥⌘C', action: copyPath },
    { label: 'Egenskaper', icon: 'details', action: () => { if (!S.detailsPane) toggleDetails(); } },
  ], e.clientX, e.clientY, {
    topRow: [
      { icon: 'cut', label: 'Klipp ut', action: () => doCopy('cut') },
      { icon: 'copy', label: 'Kopier', action: () => doCopy('copy') },
      { icon: 'rename', label: 'Gi nytt navn', disabled: !one, action: () => startRename(p) },
      { icon: 'trash', label: 'Flytt til papirkurven', action: doDelete },
    ],
  });
}

function backgroundContextMenu(e) {
  const t = tab();
  const dir = currentDir();
  showMenu([
    { label: 'Vis', icon: 'view', action: () => { const b = $('.cmd[data-cmd="view-menu"]').getBoundingClientRect(); showMenu(viewMenuItems(), b.left, b.bottom + 4); } },
    { label: 'Sorter etter', icon: 'sort', action: () => { const b = $('.cmd[data-cmd="sort-menu"]').getBoundingClientRect(); showMenu(sortMenuItems(), b.left, b.bottom + 4); } },
    { label: 'Oppdater', icon: 'refresh', key: '⌘R', action: () => load(t, { keepSel: true }) },
    '-',
    { label: 'Lim inn', icon: 'paste', key: '⌘V', disabled: !S.clip || !dir, action: () => doPaste() },
    { label: 'Ny mappe', icon: 'folderNew', key: '⇧⌘N', disabled: !dir, action: newFolder },
    '-',
    { label: 'Sorter bilder her …', icon: 'photos', action: openPhotoSort },
    { label: 'Åpne i Finder', icon: 'finder', disabled: !dir, action: () => fx.open(dir) },
    { label: 'Åpne i Terminal', icon: 'terminal', disabled: !dir, action: () => fx.openTerminal(dir) },
  ], e.clientX, e.clientY);
}

function selectAll() {
  const t = tab();
  t.sel = new Set(visibleItems(t).map(i => i.path));
  updateSelectionClasses();
}
function copyPath() {
  const sel = selectedItems();
  const text = sel.length ? sel.map(i => i.path).join('\n') : currentDir();
  if (text) { fx.copyText(text); toast('Banen er kopiert.'); }
}

// ---------- Dra og slipp ----------

const DRAG_TYPE = 'application/x-filutforsker-paths';
let dragPaths = null;

function makeDropTarget(el, getDir) {
  el.addEventListener('dragover', (e) => {
    const dir = getDir();
    if (!dir) return;
    const ours = e.dataTransfer.types.includes(DRAG_TYPE);
    const files = e.dataTransfer.types.includes('Files');
    if (!ours && !files) return;
    if (ours && dragPaths && dragPaths.includes(dir)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = (!ours || e.altKey) ? 'copy' : 'move';
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('drop-target');
    const dir = getDir();
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    handleDrop(e, dir);
  });
}

function handleDrop(e, dir) {
  const raw = e.dataTransfer.getData(DRAG_TYPE);
  if (raw) {
    const paths = JSON.parse(raw);
    transfer(paths, dir, e.altKey);
    return;
  }
  const paths = [...e.dataTransfer.files].map(f => fx.pathForFile(f)).filter(Boolean);
  if (paths.length) transfer(paths, dir, true);
}

// ---------- Sorter bilder ----------

function modal(content, foot) {
  const layer = $('#modal-layer');
  layer.innerHTML = '';
  layer.hidden = false;
  const m = h('div', { class: 'modal' }, h('div', { class: 'm-body' }, content), foot ? h('div', { class: 'm-foot' }, foot) : null);
  layer.append(m);
  return m;
}
function closeModal() { const l = $('#modal-layer'); l.hidden = true; l.innerHTML = ''; }

const PS_ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="15" height="12" rx="1.8"/><circle cx="7" cy="8" r="1.4"/><path d="m2.8 14 4.2-3.8 3 2.6 2.4-2 4.6 3.8"/></svg>';
const WARN_ICON = '<svg viewBox="0 0 16 16"><path d="M8 1.8 15 14H1z" fill="#f7a400"/><path d="M8 6v4" stroke="#1b1b1b" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="#1b1b1b"/></svg>';
const INFO_ICON = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#0a64c8"/><path d="M8 7v4.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1" fill="#fff"/></svg>';

let psState = null;
function openPhotoSort() {
  const t = tab();
  const dir = currentDir();
  const scopeDefault = dir ? 'folder' : 'mac';
  psState = { scope: scopeDefault, includeOnline: false, dir };
  const radio = (val, title, sub, disabled) => {
    const input = h('input', { type: 'radio', name: 'ps-scope', value: val, disabled, checked: psState.scope === val });
    input.addEventListener('change', () => { psState.scope = val; });
    return h('label', { class: 'choice' + (disabled ? ' disabled' : '') }, input, h('div', {}, h('div', { class: 'c-title' }, title), h('div', { class: 'c-sub' }, sub)));
  };
  const clouds = S.places.clouds.map(c => c.label).join(', ');
  const online = h('input', { type: 'checkbox' });
  online.addEventListener('change', () => { psState.includeOnline = online.checked; });
  modal([
    h('h3', { html: PS_ICON + 'Sorter bilder' }),
    h('p', {}, 'Finner bilder og videoer og flytter dem til mappen All Photos i hjemmemappen, sortert i År › Måned etter når de ble tatt. Duplikater legges i en egen mappe. Ingenting slettes.'),
    radio('folder', dir ? `Denne mappen og undermappene: ${locLabel(dir)}` : 'Denne mappen og undermappene', dir ? dir.replace(S.places.home, '~') : 'Åpne en mappe først for å bruke dette valget', !dir),
    radio('mac', 'Hele Macen', `Hjemmemappen${clouds ? ` og ${clouds}` : ''}. Bilder-biblioteket i Bilder-appen røres ikke.`),
    h('label', { class: 'check' }, online, h('div', {}, h('div', {}, 'Ta med bilder som bare ligger i skyen'), h('div', { style: 'color:var(--text-2);font-size:12px' }, 'De lastes ned først. Det kan ta tid og bruke mye plass.'))),
  ], [
    h('button', { class: 'btn', onclick: closeModal }, 'Avbryt'),
    h('button', { class: 'btn accent', onclick: psScan }, 'Søk etter bilder'),
  ]);
}

async function psScan() {
  const status = h('div', { class: 'mono' }, '');
  const count = h('div', { class: 'big-number' }, '0');
  modal([
    h('h3', { html: PS_ICON + 'Søker etter bilder …' }),
    h('p', {}, 'Går gjennom mappene. Dette kan ta litt tid første gang.'),
    count,
    h('div', { class: 'progress indet' }, h('div')),
    status,
  ], [h('button', { class: 'btn', onclick: () => { fx.psCancel(); closeModal(); } }, 'Avbryt')]);
  psProgressHandler = (p) => { if (p.phase === 'scan') { count.textContent = p.found.toLocaleString('nb-NO'); status.textContent = p.dir.replace(S.places.home, '~'); } };
  const r = await fx.psScan({ scope: psState.scope, dir: psState.dir });
  psProgressHandler = null;
  if ($('#modal-layer').hidden) return;
  if (r.error) { modal([h('h3', {}, 'Søket ble stoppet'), h('p', {}, r.error === 'avbrutt' ? 'Søket ble avbrutt.' : r.error)], [h('button', { class: 'btn accent', onclick: closeModal }, 'Lukk')]); return; }
  psSummary(r);
}

async function psSummary(r) {
  if (!r.count) {
    modal([h('h3', { html: PS_ICON + 'Fant ingen bilder' }), h('p', {}, 'Fant ingen bilder eller videoer som ikke allerede ligger i All Photos.')],
      [h('button', { class: 'btn accent', onclick: closeModal }, 'Lukk')]);
    return;
  }
  const disk = r.onlineOnly ? await fx.diskInfo('/') : null;
  const render = () => {
    const include = psState.includeOnline;
    const local = r.count - r.onlineOnly;
    const toMove = include ? r.count : local;
    const table = h('table', { class: 'summary-table' });
    for (const [k, v] of Object.entries(r.byProvider).sort((a, b) => b[1] - a[1])) table.append(h('tr', {}, h('td', {}, k), h('td', {}, plural(v, 'fil', 'filer'))));
    const fromCloud = Object.entries(r.byProvider).filter(([k]) => k !== 'Denne Macen').reduce((a, [, v]) => a + v, 0);
    const notes = [];
    if (fromCloud) notes.push(h('div', { class: 'note warn', html: WARN_ICON }, h('div', {},
      h('b', {}, `${plural(fromCloud, 'fil', 'filer')} ligger i skylagring. `),
      'Når de flyttes til All Photos, fjernes de fra skyen og fra andre enheter, men blir liggende trygt på denne Macen.')));
    if (r.onlineOnly) {
      const all = r.onlineOnly === r.count;
      const lead = all
        ? `Alle ${plural(r.count, 'filen', 'filene')} ligger bare i skyen, ikke på Macen. `
        : `${plural(r.onlineOnly, 'fil', 'filer')} ligger bare i skyen, ikke på Macen. `;
      const tail = include
        ? `De lastes ned først (${fmtSize(r.onlineBytes)}). Det kan ta en stund.`
        : `De må lastes ned (${fmtSize(r.onlineBytes)}) før de kan flyttes, og hoppes derfor over hvis du ikke krysser av nedenfor.`;
      notes.push(h('div', { class: 'note info', html: INFO_ICON }, h('div', {}, h('b', {}, lead), tail)));
      const cb = h('input', { type: 'checkbox', checked: include });
      cb.addEventListener('change', () => { psState.includeOnline = cb.checked; render(); });
      notes.push(h('label', { class: 'check' }, cb, h('div', {}, `Last ned og flytt også bildene som bare ligger i skyen (${fmtSize(r.onlineBytes)})`)));
      if (include && disk && disk.free < r.onlineBytes * 1.1) {
        notes.push(h('div', { class: 'note warn', html: WARN_ICON }, h('div', {}, h('b', {}, 'Lite ledig plass. '),
          `Macen har ${fmtSize(disk.free)} ledig, men nedlastingen krever omtrent ${fmtSize(r.onlineBytes)}.`)));
      }
    }
    modal([
      h('h3', { html: PS_ICON + `Fant ${plural(r.count, 'bilde eller video', 'bilder og videoer')}` }),
      h('p', {}, `I ${plural(r.folders, 'mappe', 'mapper')}, til sammen ${fmtSize(r.bytes)}. De flyttes til ${r.dest.replace(S.places.home, '~')}, sortert i År › Måned.`),
      table,
      ...notes,
      h('p', { style: 'font-size:12px' }, 'Tips: Ta gjerne en sikkerhetskopi (Time Machine) før første gang.'),
    ], [
      h('button', { class: 'btn', onclick: closeModal }, 'Avbryt'),
      toMove
        ? h('button', { class: 'btn accent', onclick: psRun }, include && r.onlineOnly ? `Last ned og flytt ${plural(toMove, 'fil', 'filer')}` : `Flytt ${plural(toMove, 'fil', 'filer')}`)
        : h('button', { class: 'btn accent', disabled: true }, 'Ingen filer å flytte'),
    ]);
  };
  render();
}

let psProgressHandler = null;
async function psRun() {
  const bar = h('div');
  const status = h('div', { class: 'mono' });
  const count = h('p', {}, 'Forbereder …');
  modal([h('h3', { html: PS_ICON + 'Flytter bilder …' }), count, h('div', { class: 'progress' }, bar), status],
    [h('button', { class: 'btn', onclick: () => { fx.psCancel(); count.textContent = 'Avbryter …'; } }, 'Avbryt')]);
  psProgressHandler = (p) => {
    if (p.phase !== 'move') return;
    bar.style.width = `${p.total ? Math.round(p.done / p.total * 100) : 100}%`;
    count.textContent = `${p.done.toLocaleString('nb-NO')} av ${p.total.toLocaleString('nb-NO')} filer`;
    if (p.file) status.textContent = p.file.replace(S.places.home, '~');
  };
  const r = await fx.psRun({ includeOnline: psState.includeOnline });
  psProgressHandler = null;
  const body = [
    h('h3', { html: PS_ICON + (r.cancelled ? 'Avbrutt' : 'Ferdig!') }),
    h('p', {}, `Flyttet ${plural(r.moved || 0, 'fil', 'filer')} til All Photos.`),
  ];
  if (r.dups) body.push(h('p', {}, `${plural(r.dups, 'duplikat', 'duplikater')} ble lagt i mappen Duplicates (ingenting er slettet).`));
  if (r.skipped) body.push(h('p', {}, `${plural(r.skipped, 'fil', 'filer')} som bare ligger i skyen ble hoppet over.`));
  body.push(h('p', {}, 'En liste over hvor hver fil kom fra, ligger i move-log.txt.'));
  if (r.failed && r.failed.length) body.push(h('div', { class: 'note warn', html: WARN_ICON }, h('div', {}, h('b', {}, `${plural(r.failed.length, 'fil', 'filer')} kunne ikke flyttes:`),
    h('div', { class: 'fail-list' }, r.failed.slice(0, 20).map(f => h('div', {}, `${basename(f.path)}: ${f.error}`))))));
  if (r.error) body.push(h('p', {}, r.error));
  modal(body, [
    h('button', { class: 'btn', onclick: closeModal }, 'Lukk'),
    h('button', { class: 'btn accent', onclick: async () => { closeModal(); S.places = await fx.places(); renderSidebar(); navigate(r.dest); } }, 'Åpne All Photos'),
  ]);
  load(tab(), { keepSel: true });
}

// ---------- Galleri ----------

S.gallery = { items: null, scanning: false, found: 0, filter: 'all', query: '', shown: 300 };
const MOVED_BADGE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#108a3c" stroke="#fff" stroke-width="1.5"/><path d="m7.2 12.4 3.2 3.2 6.4-6.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK_CIRCLE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="rgba(0,0,0,.25)" stroke="#fff" stroke-width="1.6"/><path d="m7.4 12.4 3 3 6.2-6.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLAY_BADGE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,.55)"/><path d="m10 7.5 6.5 4.5-6.5 4.5z" fill="#fff"/></svg>';
const galleryDate = (f) => Math.min(...[f.birth, f.mtime].filter(x => x > 0), Date.now());

function galleryCounts() {
  const items = S.gallery.items || [];
  const moved = items.filter(i => i.moved).length;
  return { all: items.length, moved, notMoved: items.length - moved };
}

function galleryVisible() {
  const g = S.gallery;
  let list = g.items || [];
  if (g.filter === 'moved') list = list.filter(i => i.moved);
  if (g.filter === 'notMoved') list = list.filter(i => !i.moved);
  if (g.query) {
    const q = g.query.toLowerCase();
    list = list.filter(i => i.path.toLowerCase().includes(q));
  }
  return [...list].sort((a, b) => galleryDate(b) - galleryDate(a));
}

async function startGalleryScan() {
  const g = S.gallery;
  g.scanning = true;
  g.found = 0;
  if (tab().loc === 'gallery:') renderView();
  const r = await fx.galleryScan();
  g.scanning = false;
  if (r.error) { toast(`Kunne ikke søke etter bilder: ${r.error}`, 'error'); g.items = g.items || []; }
  else g.items = r.files;
  const t = tab();
  if (t.loc === 'gallery:') { t.sel.clear(); load(t); }
}

let galleryMoveProgress = null;
function onGalleryProgress(p) {
  if (p.phase === 'scan') {
    S.gallery.found = p.found;
    const el = $('#gal-found');
    if (el) el.textContent = p.found.toLocaleString('nb-NO');
  } else if (p.phase === 'move' && galleryMoveProgress) galleryMoveProgress(p);
}

function buildGalleryBar() {
  const g = S.gallery;
  const t = tab();
  const c = galleryCounts();
  const sel = selectedItems(t);
  const selNotMoved = sel.filter(i => !i.moved);
  const chip = (key, label, n) => h('button', { class: 'chip' + (g.filter === key ? ' on' : ''), onclick: () => { g.filter = key; g.shown = 300; t.sel.clear(); load(t); } }, `${label} `, h('span', { class: 'chip-n' }, n.toLocaleString('nb-NO')));
  const bar = h('div', { class: 'gal-bar' },
    chip('all', 'Alle', c.all), chip('notMoved', 'Ikke flyttet', c.notMoved), chip('moved', 'Flyttet', c.moved),
    h('div', { class: 'spacer' }),
    sel.length ? h('span', { class: 'gal-selinfo' }, `${plural(sel.length, 'valgt', 'valgt')}`) : null,
    sel.length ? h('button', { class: 'btn', onclick: () => selectOnly(null) }, 'Fjern valg') : h('button', { class: 'btn', disabled: !t.items.length, onclick: selectAll }, 'Velg alle'),
    h('button', { class: 'btn accent', disabled: !selNotMoved.length, onclick: () => galleryMove(selNotMoved.map(i => i.path)) },
      ic('photos'), selNotMoved.length ? `Flytt ${plural(selNotMoved.length, 'valgt', 'valgte')}` : 'Flytt valgte'),
    h('button', { class: 'icon-btn', title: 'Søk etter bilder på nytt', disabled: g.scanning, onclick: startGalleryScan }, ic('refresh')));
  return bar;
}

function renderGallery(view) {
  const g = S.gallery;
  const t = tab();
  view.append(buildGalleryBar());

  if (g.scanning && !g.items) {
    view.append(h('div', { class: 'gal-empty' },
      h('div', { class: 'big-number', id: 'gal-found' }, g.found.toLocaleString('nb-NO')),
      h('p', {}, 'Søker etter bilder og videoer på Macen, i iCloud Drive, OneDrive, Google Drive og Dropbox …'),
      h('div', { class: 'progress indet', style: 'max-width:320px;margin:12px auto' }, h('div'))));
    return;
  }
  if (!t.items.length) {
    view.append(h('div', { class: 'gal-empty' }, h('p', {}, g.query ? 'Ingen bilder samsvarer med søket.' : g.filter === 'moved' ? 'Ingen bilder er flyttet til All Photos ennå.' : g.filter === 'notMoved' ? 'Alle bildene ligger allerede i All Photos.' : 'Fant ingen bilder.')));
    return;
  }

  const grid = h('div', { class: 'gal-grid' });
  for (const it of t.items.slice(0, g.shown)) {
    const thumb = h('div', { class: 'gthumb' }, iconEl(it, t, 160));
    if (kindOf(it) === 'video') thumb.append(h('span', { class: 'gplay', html: PLAY_BADGE }));
    if (it.onlineOnly) thumb.append(h('span', { class: 'gcloud', title: 'Ligger bare i skyen. Lastes ned når den flyttes.', html: ICONS.status.online }));
    thumb.append(h('span', { class: 'gcheck', html: CHECK_CIRCLE, title: 'Velg' }));
    if (it.moved) thumb.append(h('span', { class: 'gbadge', title: 'Ligger i All Photos', html: MOVED_BADGE }));
    else {
      const b = h('button', { class: 'gmove', title: 'Flytt til All Photos' }, 'Flytt');
      b.addEventListener('click', (e) => { e.stopPropagation(); galleryMove([it.path]); });
      b.addEventListener('dblclick', (e) => e.stopPropagation());
      thumb.append(b);
    }
    const where = it.moved ? 'All Photos' : (it.provider || basename(dirname(it.path)));
    grid.append(h('div', { class: 'gtile item', dataset: { path: it.path }, title: `${it.name}\n${dirname(it.path).replace(S.places.home, '~')}` },
      thumb, h('div', { class: 'gname' }, it.name), h('div', { class: 'gwhere' }, where)));
  }
  view.append(grid);
  if (t.items.length > g.shown) {
    const more = h('div', { class: 'gal-more' }, `Viser ${g.shown.toLocaleString('nb-NO')} av ${t.items.length.toLocaleString('nb-NO')} …`);
    view.append(more);
    const io = new IntersectionObserver((en) => {
      if (en.some(x => x.isIntersecting)) { io.disconnect(); g.shown += 300; renderView(); }
    }, { root: view, rootMargin: '600px' });
    io.observe(more);
  }
}

async function galleryMove(paths) {
  const g = S.gallery;
  const items = (g.items || []).filter(i => paths.includes(i.path) && !i.moved);
  if (!items.length) return;
  const inCloud = items.filter(i => i.provider);
  const online = items.filter(i => i.onlineOnly);
  if (inCloud.length) {
    const bytes = online.reduce((a, i) => a + (i.size || 0), 0);
    const r = await fx.confirm({
      message: items.length === 1 ? `Flytte «${items[0].name}» til All Photos?` : `Flytte ${items.length} bilder til All Photos?`,
      detail: `${plural(inCloud.length, 'fil', 'filer')} ligger i skylagring og fjernes fra skyen og andre enheter, men blir liggende trygt på Macen.`
        + (online.length ? ` ${plural(online.length, 'fil', 'filer')} må lastes ned først (${fmtSize(bytes)}).` : ''),
      buttons: ['Flytt', 'Avbryt'],
    });
    if (r !== 0) return;
  }
  let bar = null, text = null;
  if (items.length > 3 || online.length) {
    bar = h('div');
    text = h('p', {}, 'Forbereder …');
    modal([h('h3', { html: PS_ICON + 'Flytter bilder …' }), text, h('div', { class: 'progress' }, bar)],
      [h('button', { class: 'btn', onclick: () => { fx.psCancel(); text.textContent = 'Avbryter …'; } }, 'Avbryt')]);
    galleryMoveProgress = (p) => {
      bar.style.width = `${p.total ? Math.round(p.done / p.total * 100) : 100}%`;
      text.textContent = `${p.done.toLocaleString('nb-NO')} av ${p.total.toLocaleString('nb-NO')} filer`;
    };
  }
  const r = await fx.galleryMove(items.map(i => i.path));
  galleryMoveProgress = null;
  if (bar) closeModal();
  const map = new Map((r.moves || []).map(m => [m.from, m.to]));
  const t = tab();
  for (const it of g.items) {
    const to = map.get(it.path);
    if (to) {
      if (t.sel.has(it.path)) t.sel.delete(it.path);
      it.path = to; it.name = basename(to); it.moved = true; it.onlineOnly = false; it.provider = null;
    }
  }
  if (r.failed && r.failed.length) toast(`Kunne ikke flytte ${plural(r.failed.length, 'fil', 'filer')}: ${r.failed[0].error}`, 'error');
  else if (r.moved) toast(r.dups ? `Flyttet ${plural(r.moved, 'fil', 'filer')} til All Photos (${plural(r.dups, 'duplikat', 'duplikater')} lagt i Duplicates).` : `Flyttet ${plural(r.moved, 'fil', 'filer')} til All Photos.`);
  if (t.loc === 'gallery:') load(t, { keepSel: true });
}

// ---------- Oppdateringer ----------

let updateInfo = null;
let updateProgress = null;
let appVersion = '';

function setUpdateButton(state) {
  const b = $('#sb-update');
  if (!b) return;
  b.innerHTML = '';
  b.classList.toggle('available', state === 'available');
  if (state === 'checking') b.append(svg(ICONS.status.sync), 'Sjekker …');
  else if (state === 'available') b.append(ic('cloudDown'), `Oppdater til ${updateInfo.version}`);
  else b.append(ic('refresh'), 'Se etter oppdateringer');
  b.title = `Filutforsker ${appVersion}`;
}

async function checkUpdates(manual) {
  setUpdateButton('checking');
  const r = await fx.updateCheck();
  if (r.error) {
    setUpdateButton(updateInfo && updateInfo.available ? 'available' : 'idle');
    if (manual) toast(`Kunne ikke se etter oppdateringer: ${r.error}`, 'error');
    return;
  }
  updateInfo = r;
  setUpdateButton(r.available ? 'available' : 'idle');
  if (r.available) showUpdateBar();
  else if (manual) toast(`Du har den nyeste versjonen (${r.current}).`);
}

function closeUpdateBar() { $('#update-bar').hidden = true; }

function showUpdateBar() {
  const bar = $('#update-bar');
  bar.innerHTML = '';
  bar.hidden = false;
  bar.append(svg(INFO_ICON),
    h('div', { class: 'ub-text' }, h('b', {}, `Ny versjon tilgjengelig: ${updateInfo.version}`), ` (du har ${updateInfo.current})`),
    updateInfo.notes ? h('button', { class: 'btn', onclick: showUpdateNotes }, 'Hva er nytt') : null,
    h('button', { class: 'btn accent', onclick: installUpdate }, 'Oppdater nå'),
    h('button', { class: 'icon-btn small', title: 'Skjul', onclick: closeUpdateBar }, ic('close')));
}

function showUpdateNotes() {
  modal([h('h3', {}, `Nytt i versjon ${updateInfo.version}`), h('div', { class: 'notes' }, updateInfo.notes)], [
    h('button', { class: 'btn', onclick: closeModal }, 'Lukk'),
    h('button', { class: 'btn accent', onclick: () => { closeModal(); installUpdate(); } }, 'Oppdater nå'),
  ]);
}

async function installUpdate() {
  const bar = $('#update-bar');
  bar.hidden = false;
  bar.innerHTML = '';
  const text = h('div', { class: 'ub-text' }, 'Laster ned oppdatering …');
  const prog = h('div', { class: 'progress' }, h('div'));
  bar.append(svg(ICONS.status.sync), text, prog);
  updateProgress = (p) => {
    if (p.phase === 'download' && p.total) {
      prog.firstChild.style.width = `${Math.round(p.got / p.total * 100)}%`;
      text.textContent = `Laster ned oppdatering … ${fmtSize(p.got)} av ${fmtSize(p.total)}`;
    }
    if (p.phase === 'verify') text.textContent = 'Kontrollerer oppdateringen …';
  };
  const r = await fx.updateInstall();
  updateProgress = null;
  bar.innerHTML = '';
  if (r.error) {
    bar.append(svg(ICONS.status.error), h('div', { class: 'ub-text' }, r.error),
      r.needsDmg
        ? h('button', { class: 'btn accent', onclick: () => fx.openExternal(r.needsDmg) }, 'Last ned DMG')
        : h('button', { class: 'btn', onclick: installUpdate }, 'Prøv igjen'),
      h('button', { class: 'icon-btn small', title: 'Skjul', onclick: closeUpdateBar }, ic('close')));
    return;
  }
  bar.append(svg(ICONS.status.local), h('div', { class: 'ub-text' }, h('b', {}, `Versjon ${r.version} er klar.`), ' Filutforsker starter på nytt …'));
  setTimeout(() => fx.updateRestart(), 1500);
}

// ---------- Varsler ----------

let toastTimer = null;
function toast(msg, kind) {
  const t = $('#toast');
  t.innerHTML = '';
  if (kind === 'error') t.append(svg(ICONS.status.error));
  else if (kind === 'sync') t.append(svg(ICONS.status.sync));
  else t.append(svg(ICONS.status.local));
  t.append(h('span', {}, msg));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'error' ? 6000 : 2800);
}

// ---------- Kommandoer ----------

function command(cmd, anchor) {
  const t = tab();
  const inInput = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  const r = anchor ? anchor.getBoundingClientRect() : null;
  switch (cmd) {
    case 'new-menu': showMenu([
      { label: 'Mappe', icon: 'folderNew', key: '⇧⌘N', action: newFolder },
    ], r.left, r.bottom + 4); break;
    case 'sort-menu': showMenu(sortMenuItems(), r.left, r.bottom + 4); break;
    case 'view-menu': showMenu(viewMenuItems(), r.left, r.bottom + 4); break;
    case 'more-menu': showMenu(moreMenuItems(), r.left, r.bottom + 4); break;
    case 'cut': if (inInput) fx.editAction('cut'); else doCopy('cut'); break;
    case 'copy': if (inInput) fx.editAction('copy'); else doCopy('copy'); break;
    case 'paste': if (inInput) fx.editAction('paste'); else doPaste(); break;
    case 'select-all': if (inInput) fx.editAction('selectAll'); else selectAll(); break;
    case 'rename': if (!inInput) startRename(); break;
    case 'delete': if (!inInput) doDelete(); break;
    case 'open': selectedItems().forEach(openItem); break;
    case 'download': cloudAction('download'); break;
    case 'evict': cloudAction('evict'); break;
    case 'photo-sort': openPhotoSort(); break;
    case 'toggle-details': toggleDetails(); break;
    case 'toggle-hidden': toggleHidden(); break;
    case 'view-details': setView('details'); break;
    case 'view-list': setView('list'); break;
    case 'view-medium': setView('medium'); break;
    case 'view-large': setView('large'); break;
    case 'refresh': fx.places().then(p => { S.places = p; renderSidebar(); load(t, { keepSel: true }); }); break;
    case 'new-tab': addTab(currentDir() || 'start:'); break;
    case 'close-tab': closeTab(); break;
    case 'new-folder': newFolder(); break;
    case 'back': goBack(); break;
    case 'forward': goForward(); break;
    case 'up': goUp(); break;
    case 'go-home': navigate(S.places.home); break;
    case 'focus-address': editAddress(); break;
    case 'search': $('#search-input').focus(); $('#search-input').select(); break;
    case 'copy-path': copyPath(); break;
    case 'check-updates': checkUpdates(true); break;
  }
}

function editAddress() {
  const t = tab();
  const a = $('#address');
  const input = $('#address-input');
  a.classList.add('editing');
  input.value = isVirtual(t.loc) ? '' : t.loc;
  input.focus();
  input.select();
}

// ---------- Hendelser ----------

function bindEvents() {
  // Ikoner i knapper
  $$('[data-icon]').forEach(el => { el.innerHTML = ICONS.cmd[el.dataset.icon] || ''; });
  $('#btn-back').append(ic('back'));
  $('#btn-forward').append(ic('forward'));
  $('#btn-up').append(ic('up'));
  $('#btn-refresh').append(ic('refresh'));
  $('#new-tab').append(ic('plus'));
  $('#search-clear').append(ic('close'));
  $('#sb-details').append(ic('rows'));
  $('#sb-tiles').append(ic('tiles'));
  $('#searchbox .search-icon').innerHTML = ICONS.sidebar.search;

  $('#btn-back').addEventListener('click', goBack);
  $('#btn-forward').addEventListener('click', goForward);
  $('#btn-up').addEventListener('click', goUp);
  $('#btn-refresh').addEventListener('click', () => command('refresh'));
  $('#new-tab').addEventListener('click', () => addTab(currentDir() || 'start:'));
  $('#sb-details').addEventListener('click', () => setView('details'));
  $('#sb-tiles').addEventListener('click', () => setView('large'));
  $$('#commandbar .cmd').forEach(b => b.addEventListener('click', () => command(b.dataset.cmd, b)));

  // Adresselinje
  $('#address').addEventListener('click', (e) => { if (e.target.closest('.crumb, .crumb-sep')) return; editAddress(); });
  $('#address-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = e.target.value.trim(); $('#address').classList.remove('editing'); if (v) navigate(v); $('#content').focus(); }
    if (e.key === 'Escape') { $('#address').classList.remove('editing'); $('#content').focus(); }
    e.stopPropagation();
  });
  $('#address-input').addEventListener('blur', () => $('#address').classList.remove('editing'));

  // Søk
  $('#search-input').addEventListener('input', onSearchInput);
  $('#search-input').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { clearSearch(); $('#content').focus(); }
    if (e.key === 'Enter') { clearTimeout(searchTimer); const q = e.target.value.trim(); if (q && tab().loc !== 'gallery:') runSearch(q); }
    if (e.key === 'ArrowDown') { $('#content').focus(); const first = itemsInOrder()[0]; if (first) selectOnly(first); }
  });
  $('#search-clear').addEventListener('click', clearSearch);

  // Hovedvisning: klikk og menyer
  const view = $('#view');
  view.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    $('#content').focus();
    if (e.target.closest('.gmove, .gal-bar button')) return;
    const item = e.target.closest('.item');
    if (item && e.target.closest('.gcheck')) { onItemClick({ metaKey: true }, item.dataset.path); return; }
    if (item) {
      const t = tab();
      // Ved klikk på allerede valgt element (uten modifikatorer) vent til mouseup, slik at dra av flere fungerer.
      if (t.sel.has(item.dataset.path) && !e.shiftKey && !e.metaKey && !e.ctrlKey) return;
      onItemClick(e, item.dataset.path);
    } else if (!e.target.closest('.details-head, .start, .gal-bar, .gal-empty')) {
      startMarquee(e);
    }
  });
  view.addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (item && !e.shiftKey && !e.metaKey && !e.ctrlKey && tab().sel.size > 1 && !dragPaths) onItemClick(e, item.dataset.path);
  });
  view.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.item');
    if (item) openItem(findItem(item.dataset.path));
  });
  view.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const item = e.target.closest('.item');
    if (item) itemContextMenu(e, item.dataset.path);
    else if (!isVirtual(tab().loc)) { selectOnly(null); backgroundContextMenu(e); }
  });

  // Dra fra visningen
  view.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.item');
    if (!item) return;
    const t = tab();
    if (!t.sel.has(item.dataset.path)) { t.sel = new Set([item.dataset.path]); updateSelectionClasses(); }
    dragPaths = [...t.sel];
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragPaths));
    e.dataTransfer.setData('text/plain', dragPaths.join('\n'));
    e.dataTransfer.effectAllowed = 'copyMove';
  });
  view.addEventListener('dragend', () => { dragPaths = null; $$('.drop-target').forEach(el => el.classList.remove('drop-target')); view.classList.remove('drop-here'); });
  // Slipp på mapper i visningen eller på bakgrunnen
  view.addEventListener('dragover', (e) => {
    const ours = e.dataTransfer.types.includes(DRAG_TYPE);
    const files = e.dataTransfer.types.includes('Files');
    if (!ours && !files) return;
    const item = e.target.closest('.item');
    $$('#view .drop-target').forEach(el => el.classList.remove('drop-target'));
    const it = item && findItem(item.dataset.path);
    if (it && it.isDir && !it.isApp && !(dragPaths || []).includes(it.path)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = (!ours || e.altKey) ? 'copy' : 'move';
      item.classList.add('drop-target');
      view.classList.remove('drop-here');
      return;
    }
    if (currentDir() && !ours) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; view.classList.add('drop-here'); }
    else if (currentDir() && ours && e.altKey) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; view.classList.add('drop-here'); }
  });
  view.addEventListener('dragleave', (e) => { if (!view.contains(e.relatedTarget)) view.classList.remove('drop-here'); });
  view.addEventListener('drop', (e) => {
    view.classList.remove('drop-here');
    const item = e.target.closest('.item');
    const it = item && findItem(item.dataset.path);
    $$('#view .drop-target').forEach(el => el.classList.remove('drop-target'));
    let dir = null;
    if (it && it.isDir && !it.isApp) dir = it.path;
    else dir = currentDir();
    if (!dir) return;
    e.preventDefault();
    handleDrop(e, dir);
  });

  // Tastatur
  $('#content').addEventListener('keydown', onKey);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#menu-layer').hidden) closeMenu(); }
    if (document.activeElement === document.body && !e.metaKey) onKey(e);
  });
  $('#menu-layer').addEventListener('mousedown', (e) => { if (e.target.id === 'menu-layer') closeMenu(); });
  $('#menu-layer').addEventListener('contextmenu', (e) => { e.preventDefault(); closeMenu(); });

  // Sidepanel-bredde
  const sp = $('#splitter-left');
  sp.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const sx = e.clientX, sw = $('#sidebar').getBoundingClientRect().width;
    const move = (ev) => document.documentElement.style.setProperty('--sidebar-w', `${Math.max(160, Math.min(420, sw + ev.clientX - sx))}px`);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); LS.set('sidebarW', $('#sidebar').getBoundingClientRect().width); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
  const sw = LS.get('sidebarW', null);
  if (sw) document.documentElement.style.setProperty('--sidebar-w', `${sw}px`);

  window.addEventListener('resize', () => { if (S.view === 'list') renderView(); });

  fx.on('menu-cmd', (cmd) => command(cmd));
  fx.on('dir-changed', (dir) => {
    const t = tab();
    if (t.loc === dir && !t.search) load(t, { keepSel: true });
  });
  fx.on('ps-progress', (p) => { if (psProgressHandler) psProgressHandler(p); });
  fx.on('update-progress', (p) => { if (updateProgress) updateProgress(p); });
  fx.on('gallery-progress', onGalleryProgress);
  $('#sb-update').addEventListener('click', () => (updateInfo && updateInfo.available ? installUpdate() : checkUpdates(true)));
}

function onKey(e) {
  if (!$('#modal-layer').hidden) return;
  const t = tab();
  const order = itemsInOrder();
  const cur = t.focus && order.indexOf(t.focus);
  const move = (delta) => {
    if (!order.length) return;
    let i = cur == null || cur < 0 ? 0 : Math.max(0, Math.min(order.length - 1, cur + delta));
    if (e.shiftKey && t.anchor) {
      const a = order.indexOf(t.anchor);
      t.sel = new Set(order.slice(Math.min(a, i), Math.max(a, i) + 1));
      t.focus = order[i];
      updateSelectionClasses();
      const el = $(`#view .item[data-path="${CSS.escape(order[i])}"]`); if (el) el.scrollIntoView({ block: 'nearest' });
    } else selectOnly(order[i]);
    e.preventDefault();
  };
  const grid = S.view !== 'details' || t.loc === 'gallery:';
  const perRow = () => {
    if (!grid) return 1;
    const items = $$('#view .item');
    if (items.length < 2) return 1;
    if (S.view === 'list' && t.loc !== 'gallery:') return Math.max(1, Math.floor(($('#view').clientHeight - 16) / 26));
    const top = items[0].offsetTop;
    let n = 0; for (const el of items) { if (el.offsetTop !== top) break; n++; }
    return n || 1;
  };
  switch (e.key) {
    case 'ArrowDown':
      if (e.metaKey) { const it = findItem(t.focus); if (it) openItem(it); e.preventDefault(); break; }
      move(S.view === 'list' && t.loc !== 'gallery:' ? 1 : perRow()); break;
    case 'ArrowUp':
      if (e.metaKey) { goUp(); e.preventDefault(); break; }
      move(S.view === 'list' && t.loc !== 'gallery:' ? -1 : -perRow()); break;
    case 'ArrowRight': if (grid) move(S.view === 'list' && t.loc !== 'gallery:' ? perRow() : 1); break;
    case 'ArrowLeft': if (grid) move(S.view === 'list' && t.loc !== 'gallery:' ? -perRow() : -1); break;
    case 'Home': move(-1e9); break;
    case 'End': move(1e9); break;
    case 'Enter': { const sel = selectedItems(); if (sel.length === 1) openItem(sel[0]); else sel.filter(i => !i.isDir || i.isApp).forEach(openItem); e.preventDefault(); break; }
    case 'Backspace': if (!e.metaKey) { goBack(); e.preventDefault(); } break;
    case 'Delete': doDelete(); break;
    case 'F2': startRename(); e.preventDefault(); break;
    case 'F5': load(t, { keepSel: true }); break;
    case 'Escape': if (t.search) clearSearch(); else selectOnly(null); break;
    default:
      // Hopp til element ved å skrive forbokstaven
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) typeAhead(e.key);
  }
}

let taBuf = '', taTimer = null;
function typeAhead(ch) {
  taBuf += ch.toLowerCase();
  clearTimeout(taTimer);
  taTimer = setTimeout(() => { taBuf = ''; }, 900);
  const vis = visibleItems();
  const hit = vis.find(i => i.name.toLowerCase().startsWith(taBuf));
  if (hit) selectOnly(hit.path);
}

// Utvalgsrektangel
function startMarquee(e) {
  const view = $('#view');
  const t = tab();
  const base = (e.metaKey || e.ctrlKey || e.shiftKey) ? new Set(t.sel) : new Set();
  if (!e.metaKey && !e.ctrlKey && !e.shiftKey) { t.sel.clear(); t.focus = null; updateSelectionClasses(); }
  const vr = view.getBoundingClientRect();
  const sx = e.clientX - vr.left + view.scrollLeft, sy = e.clientY - vr.top + view.scrollTop;
  let box = null;
  const items = $$('#view .item').map(el => ({ el, p: el.dataset.path, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
  // offset relativt til view
  const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - vr.left + view.scrollLeft, y: r.top - vr.top + view.scrollTop, w: r.width, h: r.height }; };
  items.forEach(i => Object.assign(i, rel(i.el)));
  const move = (ev) => {
    const cx = ev.clientX - vr.left + view.scrollLeft, cy = ev.clientY - vr.top + view.scrollTop;
    if (!box) {
      if (Math.abs(cx - sx) < 4 && Math.abs(cy - sy) < 4) return;
      box = h('div', { id: 'marquee' });
      view.append(box);
    }
    const x = Math.min(sx, cx), y = Math.min(sy, cy), w = Math.abs(cx - sx), hh = Math.abs(cy - sy);
    Object.assign(box.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` });
    const sel = new Set(base);
    for (const i of items) if (i.x < x + w && i.x + i.w > x && i.y < y + hh && i.y + i.h > y) sel.add(i.p);
    t.sel = sel;
    $$('#view .item').forEach(el => el.classList.toggle('selected', sel.has(el.dataset.path)));
    // Rull automatisk nær kantene
    if (ev.clientY > vr.bottom - 20) view.scrollTop += 16;
    if (ev.clientY < vr.top + 20) view.scrollTop -= 16;
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    if (box) box.remove();
    updateSelectionClasses();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

// ---------- Oppstart ----------

async function init() {
  S.places = await fx.places();
  bindEvents();
  renderSidebar();
  const start = new URLSearchParams(location.search).get('start');
  S.tabs = [newTabState('start:')];
  S.active = 0;
  render();
  if (start) navigate(start);
  // Oppdater skytjenester jevnlig (f.eks. når OneDrive blir logget inn)
  setInterval(async () => {
    const p = await fx.places();
    if (JSON.stringify(p.clouds) !== JSON.stringify(S.places.clouds) || JSON.stringify(p.volumes) !== JSON.stringify(S.places.volumes)) {
      S.places = p; renderSidebar(); renderCrumbs();
    }
  }, 15000);
  $('#content').focus();
  appVersion = (await fx.appInfo()).version;
  setUpdateButton('idle');
  setTimeout(() => checkUpdates(false), 4000);
  setInterval(() => checkUpdates(false), 6 * 3600 * 1000);
}

init();
