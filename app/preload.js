'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('fx', {
  platform: process.platform,
  places: inv('places'),
  list: inv('list'),
  stat: inv('stat'),
  exists: inv('exists'),
  cloudStatus: inv('cloud-status'),
  cloudDownload: inv('cloud-download'),
  cloudEvict: inv('cloud-evict'),
  diskInfo: inv('disk-info'),
  thumb: inv('thumb'),
  fileIcon: inv('file-icon'),
  search: inv('search'),
  recent: inv('recent'),
  open: inv('open'),
  reveal: inv('reveal'),
  openTerminal: inv('open-terminal'),
  copyText: inv('copy-text'),
  editAction: inv('edit-action'),
  trash: inv('trash'),
  mkdir: inv('mkdir'),
  rename: inv('rename'),
  copyInto: inv('copy-into'),
  moveInto: inv('move-into'),
  watch: inv('watch'),
  confirm: inv('confirm'),
  psScan: inv('ps-scan'),
  psRun: inv('ps-run'),
  psCancel: inv('ps-cancel'),
  galleryScan: inv('gallery-scan'),
  galleryMove: inv('gallery-move'),
  appInfo: inv('app-info'),
  updateCheck: inv('update-check'),
  updateInstall: inv('update-install'),
  updateRestart: inv('update-restart'),
  openExternal: inv('open-external'),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  on: (ch, fn) => {
    const allowed = ['menu-cmd', 'dir-changed', 'ps-progress', 'update-progress', 'gallery-progress'];
    if (!allowed.includes(ch)) return;
    ipcRenderer.on(ch, (_e, ...a) => fn(...a));
  },
});
