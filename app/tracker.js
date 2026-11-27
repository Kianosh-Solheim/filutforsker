'use strict';
// Menylinje-ikon for arbeid som pågår (kopiering, flytting, sletting, bildesortering).
// Vises bare mens noe pågår. Lukkes vinduet, fortsetter arbeidet i bakgrunnen og ikonet viser
// fremdriften. Når alt er ferdig og ingen vinduer er åpne, kommer et varsel og appen avslutter.

const { Tray, Menu, nativeImage, Notification, app } = require('electron');
const icons = require('./trayicons');

const ops = new Map();
let tray = null;
let hooks = { showWindow() {}, hasWindows: () => true };
let renderTimer = null;
let quitTimer = null;
const results = [];

function init(h) { hooks = { ...hooks, ...h }; }
function active() { return ops.size; }

function image(key) {
  const [a, b] = key === 'done' ? icons.done : icons.steps[key];
  const img = nativeImage.createFromBuffer(Buffer.from(a, 'base64'), { scaleFactor: 1 });
  img.addRepresentation({ scaleFactor: 2, buffer: Buffer.from(b, 'base64') });
  img.setTemplateImage(true);
  return img;
}

function fmtDuration(sec) {
  if (!isFinite(sec) || sec <= 0) return '';
  if (sec < 10) return 'noen sekunder igjen';
  if (sec < 60) return `ca. ${Math.round(sec / 5) * 5} sekunder igjen`;
  const min = Math.round(sec / 60);
  if (min < 60) return `ca. ${min} ${min === 1 ? 'minutt' : 'minutter'} igjen`;
  const hrs = Math.floor(min / 60), rest = min % 60;
  return `ca. ${hrs} ${hrs === 1 ? 'time' : 'timer'}${rest ? ` ${rest} min` : ''} igjen`;
}

// info: { label, cancel() }
function start(id, info) {
  if (quitTimer) { clearTimeout(quitTimer); quitTimer = null; }
  ops.set(id, { id, label: info.label, cancel: info.cancel, frac: 0, eta: '', current: '', samples: [], indeterminate: true, cancelling: false, started: Date.now() });
  // Vent litt, så korte operasjoner ikke får ikonet til å blinke.
  setTimeout(() => { if (ops.has(id)) schedule(); }, 900);
}

// p: { done, total } (antall eller byte), current, indeterminate
function update(id, p) {
  const op = ops.get(id);
  if (!op) return;
  op.indeterminate = !!p.indeterminate || !p.total;
  op.frac = p.total ? Math.max(0, Math.min(1, p.done / p.total)) : 0;
  op.current = p.current || '';
  if (p.cancelling) op.cancelling = true;
  const now = Date.now();
  op.samples.push({ t: now, v: p.done || 0 });
  while (op.samples.length > 2 && now - op.samples[0].t > 5000) op.samples.shift();
  const a = op.samples[0], b = op.samples[op.samples.length - 1];
  const rate = b.t - a.t > 800 ? (b.v - a.v) / ((b.t - a.t) / 1000) : 0;
  op.eta = rate > 0 && p.total ? fmtDuration((p.total - p.done) / rate) : '';
  if (tray) schedule();
}

function end(id, summary) {
  const op = ops.get(id);
  ops.delete(id);
  if (op && summary && Date.now() - op.started > 900) results.push(summary);
  if (ops.size) { schedule(); return; }
  idle();
}

function schedule() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => { renderTimer = null; render(); }, 400);
}

function overall() {
  const list = [...ops.values()];
  if (!list.length) return 0;
  return list.reduce((s, o) => s + o.frac, 0) / list.length;
}

function render() {
  if (!ops.size) return;
  if (!tray) {
    tray = new Tray(image(0));
    tray.on('click', () => tray.popUpContextMenu());
  }
  const frac = overall();
  const allIndet = [...ops.values()].every(o => o.indeterminate);
  const step = Math.min(100, Math.floor((frac * 100) / 5) * 5);
  tray.setImage(image(step));
  tray.setTitle(allIndet ? '' : ` ${Math.floor(frac * 100)} %`, { fontType: 'monospacedDigit' });
  tray.setToolTip(`Filutforsker: ${[...ops.values()].map(o => o.label).join(', ')}`);

  const items = [{ label: ops.size === 1 ? 'Filutforsker arbeider' : `Filutforsker: ${ops.size} operasjoner pågår`, enabled: false }, { type: 'separator' }];
  for (const op of ops.values()) {
    const pct = op.indeterminate ? 'forbereder …' : `${Math.floor(op.frac * 100)} %`;
    items.push({ label: `${op.label}: ${op.cancelling ? 'avbryter …' : pct}`, enabled: false });
    const detail = [op.eta, op.current].filter(Boolean).join(' · ');
    if (detail) items.push({ label: `    ${detail.length > 60 ? detail.slice(0, 57) + '…' : detail}`, enabled: false });
    items.push({ label: '    Avbryt', enabled: !op.cancelling, click: () => { op.cancelling = true; try { op.cancel(); } catch {} schedule(); } });
  }
  items.push({ type: 'separator' }, { label: 'Vis Filutforsker', click: () => hooks.showWindow() });
  if (!hooks.hasWindows()) items.push({ label: 'Stopp og avslutt', click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function idle() {
  if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
  const done = results.splice(0);
  if (hooks.hasWindows()) {
    // Vinduet viser selv at det er ferdig.
    if (tray) { tray.destroy(); tray = null; }
    return;
  }
  // Ingen vinduer: vis ferdig-merke, gi beskjed og avslutt.
  if (tray) {
    tray.setImage(image('done'));
    tray.setTitle(' Ferdig', { fontType: 'monospacedDigit' });
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Ferdig', enabled: false },
      ...done.slice(0, 5).map(s => ({ label: s.length > 70 ? s.slice(0, 67) + '…' : s, enabled: false })),
      { type: 'separator' },
      { label: 'Vis Filutforsker', click: () => { if (quitTimer) clearTimeout(quitTimer); quitTimer = null; tray.destroy(); tray = null; hooks.showWindow(); } },
      { label: 'Avslutt', click: () => app.quit() },
    ]));
  }
  if (Notification.isSupported() && done.length) {
    const n = new Notification({ title: 'Filutforsker er ferdig', body: done.join('\n'), silent: false });
    n.on('click', () => { if (quitTimer) clearTimeout(quitTimer); quitTimer = null; if (tray) { tray.destroy(); tray = null; } hooks.showWindow(); });
    n.show();
  }
  quitTimer = setTimeout(() => { quitTimer = null; if (!ops.size && !hooks.hasWindows()) app.quit(); }, 12000);
}

function cancelAll() { for (const op of ops.values()) { try { op.cancel(); } catch {} } }

// Kalles når et vindu åpnes igjen, slik at appen ikke avslutter seg selv.
function windowOpened() {
  if (quitTimer) { clearTimeout(quitTimer); quitTimer = null; if (tray && !ops.size) { tray.destroy(); tray = null; } }
}

module.exports = { init, start, update, end, active, cancelAll, windowOpened };
