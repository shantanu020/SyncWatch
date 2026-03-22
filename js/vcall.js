/* ============================================================
   VCALL.JS — Video Call Controls
   Vaultroom
   NOTE: Full WebRTC peer connections require a signaling server
   (e.g. Socket.IO + STUN/TURN). This module wires up the UI
   and provides the scaffolding for real integration.
============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Mic toggle
  $('vcBtnMic')?.addEventListener('click', toggleMic);

  // Camera toggle
  $('vcBtnCam')?.addEventListener('click', toggleCam);

  // End call → back to watch
  document.querySelector('.vcall-btn[data-vc="end"]')?.addEventListener('click', () => {
    setMode('watch');
    showToast('Call ended', 'info');
  });

  // Screen share (scaffold)
  document.querySelector('.vcall-btn[data-vc="screen"]')?.addEventListener('click', startScreenShare);

  // Back to watch
  document.querySelector('.vcall-btn[data-vc="back"]')?.addEventListener('click', () => setMode('watch'));
});

// ── Mic ───────────────────────────────────────────────────
function toggleMic() {
  AppState.micOn = !AppState.micOn;
  const btn = $('vcBtnMic');
  if (!btn) return;

  btn.textContent = AppState.micOn ? '🎙️' : '🔇';
  btn.className   = 'vcall-btn' + (AppState.micOn ? '' : ' muted');

  showToast(AppState.micOn ? 'Microphone on' : 'Microphone muted', 'info');

  // In production: audioTrack.enabled = AppState.micOn;
}

// ── Camera ─────────────────────────────────────────────────
function toggleCam() {
  AppState.camOn = !AppState.camOn;
  const btn = $('vcBtnCam');
  if (!btn) return;

  btn.textContent = AppState.camOn ? '📷' : '🚫';
  btn.className   = 'vcall-btn' + (AppState.camOn ? '' : ' muted');

  showToast(AppState.camOn ? 'Camera on' : 'Camera off', 'info');

  // In production: videoTrack.enabled = AppState.camOn;
}

// ── Screen share scaffold ──────────────────────────────────
async function startScreenShare() {
  showToast('Screen sharing requires WebRTC signaling server', 'info');

  /*
   * Production implementation:
   *
   * const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
   * const screenTrack = stream.getVideoTracks()[0];
   *
   * // Replace video track in all peer connections
   * peers.forEach(pc => {
   *   const sender = pc.getSenders().find(s => s.track?.kind === 'video');
   *   sender?.replaceTrack(screenTrack);
   * });
   *
   * screenTrack.onended = () => stopScreenShare();
   */
}

/* ============================================================
   WEBRTC SCAFFOLDING
   ── Plug in your signaling server below ──────────────────

   const ICE_SERVERS = [
     { urls: 'stun:stun.l.google.com:19302' },
     // Add TURN server for production NAT traversal:
     // { urls: 'turn:yourserver.com', username: '...', credential: '...' }
   ];

   const peers = {};   // peerId → RTCPeerConnection

   async function initLocalStream() {
     const stream = await navigator.mediaDevices.getUserMedia({
       video: { width: 1280, height: 720 },
       audio: { echoCancellation: true, noiseSuppression: true }
     });
     // Display in self-view tile
     document.querySelector('.vcall-self-tile video').srcObject = stream;
     return stream;
   }

   function createPeer(peerId, isInitiator, localStream) {
     const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

     localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

     pc.onicecandidate = e => {
       if (e.candidate) signal.send({ type: 'ice', to: peerId, candidate: e.candidate });
     };

     pc.ontrack = e => {
       // Attach remote stream to that peer's video tile
       const tile = document.getElementById(`tile-${peerId}`);
       if (tile) tile.srcObject = e.streams[0];
     };

     if (isInitiator) {
       pc.createOffer()
         .then(offer => pc.setLocalDescription(offer))
         .then(() => signal.send({ type: 'offer', to: peerId, sdp: pc.localDescription }));
     }

     peers[peerId] = pc;
     return pc;
   }

   // Handle incoming signaling messages:
   signal.on('offer',     async ({ from, sdp }) => { ... });
   signal.on('answer',    async ({ from, sdp }) => { ... });
   signal.on('ice',       async ({ from, candidate }) => { ... });
   signal.on('peer-join', ({ peerId }) => createPeer(peerId, true, localStream));
   signal.on('peer-left', ({ peerId }) => { peers[peerId]?.close(); delete peers[peerId]; });

============================================================ */
