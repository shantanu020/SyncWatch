/* ============================================================
   STATE.JS — Shared App State
   Vaultroom
============================================================ */

'use strict';

const AppState = {
  roomCode:    null,
  roomName:    null,
  username:    'Anonymous',
  roomType:    'private',
  isHost:      false,   // ← true for room creator

  mode:        'watch',
  isPlaying:   false,
  currentTime: 0,
  duration:    0,
  volume:      80,

  queue:       [],
  queueIdx:    -1,
  viewers:     [],

  micOn:  true,
  camOn:  true,

  setRoom(code, name, type, user, isHost) {
    this.roomCode = code;
    this.roomName = name || 'Watch Party';
    this.roomType = type || 'private';
    this.username = user || 'Anonymous';
    this.isHost   = !!isHost;
    try {
      sessionStorage.setItem('vr_room', JSON.stringify({
        code:   this.roomCode,
        name:   this.roomName,
        type:   this.roomType,
        user:   this.username,
        isHost: this.isHost,
      }));
    } catch (_) {}
  },

  loadFromSession() {
    try {
      const raw = sessionStorage.getItem('vr_room');
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.roomCode = d.code;
      this.roomName = d.name;
      this.roomType = d.type;
      this.username = d.user;
      this.isHost   = !!d.isHost;
      return true;
    } catch (_) { return false; }
  },

  reset() {
    this.roomCode    = null;
    this.roomName    = null;
    this.isHost      = false;
    this.isPlaying   = false;
    this.currentTime = 0;
    this.duration    = 0;
    this.queue       = [];
    this.queueIdx    = -1;
    this.viewers     = [];
    this.mode        = 'watch';
    try { sessionStorage.removeItem('vr_room'); } catch (_) {}
  },
};
