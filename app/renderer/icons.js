'use strict';
// Egne ikoner i Windows 11-ånd (tegnet for denne appen).

const ICONS = (() => {
  const page = (accent, glyph = '') => `
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M11 4h18l10 10v28a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#fff" stroke="#9a9a9a" stroke-width="1"/>
  <path d="M29 4v8a2 2 0 0 0 2 2h8" fill="#e8e8e8" stroke="#9a9a9a" stroke-width="1"/>
  ${accent ? `<rect x="9.5" y="30" width="29" height="10" rx="1" fill="${accent}"/>` : ''}
  ${glyph}
</svg>`;

  const label = (t, color = '#fff') =>
    `<text x="24" y="37.6" text-anchor="middle" font-family="Segoe UI, -apple-system, Helvetica, Arial" font-size="7.4" font-weight="700" fill="${color}">${t}</text>`;

  const folder = (overlay = '') => `
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 11a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#e8a400"/>
  <path d="M4 17a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#ffc83d"/>
  <path d="M4 17a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v2H4z" fill="#ffd970" opacity=".7"/>
  ${overlay}
</svg>`;

  const glyphOnFolder = (inner, color) =>
    `<g transform="translate(15 20)"><rect width="18" height="18" rx="4" fill="${color}"/>${inner}</g>`;

  const cloudShape = (fill, stroke = 'none') =>
    `<path d="M14 36h22a8 8 0 0 0 1.2-15.9A11 11 0 0 0 16 18.5 9 9 0 0 0 14 36z" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;

  const providers = {
    icloud: ['#3d9df3', '#bfe0ff'],
    onedrive: ['#0a64c8', '#7ab8f5'],
    gdrive: ['#1e8e3e', '#a8dab5'],
    dropbox: ['#2f62f5', '#a9bdfd'],
    proton: ['#6d4aff', '#c9bdff'],
    box: ['#0061d5', '#a3c8f4'],
    cloud: ['#5c6b7a', '#c9d2db'],
  };
  const providerIcon = (id) => {
    const [a, b] = providers[id] || providers.cloud;
    return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 38h22a9 9 0 0 0 1.4-17.9A12 12 0 0 0 15.5 18 10 10 0 0 0 14 38z" fill="${b}"/>
      <path d="M14 38h22a9 9 0 0 0 1.4-17.9A12 12 0 0 0 15.5 18 10 10 0 0 0 14 38z" fill="none" stroke="${a}" stroke-width="3"/>
    </svg>`;
  };

  const sidebar = {
    start: `<svg viewBox="0 0 24 24"><path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="#ffc83d" stroke="#c98a00" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="#6aa9e8"/><path d="M4.5 20.5c.6-4.2 3.6-6.5 7.5-6.5s6.9 2.3 7.5 6.5z" fill="#2f74c0"/></svg>`,
    desktop: `<svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="1.6" fill="#3a8ee6"/><rect x="4" y="5.5" width="16" height="10" rx=".8" fill="#9fd0ff"/><rect x="9" y="17" width="6" height="2" fill="#7a8794"/><rect x="7" y="19" width="10" height="1.6" rx=".8" fill="#7a8794"/></svg>`,
    documents: `<svg viewBox="0 0 24 24"><path d="M6 2.5h8l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5z" fill="#5f8fd6"/><path d="M14 2.5v5h5" fill="#a9c8f2"/><path d="M8 12h8M8 15h8M8 18h5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    downloads: `<svg viewBox="0 0 24 24"><path d="M12 3v11m0 0-4.5-4.5M12 14l4.5-4.5" stroke="#1f9d55" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="#1f9d55" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>`,
    pictures: `<svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="16" rx="2" fill="#4aa3df"/><circle cx="8" cy="9" r="2" fill="#ffe27a"/><path d="M2.5 17.5 9 12l4 3.5 3-2.5 5.5 4.5V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill="#2e8b57"/></svg>`,
    videos: `<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2" fill="#8e5bd8"/><path d="m10 9 5 3-5 3z" fill="#fff"/></svg>`,
    music: `<svg viewBox="0 0 24 24"><path d="M9 17.5V6l10-2v11.5" stroke="#e0533d" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="6.6" cy="17.6" r="2.6" fill="#e0533d"/><circle cx="16.6" cy="15.6" r="2.6" fill="#e0533d"/></svg>`,
    drive: `<svg viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="10" rx="2" fill="#8a96a3"/><rect x="2.5" y="7" width="19" height="4" rx="2" fill="#b7c1cb"/><circle cx="18" cy="14" r="1.1" fill="#3ddc84"/></svg>`,
    usb: `<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="7" rx="1" fill="#a5adb6"/><rect x="5" y="9" width="14" height="12.5" rx="2" fill="#4f5b66"/><rect x="9" y="4.5" width="2" height="2" fill="#4f5b66"/><rect x="13" y="4.5" width="2" height="2" fill="#4f5b66"/></svg>`,
    apps: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" fill="#2f74c0"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#e0533d"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#1f9d55"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#ffb300"/></svg>`,
    search: `<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" stroke="#5c6b7a" stroke-width="2" fill="none"/><path d="m15 15 5.5 5.5" stroke="#5c6b7a" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  };

  // Ikoner for kommandolinjen (strek, følger tekstfargen)
  const s = (d, extra = '') => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;
  const cmd = {
    back: s('<path d="M16 10H4m0 0 5-5M4 10l5 5"/>'),
    forward: s('<path d="M4 10h12m0 0-5-5m5 5-5 5"/>'),
    up: s('<path d="M10 16V4m0 0L5 9m5-5 5 5"/>'),
    refresh: s('<path d="M15.5 8A6 6 0 1 0 16 11"/><path d="M16 3.5V8h-4.5"/>'),
    chevron: s('<path d="m7.5 5 5 5-5 5"/>'),
    chevronDown: s('<path d="m5 7.5 5 5 5-5"/>'),
    plus: s('<path d="M10 4v12M4 10h12"/>'),
    close: s('<path d="m5.5 5.5 9 9m0-9-9 9"/>'),
    newItem: s('<circle cx="10" cy="10" r="7"/><path d="M10 6.5v7M6.5 10h7"/>'),
    cut: s('<circle cx="6" cy="14.5" r="2.5"/><circle cx="14" cy="14.5" r="2.5"/><path d="M7.6 12.6 14 3.5M12.4 12.6 6 3.5"/>'),
    copy: s('<rect x="7" y="7" width="9.5" height="10" rx="1.6"/><path d="M13 7V4.6A1.6 1.6 0 0 0 11.4 3H5.1a1.6 1.6 0 0 0-1.6 1.6v7.3a1.6 1.6 0 0 0 1.6 1.6H7"/>'),
    paste: s('<path d="M7 4H5.5A1.5 1.5 0 0 0 4 5.5v11A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 14.5 4H13"/><rect x="7" y="2.5" width="6" height="3" rx="1"/>'),
    rename: s('<rect x="2.5" y="6" width="15" height="8" rx="1.5"/><path d="M12.5 3.5v13M10.5 3.5h4M10.5 16.5h4"/>'),
    trash: s('<path d="M4 5.5h12M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.8 10.6A1.5 1.5 0 0 0 7.8 17.5h4.4a1.5 1.5 0 0 0 1.5-1.4l.8-10.6M8.5 9v5M11.5 9v5"/>'),
    sort: s('<path d="M6 3.5v13m0 0-3-3m3 3 3-3M14 16.5v-13m0 0-3 3m3-3 3 3"/>'),
    view: s('<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>'),
    details: s('<rect x="2.5" y="3.5" width="15" height="13" rx="1.6"/><path d="M12.5 3.5v13"/>'),
    more: `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4.5" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="15.5" cy="10" r="1.4"/></svg>`,
    cloudDown: s('<path d="M6 14.5H5.2A3.7 3.7 0 0 1 5 7.1a5 5 0 0 1 9.6 1A3.2 3.2 0 0 1 14.5 14.5H14"/><path d="M10 9.5v7m0 0-2.5-2.5M10 16.5l2.5-2.5"/>'),
    cloudFree: s('<path d="M5.5 15.5h9a3.3 3.3 0 0 0 .3-6.6A5 5 0 0 0 5.2 8a3.8 3.8 0 0 0 .3 7.5z"/>'),
    photos: s('<rect x="2.5" y="4" width="15" height="12" rx="1.8"/><circle cx="7" cy="8" r="1.4"/><path d="m2.8 14 4.2-3.8 3 2.6 2.4-2 4.6 3.8"/>'),
    finder: s('<rect x="3" y="3" width="14" height="14" rx="3"/><path d="M10 3v14M6.5 8v1.5M13.5 8v1.5M6.5 13c2 1.3 5 1.3 7 0"/>'),
    terminal: s('<rect x="2.5" y="3.5" width="15" height="13" rx="1.6"/><path d="m5.5 8 2.5 2-2.5 2M10 12.5h4"/>'),
    link: s('<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.8.8"/><path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.8-.8"/>'),
    open: s('<path d="M11 3.5h5.5V9M16.5 3.5 9 11M14 12v3.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H8"/>'),
    eye: s('<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.3"/>'),
    check: s('<path d="m4.5 10.5 3.5 3.5 7.5-8"/>'),
    list: s('<path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.5" cy="5" r=".6" fill="currentColor"/><circle cx="3.5" cy="10" r=".6" fill="currentColor"/><circle cx="3.5" cy="15" r=".6" fill="currentColor"/>'),
    tiles: s('<rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="11" width="6.5" height="6.5" rx="1.2"/>'),
    rows: s('<path d="M3 5h14M3 10h14M3 15h14"/>'),
    hidden: s('<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><path d="m3.5 3.5 13 13"/>'),
    folderNew: s('<path d="M2.5 6V5a1.5 1.5 0 0 1 1.5-1.5h3.5L9 5h7a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M10 8v5.5M7.3 10.8h5.4"/>'),
  };

  // Statusikoner for skyen
  const status = {
    online: `<svg viewBox="0 0 16 16"><path d="M4.7 12.5h6.8a2.8 2.8 0 0 0 .3-5.6A4.1 4.1 0 0 0 4.1 6 3.3 3.3 0 0 0 4.7 12.5z" fill="none" stroke="#0a64c8" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    local: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2" fill="none" stroke="#108a3c" stroke-width="1.3"/><path d="m5.2 8.2 1.9 1.9 3.8-4" fill="none" stroke="#108a3c" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sync: `<svg viewBox="0 0 16 16" class="spin"><path d="M13 8a5 5 0 0 1-8.6 3.5M3 8a5 5 0 0 1 8.6-3.5" fill="none" stroke="#0a64c8" stroke-width="1.4" stroke-linecap="round"/><path d="M11.8 2.2v2.6H9.2M4.2 13.8v-2.6h2.6" fill="none" stroke="#0a64c8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.6" fill="#c42b1c"/><path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    conflict: `<svg viewBox="0 0 16 16"><path d="M8 1.8 15 14H1z" fill="#f7a400" stroke="#c98200" stroke-width=".6" stroke-linejoin="round"/><path d="M8 6v4" stroke="#1b1b1b" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="#1b1b1b"/></svg>`,
  };

  const kinds = {
    folder: folder(),
    file: page(null, ''),
    text: page(null, '<path d="M15 20h18M15 24h18M15 28h18M15 32h12" stroke="#9a9a9a" stroke-width="1.6" stroke-linecap="round"/>'),
    image: `<svg viewBox="0 0 48 48"><rect x="6" y="9" width="36" height="30" rx="3" fill="#4aa3df"/><circle cx="16" cy="18" r="3.6" fill="#ffe27a"/><path d="M6 33 18 22l8 7 6-5 10 8v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="#2e8b57"/></svg>`,
    video: `<svg viewBox="0 0 48 48"><rect x="5" y="10" width="38" height="28" rx="3" fill="#7d4fc9"/><rect x="5" y="10" width="38" height="5" rx="2" fill="#9b74de"/><path d="m20 19 10 6-10 6z" fill="#fff"/></svg>`,
    audio: page('#e0533d', label('LYD')) ,
    pdf: page('#d13438', label('PDF')),
    word: page('#185abd', label('DOC')),
    excel: page('#107c41', label('XLS')),
    ppt: page('#c43e1c', label('PPT')),
    pages: page('#f2a516', label('PAGES')),
    numbers: page('#1f9d55', label('NUM')),
    keynote: page('#2f74c0', label('KEY')),
    archive: `<svg viewBox="0 0 48 48"><rect x="7" y="8" width="34" height="32" rx="3" fill="#ffc83d"/><rect x="7" y="8" width="34" height="8" rx="3" fill="#e8a400"/><path d="M24 8v28" stroke="#8a5a00" stroke-width="3" stroke-dasharray="2.4 2.4"/><rect x="21" y="30" width="6" height="7" rx="1.2" fill="#8a5a00"/></svg>`,
    code: page('#5c6b7a', label('&lt;/&gt;')),
    app: `<svg viewBox="0 0 48 48"><rect x="7" y="7" width="34" height="34" rx="9" fill="#2f74c0"/><rect x="7" y="7" width="34" height="17" rx="9" fill="#5b9be0"/><path d="M17 31 24 17l7 14M19.5 26h9" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
    disk: `<svg viewBox="0 0 48 48"><rect x="6" y="11" width="36" height="26" rx="4" fill="#d4d4d4" stroke="#9a9a9a"/><circle cx="24" cy="24" r="8" fill="#bcbcbc" stroke="#8a8a8a"/><circle cx="24" cy="24" r="2" fill="#6a6a6a"/></svg>`,
    link: page(null, '<path d="M17 30c0-6 4-9 10-9h3m0 0-3.5-3.5M30 21l-3.5 3.5" stroke="#2f74c0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  };

  return { kinds, sidebar, cmd, status, providerIcon, folder, glyphOnFolder };
})();
