/* ============================================================
   QUEUE.JS — Media Queue Management
   All queue changes are broadcast via Sync so every viewer
   sees the same queue and same media loading in their player.
============================================================ */

'use strict';

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  AppState.queue = [];
  renderQueue();

  $('btnAddQueue')?.addEventListener('click', addToQueue);
  $('qUrl')?.addEventListener('keydown', e => { if (e.key === 'Enter') addToQueue(); });
});

// ── Render ─────────────────────────────────────────────────
function renderQueue() {
  const list = $('queueList');
  if (!list) return;

  if (!AppState.queue.length) {
    const hostNote = AppState.isHost ? 'Add a URL below to get started.' : 'Waiting for host to add media…';
    list.innerHTML = `<div style="text-align:center;color:var(--text3);padding:32px 16px;font-size:12px;font-family:var(--mono);line-height:2">QUEUE EMPTY<br>${hostNote}</div>`;
    return;
  }

  list.innerHTML = AppState.queue.map((item, i) => {
    const isPlaying = i === AppState.queueIdx;
    return `
      <div class="queue-row ${isPlaying ? 'now-playing' : ''}" data-qidx="${i}" role="button" tabindex="0">
        <div class="queue-thumb">${item.icon}</div>
        <div class="queue-info">
          <div class="queue-title">${esc(item.title)}</div>
          <div class="queue-sub">${item.type === 'yt' ? 'YOUTUBE' : item.type === 'audio' ? 'AUDIO' : 'VIDEO'}</div>
        </div>
        <div class="queue-dur">${item.dur}</div>
      </div>`;
  }).join('');

  $$('#queueList .queue-row').forEach(row => {
    row.addEventListener('click', () => {
      if (!AppState.isHost) { showToast('Only the host can change what plays', 'error'); return; }
      playQueueIdx(+row.dataset.qidx);
    });
  });

  // Show/hide add section based on host status
  const addArea = document.querySelector('.queue-add');
  if (addArea) addArea.style.display = AppState.isHost ? '' : 'none';
}

// ── Play item ──────────────────────────────────────────────
// suppressBroadcast = true when called from a remote sync event
function playQueueIdx(idx, suppressBroadcast) {
  if (idx < 0 || idx >= AppState.queue.length) return;

  AppState.queueIdx    = idx;
  AppState.currentTime = 0;
  const item = AppState.queue[idx];

  renderQueue();

  const pEmpty = $('playerEmpty');
  const pFrame = $('playerFrame');
  const mViz   = $('musicViz');

  pEmpty.style.display = 'none';

  if (AppState.mode === 'music') {
    pFrame.style.display = 'none';
    mViz.style.display   = 'flex';
    updateVizTrack?.();
  } else {
    mViz.style.display   = 'none';
    pFrame.style.display = 'block';
    loadIntoFrame(item);
  }

  AppState.isPlaying = true;
  $('ctrlPlay').textContent = '⏸';

  addChatMessage('', `▶ Now playing: ${item.title}`, -1);
  if (!suppressBroadcast) {
    showToast('Playing: ' + item.title, 'success');
    Sync.emitQueuePlay(idx, AppState.queue);
  }
}

// ── Load media into iframe ─────────────────────────────────
function loadIntoFrame(item) {
  const frame = $('playerFrame');
  if (!frame) return;

  if (item.type === 'yt') {
    frame.innerHTML = `
      <iframe
        src="${item.src}"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowfullscreen
        style="width:100%;height:100%;border:none;display:block">
      </iframe>`;
  } else if (item.type === 'audio') {
    frame.innerHTML = `
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#050607">
        <audio controls autoplay style="width:80%;max-width:480px">
          <source src="${esc(item.src)}">
          Your browser does not support audio.
        </audio>
      </div>`;
  } else {
    frame.innerHTML = `
      <video controls autoplay style="width:100%;height:100%;background:#000;display:block">
        <source src="${esc(item.src)}">
        <p style="color:var(--text2);text-align:center;padding:40px">Cannot load media.</p>
      </video>`;
  }

  const vid = frame.querySelector('video');
  if (vid) {
    vid.volume = AppState.volume / 100;
    vid.addEventListener('play',  () => { AppState.isPlaying = true;  $('ctrlPlay').textContent = '⏸'; });
    vid.addEventListener('pause', () => { AppState.isPlaying = false; $('ctrlPlay').textContent = '▶'; });
    vid.addEventListener('ended', () => { if (AppState.isHost) playNext(); });
  }
}

// ── Add URL to queue ───────────────────────────────────────
function addToQueue() {
  if (!AppState.isHost) {
    showToast('Only the host can add media', 'error');
    return;
  }

  const urlEl   = $('qUrl');
  const titleEl = $('qTitle');
  const url     = urlEl?.value.trim();
  const title   = titleEl?.value.trim() || '';

  if (!url) { showToast('Please enter a URL', 'error'); return; }

  const media = detectMedia(url);
  const displayTitle = title || url.split('/').pop().split('?')[0] || 'Media';

  const item = {
    title: displayTitle,
    src:   media.src,
    type:  media.type,
    dur:   '--:--',
    icon:  media.icon,
  };

  AppState.queue.push(item);
  if (urlEl)   urlEl.value   = '';
  if (titleEl) titleEl.value = '';

  renderQueue();
  Sync.emitQueueAdd(item);
  showToast('Added to queue!', 'success');

  if (AppState.queueIdx === -1) playQueueIdx(0);
}
