/* ============================================================
   CHAT.JS — Live Chat & Reactions (broadcasts via Sync)
============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  $('chatSendBtn')?.addEventListener('click', sendChat);
  $('chatInp')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  $$('.rbt[data-emoji]').forEach(btn => {
    btn.addEventListener('click', () => {
      sendReaction(btn.dataset.emoji);
    });
  });
});

// ── Add message (local render) ─────────────────────────────
function addChatMessage(name, text, colorIdx) {
  const scroll = $('chatScroll');
  if (!scroll) return;

  const div = document.createElement('div');
  div.className = 'chat-msg';

  if (colorIdx === -1) {
    div.innerHTML = `<div class="cmsg-system">${esc(text)}</div>`;
  } else {
    const [fg, bg] = getColor(colorIdx >= 0 ? colorIdx : 0);
    const timeStr  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <div class="cmsg-av" style="background:${bg};color:${fg}">${(name||'?')[0].toUpperCase()}</div>
      <div class="cmsg-body">
        <div class="cmsg-header">
          <span class="cmsg-name" style="color:${fg}">${esc(name)}</span>
          <span class="cmsg-time">${timeStr}</span>
        </div>
        <div class="cmsg-text">${esc(text)}</div>
      </div>`;
  }

  scroll.appendChild(div);
  scroll.scrollTop = scroll.scrollHeight;
}

// ── Send chat (local + broadcast) ─────────────────────────
function sendChat() {
  const inp  = $('chatInp');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;

  const ci = 0; // own messages always color index 0
  addChatMessage(AppState.username, text, ci);
  Sync.emitChat(AppState.username, text, ci);
  inp.value = '';

  if (!$('pane-chat')?.classList.contains('active')) switchTab('chat');
}

// ── Floating reaction (local + broadcast) ─────────────────
function sendReaction(emoji) {
  _floatReaction(emoji);               // show locally immediately
  Sync.emitReaction(emoji);            // send to others
}

function _floatReaction(emoji) {
  const layer = $('reactLayer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className   = 'rfloat';
  el.textContent = emoji;
  el.style.left   = (Math.random() * 78 + 8) + '%';
  el.style.bottom = '80px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
