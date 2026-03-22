/* ============================================================
   SYNC.JS — Real-time Room Sync Engine
   Vaultroom

   HOW IT WORKS (no server required for same-browser tabs):
   ─ BroadcastChannel: instant messaging between tabs on the
     same origin (simulates WebSocket within one browser)
   ─ localStorage room key: persists queue, playback state,
     and viewer list so late joiners load the current state
   ─ Every action (play, pause, seek, queue-add, chat) is
     broadcast + written to storage so all tabs stay in sync

   FOR PRODUCTION replace BroadcastChannel with a real
   WebSocket / Socket.IO server — the API surface is identical.
============================================================ */

'use strict';

const Sync = (() => {

  const STORAGE_PREFIX = 'vr_';
  let   _channel       = null;   // BroadcastChannel
  let   _roomCode      = null;
  let   _handlers      = {};     // event → [fn, ...]
  let   _heartbeatTimer = null;

  // ── Public API ────────────────────────────────────────────

  function join(roomCode, username) {
    _roomCode = roomCode.toUpperCase();
    _channel  = new BroadcastChannel(`vaultroom_${_roomCode}`);

    _channel.onmessage = e => _dispatch(e.data);

    // Announce presence
    _send('peer-join', { username, ci: _colorIdx(username) });

    // Request current state from anyone already in the room
    _send('state-request', { username });

    // Heartbeat so others know we're still here
    _heartbeatTimer = setInterval(() => {
      _send('heartbeat', { username });
    }, 8000);

    // On page unload announce departure
    window.addEventListener('beforeunload', () => leave(username));

    console.log(`[Sync] Joined room ${_roomCode} as "${username}"`);
  }

  function leave(username) {
    _send('peer-left', { username });
    clearInterval(_heartbeatTimer);
    _channel?.close();
  }

  function on(event, fn) {
    if (!_handlers[event]) _handlers[event] = [];
    _handlers[event].push(fn);
  }

  // ── Room state in localStorage ────────────────────────────

  function getRoomState() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + _roomCode);
      return raw ? JSON.parse(raw) : _defaultState();
    } catch (_) {
      return _defaultState();
    }
  }

  function setRoomState(patch) {
    const current = getRoomState();
    const next    = { ...current, ...patch, updatedAt: Date.now() };
    try {
      localStorage.setItem(STORAGE_PREFIX + _roomCode, JSON.stringify(next));
    } catch (_) {}
    return next;
  }

  function clearRoomState() {
    try { localStorage.removeItem(STORAGE_PREFIX + _roomCode); } catch (_) {}
  }

  // ── Emit helpers (broadcast + optionally persist) ─────────

  function emitPlay(currentTime) {
    const payload = { currentTime, at: Date.now() };
    setRoomState({ isPlaying: true, currentTime });
    _send('play', payload);
  }

  function emitPause(currentTime) {
    const payload = { currentTime, at: Date.now() };
    setRoomState({ isPlaying: false, currentTime });
    _send('pause', payload);
  }

  function emitSeek(currentTime) {
    const payload = { currentTime, at: Date.now() };
    setRoomState({ currentTime });
    _send('seek', payload);
  }

  function emitQueueAdd(item) {
    const state    = getRoomState();
    const newQueue = [...(state.queue || []), item];
    setRoomState({ queue: newQueue });
    _send('queue-add', { item, queue: newQueue });
  }

  function emitQueuePlay(idx, queue) {
    setRoomState({ queueIdx: idx, queue, isPlaying: true, currentTime: 0 });
    _send('queue-play', { idx, queue });
  }

  function emitChat(username, text, ci) {
    _send('chat', { username, text, ci, t: Date.now() });
  }

  function emitReaction(emoji) {
    _send('reaction', { emoji });
  }

  function emitStateResponse(username, targetUser) {
    // Only respond to the user who asked
    const state = getRoomState();
    _send('state-response', { to: targetUser, state });
  }

  // ── Internal ──────────────────────────────────────────────

  function _send(type, data = {}) {
    if (!_channel) return;
    _channel.postMessage({ type, ...data });
  }

  function _dispatch(msg) {
    const fns = _handlers[msg.type] || [];
    fns.forEach(fn => fn(msg));
  }

  function _defaultState() {
    return {
      isPlaying:  false,
      currentTime: 0,
      queue:      [],
      queueIdx:   -1,
      viewers:    [],
      updatedAt:  Date.now(),
    };
  }

  // Deterministic colour index from username string
  function _colorIdx(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h % 6;
  }

  return {
    join,
    leave,
    on,
    getRoomState,
    setRoomState,
    clearRoomState,
    emitPlay,
    emitPause,
    emitSeek,
    emitQueueAdd,
    emitQueuePlay,
    emitChat,
    emitReaction,
    emitStateResponse,
  };
})();
