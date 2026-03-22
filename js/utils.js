/* ============================================================
   UTILS.JS — Shared Utilities
   Vaultroom
============================================================ */

'use strict';

// ── DOM helpers ────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── HTML escape ────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Format seconds → m:ss or h:mm:ss ──────────────────────
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const h = (s / 3600) | 0;
  const m = ((s % 3600) / 60) | 0;
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// ── Random room code ───────────────────────────────────────
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...Array(7)].map((_, i) =>
    i === 3 ? '-' : chars[Math.random() * chars.length | 0]
  ).join('');
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const stack = $('toastStack');
  if (!stack) return;

  const icons = { success: '✓', error: '✕', info: '·' };
  const iconClass = `toast-icon-${type}`;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="${iconClass}">${icons[type] || '·'}</span>${esc(msg)}`;
  stack.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity 0.25s, transform 0.25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => el.remove(), 280);
  }, 2800);
}

// ── Copy to clipboard ──────────────────────────────────────
async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label + '!', 'success');
  } catch {
    showToast('Could not copy — try manually', 'error');
  }
}

// ── Avatar colour palette ──────────────────────────────────
const PALETTE = [
  ['#e8c97e', 'rgba(232,201,126,0.14)'],
  ['#1de9b6', 'rgba(29,233,182,0.12)'],
  ['#22d3ee', 'rgba(34,211,238,0.10)'],
  ['#e8445a', 'rgba(232,68,90,0.12)'],
  ['#a78bfa', 'rgba(167,139,250,0.12)'],
  ['#fb923c', 'rgba(251,146,60,0.12)'],
];

function getColor(idx) {
  return PALETTE[((idx % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

// ── Modal helpers ──────────────────────────────────────────
function openModal(id) {
  const el = $(`modal-${id}`);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = $(`modal-${id}`);
  if (el) el.classList.remove('open');
}

// Close modals on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  $$('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => {
      if (e.target === bd) bd.classList.remove('open');
    });
  });

  // Close buttons
  $$('.modal-close[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });
});

// ── Extract YouTube ID ─────────────────────────────────────
function extractYtId(url) {
  const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  return m ? m[1] : null;
}

// ── Detect media type from URL ─────────────────────────────
function detectMedia(url) {
  if (url.match(/youtu/i)) {
    const id = extractYtId(url);
    return {
      type: 'yt',
      src: id ? `https://www.youtube.com/embed/${id}?autoplay=1&modestbranding=1&rel=0` : url,
      icon: '▶',
    };
  }
  if (url.match(/vimeo\.com/i)) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    return {
      type: 'yt',
      src: m ? `https://player.vimeo.com/video/${m[1]}?autoplay=1` : url,
      icon: '🎬',
    };
  }
  if (url.match(/\.(mp3|ogg|wav|flac|aac|m4a)(\?|$)/i)) {
    return { type: 'audio', src: url, icon: '🎵' };
  }
  if (url.match(/twitch\.tv/i)) {
    const m = url.match(/twitch\.tv\/([^/?]+)/);
    return {
      type: 'yt',
      src: m ? `https://player.twitch.tv/?channel=${m[1]}&parent=${location.hostname || 'localhost'}` : url,
      icon: '🎮',
    };
  }
  return { type: 'video', src: url, icon: '🎬' };
}

// ── Throttle ───────────────────────────────────────────────
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}
