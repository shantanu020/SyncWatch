/* ============================================================
   ROOM.JS — Room Bootstrap, Mode Switching, Sidebar Tabs
   Vaultroom  (no fake users — only real joiners appear)
============================================================ */

'use strict';

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!AppState.loadFromSession()) {
    window.location.href = 'index.html';
    return;
  }

  const title = AppState.roomName || `Room ${AppState.roomCode}`;
  $('navRoomTitle').textContent = title;
  $('sbRoomName').textContent   = title;
  $('shareCode').textContent    = AppState.roomCode;
  $('shareLink').textContent    = `vaultroom.app/r/${AppState.roomCode}`;

  // Show host crown badge
  if (AppState.isHost) {
    const badge = $('hostBadge');
    if (badge) badge.style.display = '';
  }

  // Only the real user — zero fake people
  AppState.viewers = [{
    name: AppState.username,
    ping: 0,
    ci:   _colorIdx(AppState.username),
    you:  true,
    role: AppState.isHost ? 'Host' : 'Viewer',
  }];

  renderViewers();
  updateViewerBadge();
  buildMusicViz();
  setupModeButtons();
  setupSidebarTabs();
  setupNavButtons();
  setupShare();

  // ── Wire up Sync ────────────────────────────────────────
  Sync.join(AppState.roomCode, AppState.username);

  Sync.on('peer-join',      onPeerJoin);
  Sync.on('peer-left',      onPeerLeft);
  Sync.on('heartbeat',      onHeartbeat);
  Sync.on('state-request',  onStateRequest);
  Sync.on('state-response', onStateResponse);
  Sync.on('play',           onRemotePlay);
  Sync.on('pause',          onRemotePause);
  Sync.on('seek',           onRemoteSeek);
  Sync.on('queue-add',      onRemoteQueueAdd);
  Sync.on('queue-play',     onRemoteQueuePlay);
  Sync.on('chat',           onRemoteChat);
  Sync.on('reaction',       onRemoteReaction);

  // Stale-viewer cleanup
  setInterval(pruneStaleViewers, 10000);
});

// ── Peer tracking ──────────────────────────────────────────
const _lastSeen = {};

function onPeerJoin({ username, ci }) {
  if (!username || username === AppState.username) return;
  _lastSeen[username] = Date.now();
  if (!AppState.viewers.find(v => v.name === username)) {
    AppState.viewers.push({ name: username, ping: 0, ci: ci ?? _colorIdx(username), you: false, role: 'Viewer' });
    renderViewers();
    updateViewerBadge();
    addChatMessage('', `${username} joined the room`, -1);
  }
  if (AppState.isHost) Sync.emitStateResponse(AppState.username, username);
}

function onPeerLeft({ username }) {
  if (!username) return;
  AppState.viewers = AppState.viewers.filter(v => v.name !== username);
  delete _lastSeen[username];
  renderViewers();
  updateViewerBadge();
  addChatMessage('', `${username} left the room`, -1);
}

function onHeartbeat({ username }) {
  if (!username || username === AppState.username) return;
  _lastSeen[username] = Date.now();
  if (!AppState.viewers.find(v => v.name === username)) {
    AppState.viewers.push({ name: username, ping: 0, ci: _colorIdx(username), you: false, role: 'Viewer' });
    renderViewers();
    updateViewerBadge();
  }
}

function pruneStaleViewers() {
  const STALE = 20000;
  const now   = Date.now();
  const before = AppState.viewers.length;
  AppState.viewers = AppState.viewers.filter(v =>
    v.you || (_lastSeen[v.name] && now - _lastSeen[v.name] < STALE)
  );
  if (AppState.viewers.length !== before) { renderViewers(); updateViewerBadge(); }
}

// ── State sync for late joiners ────────────────────────────
function onStateRequest({ username }) {
  if (username === AppState.username) return;
  if (AppState.isHost) Sync.emitStateResponse(AppState.username, username);
}

function onStateResponse({ to, state }) {
  if (to !== AppState.username || !state) return;

  if (state.queue && state.queue.length > 0) {
    AppState.queue = state.queue;
    renderQueue();
  }

  if (state.queueIdx >= 0 && AppState.queue[state.queueIdx]) {
    playQueueIdx(state.queueIdx, true); // true = suppress re-broadcast
    setTimeout(() => {
      const drift  = state.isPlaying ? (Date.now() - state.updatedAt) / 1000 : 0;
      const target = (state.currentTime || 0) + drift;
      _seekVideoTo(target);
      if (!state.isPlaying) {
        const vid = document.querySelector('#playerFrame video');
        if (vid) vid.pause();
        $('ctrlPlay').textContent = '▶';
        AppState.isPlaying = false;
      }
    }, 700);
  }
}

// ── Remote playback events ─────────────────────────────────
function onRemotePlay({ currentTime }) {
  AppState.isPlaying = true;
  $('ctrlPlay').textContent = '⏸';
  const vid = document.querySelector('#playerFrame video');
  if (vid) { if (currentTime != null) vid.currentTime = currentTime; vid.play().catch(() => {}); }
  showToast('▶ Host pressed play', 'info');
}

function onRemotePause({ currentTime }) {
  AppState.isPlaying = false;
  $('ctrlPlay').textContent = '▶';
  const vid = document.querySelector('#playerFrame video');
  if (vid) { if (currentTime != null) vid.currentTime = currentTime; vid.pause(); }
  showToast('⏸ Host paused', 'info');
}

function onRemoteSeek({ currentTime }) {
  _seekVideoTo(currentTime);
  showToast(`⏩ Seeked to ${fmtTime(currentTime)}`, 'info');
}

function onRemoteQueueAdd({ queue }) {
  AppState.queue = queue;
  renderQueue();
  showToast('🎬 Media added to queue', 'info');
}

function onRemoteQueuePlay({ idx, queue }) {
  AppState.queue = queue;
  playQueueIdx(idx, true);
}

function onRemoteChat({ username, text, ci }) {
  if (username === AppState.username) return;
  addChatMessage(username, text, ci ?? _colorIdx(username));
}

function onRemoteReaction({ emoji }) {
  _floatReaction(emoji);
}

// ── Helpers ────────────────────────────────────────────────
function _seekVideoTo(t) {
  const vid = document.querySelector('#playerFrame video');
  if (vid && isFinite(t)) vid.currentTime = t;
  AppState.currentTime = t || 0;
}

function _colorIdx(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 6;
}

function _floatReaction(emoji) {
  const layer = $('reactLayer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'rfloat';
  el.textContent = emoji;
  el.style.left   = (Math.random() * 78 + 8) + '%';
  el.style.bottom = '80px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Mode switching ─────────────────────────────────────────
function setupModeButtons() {
  $$('.rail-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
  $('railShare')?.addEventListener('click', () => openModal('share'));
  $('railLeave')?.addEventListener('click', leaveRoom);
}

function setMode(mode) {
  AppState.mode = mode;
  $$('.rail-btn[data-mode]').forEach(b => b.classList.remove('active'));
  document.querySelector(`.rail-btn[data-mode="${mode}"]`)?.classList.add('active');

  const pEmpty = $('playerEmpty'), pFrame = $('playerFrame');
  const mViz = $('musicViz'),    vcall  = $('vcallOverlay');

  vcall.style.display = 'none';
  mViz.style.display  = 'none';

  if (mode === 'call') {
    vcall.style.display  = 'block';
    pEmpty.style.display = 'none';
    buildVCallGrid();
    showToast('Video call mode', 'info');
  } else if (mode === 'music') {
    if (AppState.queueIdx === -1) { pEmpty.style.display = ''; pFrame.style.display = 'none'; }
    else { pEmpty.style.display = 'none'; pFrame.style.display = 'none'; mViz.style.display = 'flex'; updateVizTrack(); }
    showToast('Music mode — visualizer active', 'success');
  } else {
    if (AppState.queueIdx === -1) { pEmpty.style.display = ''; pFrame.style.display = 'none'; }
    else { pEmpty.style.display = 'none'; pFrame.style.display = 'block'; }
  }
}

// ── Sidebar tabs ───────────────────────────────────────────
function setupSidebarTabs() {
  $$('.sb-tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  $$('.sb-tab').forEach(b => b.classList.remove('active'));
  $$('.sb-pane').forEach(p => p.classList.remove('active'));
  document.querySelector(`.sb-tab[data-tab="${tab}"]`)?.classList.add('active');
  $(`pane-${tab}`)?.classList.add('active');
}

// ── Nav ────────────────────────────────────────────────────
function setupNavButtons() {
  $('btnLeaveRoom')?.addEventListener('click', leaveRoom);
  $('btnShareRoom')?.addEventListener('click', () => openModal('share'));
  $('sbShareBtn')?.addEventListener('click', () => openModal('share'));
  $('btnOpenQueue')?.addEventListener('click', () => switchTab('queue'));
}

function leaveRoom() {
  Sync.leave(AppState.username);
  AppState.reset();
  window.location.href = 'index.html';
}

// ── Share ──────────────────────────────────────────────────
function setupShare() {
  $('btnShareCopyCode')?.addEventListener('click', () => copyText(AppState.roomCode, 'Room code copied'));
  $('btnShareCopyLink')?.addEventListener('click', () => copyText(`https://vaultroom.app/r/${AppState.roomCode}`, 'Invite link copied'));
}

// ── Viewers ────────────────────────────────────────────────
function updateViewerBadge() {
  const n = AppState.viewers.length;
  const label = `${n} VIEWER${n !== 1 ? 'S' : ''}`;
  $('navViewerPill').textContent = label;
  $('sbViewerBadge').textContent = label;
}

function renderViewers() {
  const list = $('viewersList');
  if (!list) return;
  if (AppState.viewers.length === 1 && AppState.viewers[0].you) {
    list.innerHTML = `<div style="text-align:center;color:var(--text3);padding:32px 20px;font-size:12px;font-family:var(--mono);line-height:2">ONLY YOU HERE<br>Share the invite link<br>to invite friends!</div>`;
    updateViewerBadge(); return;
  }
  list.innerHTML = AppState.viewers.map(v => {
    const [fg, bg] = getColor(v.ci ?? 0);
    const pingC  = v.you ? 'ping-good' : v.ping < 50 ? 'ping-good' : v.ping < 100 ? 'ping-ok' : 'ping-bad';
    return `
      <div class="viewer-row">
        <div class="viewer-av" style="background:${bg};color:${fg}">${(v.name||'?')[0].toUpperCase()}</div>
        <div class="viewer-info">
          <div class="viewer-name">${esc(v.name)}${v.you ? ' <span style="font-size:10px;color:var(--gold)">(you)</span>' : ''}</div>
          <div class="viewer-sub">${v.role ?? (v.you ? 'HOST' : 'VIEWER')} · SYNCED</div>
        </div>
        <div class="viewer-ping ${pingC}">${v.you ? '—' : v.ping + 'ms'}</div>
      </div>`;
  }).join('');
  updateViewerBadge();
}

// ── Music visualizer ───────────────────────────────────────
function buildMusicViz() {
  const bars = $('vizBars');
  if (!bars) return;
  bars.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const b = document.createElement('div');
    b.className = 'viz-bar';
    const hmin = Math.random() * 6 + 4, hmax = Math.random() * 55 + 16;
    const spd  = (Math.random() * 0.8 + 0.4).toFixed(2);
    b.style.cssText = `--hmin:${hmin}px;--hmax:${hmax}px;--spd:${spd}s;height:${hmin}px;animation-delay:${(Math.random()*0.8).toFixed(2)}s`;
    bars.appendChild(b);
  }
}

function updateVizTrack() {
  const item = AppState.queue[AppState.queueIdx];
  if (!item) return;
  $('vizIcon').textContent   = item.icon  || '🎵';
  $('vizTitle').textContent  = item.title || 'Unknown Track';
  $('vizArtist').textContent = item.type === 'yt' ? 'YouTube' : item.type === 'audio' ? 'Audio file' : 'Media';
}

// ── Video call grid ────────────────────────────────────────
function buildVCallGrid() {
  const grid = $('vcallGrid');
  if (!grid) return;
  grid.innerHTML = AppState.viewers.slice(0,4).map((v, i) => {
    const [fg, bg] = getColor(v.ci ?? 0);
    return `
      <div class="vcall-tile ${i===0?'speaking':''}" style="background:${bg}18">
        <div class="vcall-av" style="background:${bg};color:${fg}">${(v.name||'?')[0]}</div>
        <div class="vcall-name-tag">${esc(v.name)} <span>${i===0?'🎙️':'🔇'}</span></div>
      </div>`;
  }).join('');
}
