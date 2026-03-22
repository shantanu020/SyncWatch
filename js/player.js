/* ============================================================
   PLAYER.JS — Media Player Controls
   Broadcasts play/pause/seek via Sync so all viewers stay
   in frame-perfect sync.
============================================================ */

'use strict';

let _ticker = null;

document.addEventListener('DOMContentLoaded', () => {
  $('ctrlPlay')?.addEventListener('click', togglePlay);
  $('ctrlPrev')?.addEventListener('click', playPrev);
  $('ctrlNext')?.addEventListener('click', playNext);
  $('progTrack')?.addEventListener('click', seekTo);
  $('volSlider')?.addEventListener('input', e => setVolume(+e.target.value));
  $('ctrlFullscreen')?.addEventListener('click', toggleFullscreen);
  startTicker();
});

// ── Play / Pause ───────────────────────────────────────────
function togglePlay() {
  // Only the host controls playback
  if (!AppState.isHost) {
    showToast('Only the host can control playback', 'error');
    return;
  }

  AppState.isPlaying = !AppState.isPlaying;
  $('ctrlPlay').textContent = AppState.isPlaying ? '⏸' : '▶';

  const vid = document.querySelector('#playerFrame video');
  const ct  = vid ? vid.currentTime : AppState.currentTime;

  if (AppState.isPlaying) {
    vid?.play().catch(() => {});
    Sync.emitPlay(ct);
  } else {
    vid?.pause();
    Sync.emitPause(ct);
  }
}

// ── Prev / Next ────────────────────────────────────────────
function playPrev() {
  if (!AppState.isHost) return;
  if (AppState.queueIdx > 0) playQueueIdx(AppState.queueIdx - 1);
}

function playNext() {
  if (!AppState.isHost) return;
  if (AppState.queueIdx < AppState.queue.length - 1) playQueueIdx(AppState.queueIdx + 1);
}

// ── Seek ───────────────────────────────────────────────────
function seekTo(e) {
  if (!AppState.isHost) {
    showToast('Only the host can seek', 'error');
    return;
  }
  const track = $('progTrack');
  if (!track) return;
  const pct = Math.max(0, Math.min(1, e.offsetX / track.offsetWidth));
  const vid  = document.querySelector('#playerFrame video');
  const dur  = vid?.duration || AppState.duration || 0;
  const t    = pct * dur;

  AppState.currentTime = t;
  if (vid) vid.currentTime = t;
  updateProgBar(t, dur);
  Sync.emitSeek(t);
}

// ── Volume (local only) ────────────────────────────────────
function setVolume(val) {
  AppState.volume = val;
  const vid = document.querySelector('#playerFrame video');
  if (vid) vid.volume = val / 100;
}

// ── Fullscreen ─────────────────────────────────────────────
function toggleFullscreen() {
  const area = $('playerArea');
  if (!document.fullscreenElement) area?.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.().catch(() => {});
}

// ── Progress UI ────────────────────────────────────────────
function updateProgBar(cur, dur) {
  AppState.currentTime = cur;
  AppState.duration    = dur || 0;
  const pct = dur > 0 ? (cur / dur * 100).toFixed(2) : 0;
  const fill = $('progFill');
  if (fill) fill.style.width = pct + '%';
  const time = $('progTime');
  if (time) time.textContent = `${fmtTime(cur)} / ${fmtTime(dur || 0)}`;
}

// ── Ticker ─────────────────────────────────────────────────
function startTicker() {
  clearInterval(_ticker);
  _ticker = setInterval(() => {
    const vid = document.querySelector('#playerFrame video');
    if (vid && vid.duration) {
      updateProgBar(vid.currentTime, vid.duration);
      AppState.isPlaying = !vid.paused;
      $('ctrlPlay').textContent = vid.paused ? '▶' : '⏸';
    } else if (AppState.isPlaying) {
      // YouTube iframe — simulate tick
      updateProgBar(AppState.currentTime + 1, AppState.duration || 7200);
    }

    // Show host controls locked state to non-hosts
    const isHostCtrl = AppState.isHost;
    ['ctrlPlay','ctrlPrev','ctrlNext','progTrack'].forEach(id => {
      const el = $(id);
      if (el) el.style.opacity = isHostCtrl ? '1' : '0.45';
    });
  }, 1000);
}
