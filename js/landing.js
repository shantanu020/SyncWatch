/* ============================================================
   LANDING.JS — Landing Page Logic
============================================================ */

'use strict';

const PUBLIC_ROOMS = [
  { name: 'Sci-Fi Sunday Marathon 🚀',  viewers: 7,  type: 'MOVIE',  emoji: '🎬', live: true,  bg: 'linear-gradient(135deg,#0a0c1a,#151030)' },
  { name: 'Lo-Fi Study Session 🎵',     viewers: 34, type: 'MUSIC',  emoji: '🎵', live: true,  bg: 'linear-gradient(135deg,#080d0e,#0a1a14)' },
  { name: 'Classic Noir Night 🎞',       viewers: 5,  type: 'MOVIE',  emoji: '🎞', live: false, bg: 'linear-gradient(135deg,#0f0a08,#1a1008)' },
  { name: 'Anime Watch-Along 🌸',        viewers: 12, type: 'STREAM', emoji: '🌸', live: true,  bg: 'linear-gradient(135deg,#0e080f,#180a14)' },
  { name: 'Concert Livestream 🎤',       viewers: 89, type: 'LIVE',   emoji: '🎤', live: true,  bg: 'linear-gradient(135deg,#0a0a08,#161410)' },
  { name: 'Horror Movie Night 👻',       viewers: 9,  type: 'MOVIE',  emoji: '👻', live: false, bg: 'linear-gradient(135deg,#080a08,#0a140a)' },
];

function renderPublicRooms() {
  const grid = $('publicRoomsGrid');
  if (!grid) return;

  grid.innerHTML = PUBLIC_ROOMS.map((room, i) => {
    const viewers  = room.viewers + (Math.random() * 4 | 0);
    const tagClass = room.live ? 'tag-live' : room.type === 'MUSIC' ? 'tag-music' : 'tag-movie';
    const tagLabel = room.live ? '● LIVE' : room.type;
    const avatars  = [...Array(Math.min(3, viewers))].map((_, j) => {
      const [fg, bg] = getColor(i + j);
      return `<div class="mini-av" style="background:${bg};color:${fg};border-color:var(--bg2)">${String.fromCharCode(65+j)}</div>`;
    }).join('');
    return `
      <div class="room-card" data-room="${esc(room.name)}" role="button" tabindex="0">
        <div class="room-thumb" style="background:${room.bg}">
          <span>${room.emoji}</span>
          <div class="room-overlay"></div>
          <div class="room-tag ${tagClass}">${tagLabel}</div>
        </div>
        <div class="room-info">
          <div class="room-title">${esc(room.name)}</div>
          <div class="room-meta">
            <div class="room-viewers"><div class="mini-avs">${avatars}</div><span class="room-count">${viewers} watching</span></div>
            <span class="room-type-tag">${room.type}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.room-card').forEach(card => {
    const handler = () => joinPublicRoom(card.dataset.room);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
  });
}

function joinPublicRoom(name) {
  const code = genCode();
  // Joining a public room — NOT host
  AppState.setRoom(code, name, 'public', 'You', false);
  window.location.href = 'room.html';
}

function setupCreate() {
  $$('#createTypePicker .type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#createTypePicker .type-btn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
    });
  });

  $('btnDoCreate').addEventListener('click', () => {
    const name = $('c-name').value.trim() || 'Movie Night';
    const user = $('c-user').value.trim() || 'Anonymous';
    const type = document.querySelector('#createTypePicker .type-btn.sel')?.dataset.type || 'private';
    const code = genCode();

    // Creator is always host
    AppState.setRoom(code, name, type, user, true);

    $('readyCode').textContent = code;
    $('readyLink').textContent = `vaultroom.app/r/${code}`;

    closeModal('create');
    openModal('ready');
  });

  $('btnCopyCode').addEventListener('click', () => copyText(AppState.roomCode, 'Room code copied'));
  $('btnCopyLink').addEventListener('click', () => copyText(`https://vaultroom.app/r/${AppState.roomCode}`, 'Invite link copied'));
  $('btnEnterRoom').addEventListener('click', () => { window.location.href = 'room.html'; });
}

function setupJoin() {
  $('btnDoJoin').addEventListener('click', () => {
    const user    = $('j-user').value.trim() || 'Anonymous';
    const rawCode = $('j-code').value.trim();
    if (!rawCode) { showToast('Enter a room code or link', 'error'); return; }
    const code = rawCode.includes('/') ? rawCode.split('/').pop() : rawCode;
    // Joiner is NOT host
    AppState.setRoom(code.toUpperCase(), `Watch Party · ${code.toUpperCase()}`, 'private', user, false);
    window.location.href = 'room.html';
  });
  $('j-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnDoJoin').click(); });
}

function setupNav() {
  $('btnCreateNav')?.addEventListener('click', () => openModal('create'));
  $('btnJoinNav')?.addEventListener('click',   () => openModal('join'));
  $('btnCreateHero')?.addEventListener('click', () => openModal('create'));
  $('btnJoinHero')?.addEventListener('click',   () => openModal('join'));
}

document.addEventListener('DOMContentLoaded', () => {
  renderPublicRooms();
  setupNav();
  setupCreate();
  setupJoin();
});
