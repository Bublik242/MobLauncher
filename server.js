'use strict';
/**
 * MobLauncher friends server (protocol: see ../SPEC.md).
 * Players prove identity with the Minecraft session protocol (client "join" -> server "hasJoined"),
 * so nobody can impersonate another player. Works with Microsoft and Ely.by accounts.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT ?? 8787);
const DATA = process.env.MOB_DATA || path.join(__dirname, 'data', 'db.json');
const INSECURE = process.env.MOB_INSECURE_AUTH === '1';
const MOJANG = (process.env.MOB_MOJANG_SESSION || 'https://sessionserver.mojang.com').replace(/\/$/, '');
const ELYBY = (process.env.MOB_ELYBY_SESSION || 'https://authserver.ely.by').replace(/\/$/, '');
const MAX_FRAME = 1.5 * 1024 * 1024, MAX_TEXT = 2000, MAX_HISTORY = 500, MAX_FRIENDS = 200, MAX_PENDING = 100;
const ID_RE = /^(microsoft|elyby):[0-9a-f]{32}$/;

// ---------------- storage ----------------
let db = { users: {}, chats: {}, unread: {} };
try { db = { users: {}, chats: {}, unread: {}, ...JSON.parse(fs.readFileSync(DATA, 'utf8')) }; } catch {}
let saveT = null;
function flush() { try { fs.mkdirSync(path.dirname(DATA), { recursive: true }); const tmp = DATA + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DATA); } catch (e) { console.error('save failed', e.message); } }
const save = () => { clearTimeout(saveT); saveT = setTimeout(flush, 300); };
const pairKey = (a, b) => [a, b].sort().join('|');

// ---------------- state ----------------
const socks = new Map();     // userId -> Set<ws>
const presence = new Map();  // userId -> {status, playing}
const online = (id) => !!(socks.get(id) && socks.get(id).size);
const ref = (id) => { const u = db.users[id]; return u ? { id: u.id, name: u.name, uuid: u.uuid, provider: u.provider, hours: u.hours == null ? null : u.hours } : null; };
const friendView = (id) => { const u = db.users[id]; return { ...ref(id), online: online(id), presence: online(id) ? (presence.get(id) || { status: 'online', playing: null }) : null, lastSeen: u.lastSeen || 0 }; };
function sendTo(id, obj) { const s = socks.get(id); if (!s) return; const raw = JSON.stringify(obj); for (const w of s) if (w.readyState === 1) w.send(raw); }
const alive = (id) => !!db.users[id];

function notifyFriends(id) {
  const u = db.users[id]; const v = friendView(id);
  for (const f of u.friends) sendTo(f, { t: 'presence', user: ref(id), online: v.online, presence: v.presence, lastSeen: v.lastSeen });
}
const unreadFor = (id) => db.unread[id] || {};

// ---------------- identity ----------------
async function verify(provider, username, uuid, challenge) {
  if (INSECURE) return true;
  const base = provider === 'microsoft' ? `${MOJANG}/session/minecraft/hasJoined` : `${ELYBY}/session/hasJoined`;
  try {
    const r = await fetch(`${base}?username=${encodeURIComponent(username)}&serverId=${encodeURIComponent(challenge)}`, { signal: AbortSignal.timeout(6000) });
    if (r.status !== 200) return false;
    const j = await r.json();
    return j && String(j.id).replace(/-/g, '').toLowerCase() === uuid && j.name.toLowerCase() === username.toLowerCase();
  } catch { return false; }
}

// ---------------- helpers ----------------
function makeLimiter() { return { tokens: 30, last: Date.now(), chat: 5, chatLast: Date.now() }; }
function take(l, kind) {
  const now = Date.now();
  if (kind === 'chat') { l.chat = Math.min(5, l.chat + (now - l.chatLast) / 1000 * 5); l.chatLast = now; if (l.chat < 1) return false; l.chat--; return true; }
  l.tokens = Math.min(30, l.tokens + (now - l.last) / 1000 * 30); l.last = now; if (l.tokens < 1) return false; l.tokens--; return true;
}
const isFriend = (a, b) => db.users[a].friends.includes(b);
const rm = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };

function makeFriends(a, b) {
  const A = db.users[a], B = db.users[b];
  for (const [x, y] of [[A, b], [B, a]]) { rm(x.incoming, y); rm(x.outgoing, y); if (!x.friends.includes(y)) x.friends.push(y); }
  sendTo(a, { t: 'friend.added', friend: friendView(b) }); sendTo(b, { t: 'friend.added', friend: friendView(a) }); save();
}

// ---------------- message handling ----------------
const handlers = {
  ping(ws) { ws.send('{"t":"pong"}'); },
  presence(ws, m) {
    const id = ws.uid; const st = ['online', 'away', 'dnd'].includes(m.status) ? m.status : 'online';
    let playing = null;
    if (m.playing && typeof m.playing === 'object') {
      const p = m.playing;
      playing = { instance: String(p.instance || '').slice(0, 64), mcVersion: String(p.mcVersion || '').slice(0, 32), loader: String(p.loader || 'vanilla').slice(0, 16), loaderVersion: String(p.loaderVersion || '').slice(0, 32), server: p.server ? String(p.server).slice(0, 128) : null,
        mods: (Array.isArray(p.mods) ? p.mods : []).slice(0, 2000).map(x => ({ id: String(x.id || '').slice(0, 96), name: String(x.name || '').slice(0, 96), version: String(x.version || '').slice(0, 48), sha1: String(x.sha1 || '').slice(0, 40) })) };
    }
    const U = db.users[id];
    if ('hours' in m) U.hours = (typeof m.hours === 'number' && isFinite(m.hours)) ? Math.min(Math.max(Math.round(m.hours * 10) / 10, 0), 1e6) : null;
    if (m.hideActivity) playing = null;
    presence.set(id, { status: st, playing }); save(); notifyFriends(id);
  },
  search(ws, m) {
    const q = String(m.q || '').trim().toLowerCase().slice(0, 32); if (q.length < 1) return ws.reply({ t: 'search.result', users: [] });
    const out = [];
    for (const u of Object.values(db.users)) { if (u.id === ws.uid) continue; if (u.name.toLowerCase().includes(q)) out.push({ ...ref(u.id), online: online(u.id), _s: u.name.toLowerCase().startsWith(q) ? 0 : 1 }); if (out.length > 200) break; }
    out.sort((a, b) => a._s - b._s || a.name.localeCompare(b.name)); ws.reply({ t: 'search.result', users: out.slice(0, 20).map(({ _s, ...r }) => r) });
  },
  profile(ws, m) {
    const id = m.user; if (!ID_RE.test(id) || !alive(id)) return ws.err('bad_target');
    const fr = isFriend(ws.uid, id) || id === ws.uid;
    const v = ref(id); ws.reply({ t: 'profile', user: { ...v, online: online(id), lastSeen: db.users[id].lastSeen || 0, isFriend: fr, presence: fr && online(id) ? (presence.get(id) || null) : null, friends: db.users[id].friends.length } });
  },
  'friend.request'(ws, m) {
    const me = ws.uid, to = m.to; if (!ID_RE.test(to) || !alive(to) || to === me) return ws.err('bad_target');
    const A = db.users[me], B = db.users[to];
    if (A.friends.includes(to)) return ws.ok();
    if (A.incoming.includes(to)) { makeFriends(me, to); return ws.ok(); }
    if (A.friends.length >= MAX_FRIENDS) return ws.err('limit', 'Friend limit reached');
    if (A.outgoing.length >= MAX_PENDING || B.incoming.length >= MAX_PENDING) return ws.err('limit', 'Too many pending requests');
    if (!A.outgoing.includes(to)) { A.outgoing.push(to); B.incoming.push(me); }
    sendTo(to, { t: 'friend.incoming', from: ref(me) }); sendTo(me, { t: 'friend.outgoing', to: ref(to) }); save(); ws.ok();
  },
  'friend.accept'(ws, m) { const me = ws.uid; if (!ID_RE.test(m.from) || !db.users[me].incoming.includes(m.from)) return ws.err('no_request'); makeFriends(me, m.from); ws.ok(); },
  'friend.decline'(ws, m) { const me = ws.uid, f = m.from; if (!ID_RE.test(f) || !alive(f)) return ws.err('bad_target'); rm(db.users[me].incoming, f); rm(db.users[f].outgoing, me); sendTo(f, { t: 'friend.request.cancelled', user: me }); save(); ws.ok(); },
  'friend.cancel'(ws, m) { const me = ws.uid, to = m.to; if (!ID_RE.test(to) || !alive(to)) return ws.err('bad_target'); rm(db.users[me].outgoing, to); rm(db.users[to].incoming, me); sendTo(to, { t: 'friend.request.cancelled', user: me }); save(); ws.ok(); },
  'friend.remove'(ws, m) { const me = ws.uid, f = m.user; if (!ID_RE.test(f) || !alive(f)) return ws.err('bad_target'); rm(db.users[me].friends, f); rm(db.users[f].friends, me); sendTo(me, { t: 'friend.removed', user: f }); sendTo(f, { t: 'friend.removed', user: me }); save(); ws.ok(); },
  msg(ws, m) {
    const me = ws.uid, to = m.to; if (!ID_RE.test(to) || !alive(to) || !isFriend(me, to)) return ws.err('not_friends');
    const text = typeof m.text === 'string' ? m.text.trim() : ''; if (!text || text.length > MAX_TEXT) return ws.err('bad_text');
    if (!take(ws.lim, 'chat')) return ws.err('rate_limited');
    const msg = { t: 'msg', id: crypto.randomUUID(), from: me, to, text, ts: Date.now() };
    const k = pairKey(me, to); const arr = db.chats[k] || (db.chats[k] = []); arr.push({ id: msg.id, from: me, to, text, ts: msg.ts }); if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY);
    if (!online(to)) { const u = db.unread[to] || (db.unread[to] = {}); u[me] = (u[me] || 0) + 1; }
    sendTo(me, msg); sendTo(to, msg); save();
  },
  history(ws, m) {
    const me = ws.uid, w = m.with; if (!ID_RE.test(w) || !alive(w) || !isFriend(me, w)) return ws.err('not_friends');
    const limit = Math.min(Math.max(parseInt(m.limit) || 50, 1), 200); let arr = db.chats[pairKey(me, w)] || [];
    if (m.before) arr = arr.filter(x => x.ts < Number(m.before));
    ws.reply({ t: 'history', with: w, messages: arr.slice(-limit) });
  },
  read(ws, m) { const me = ws.uid; if (db.unread[me] && m.with in db.unread[me]) { delete db.unread[me][m.with]; save(); } ws.ok(); },
  typing(ws, m) { if (ID_RE.test(m.to) && alive(m.to) && isFriend(ws.uid, m.to)) sendTo(m.to, { t: 'typing', from: ws.uid }); },
  invite(ws, m) { const me = ws.uid, to = m.to; if (!ID_RE.test(to) || !alive(to) || !isFriend(me, to)) return ws.err('not_friends'); if (!online(to)) return ws.err('offline'); sendTo(to, { t: 'invite', from: ref(me), payload: m.payload && typeof m.payload === 'object' ? m.payload : {}, ts: Date.now() }); ws.ok(); },
};
for (const k of ['invite', 'accept', 'decline', 'end']) handlers['call.' + k] = (ws, m) => {
  const me = ws.uid, to = m.to; if (!ID_RE.test(to) || !alive(to) || !isFriend(me, to)) return ws.err('not_friends');
  if (!online(to)) return ws.err('offline', 'User is offline');
  if (k === 'invite') sendTo(to, { t: 'call.invite', from: ref(me) });
  else sendTo(to, { t: { accept: 'call.accepted', decline: 'call.declined', end: 'call.ended' }[k], from: me });
};
handlers['call.signal'] = (ws, m) => { const me = ws.uid, to = m.to; if (!ID_RE.test(to) || !alive(to) || !isFriend(me, to)) return ws.err('not_friends'); if (!online(to)) return ws.err('offline'); sendTo(to, { t: 'call.signal', from: me, data: m.data }); };

// ---------------- server ----------------
// ---------------- CurseForge proxy: the API key lives only on the server, players need no key ----------------
const CF_KEY = process.env.CURSEFORGE_KEY || '';
const CF_UP = (process.env.CF_UPSTREAM || 'https://api.curseforge.com').replace(/\/$/, '');
const CF_OK = /^\/v1\/(mods\/search|mods\/files|mods\/\d+|mods\/\d+\/description|mods\/\d+\/files)$/;
const cfCache = new Map(), cfHits = new Map();
async function cfProxy(req, res) {
  const json = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const u = new URL(req.url, 'http://x'); const p = u.pathname.slice(3); // strip /cf
  if (u.pathname === '/cf-status') return json(200, { enabled: !!CF_KEY });
  if (!CF_KEY) return json(503, { error: 'curseforge_disabled' });
  if (!CF_OK.test(p) || !['GET', 'POST'].includes(req.method) || (req.method === 'POST' && p !== '/v1/mods/files')) return json(404, { error: 'not_allowed' });
  const ip = req.socket.remoteAddress, now = Date.now(); const h = (cfHits.get(ip) || []).filter(t => now - t < 60000); if (h.length >= 120) return json(429, { error: 'rate_limited' }); h.push(now); cfHits.set(ip, h);
  let body = null; if (req.method === 'POST') { const ch = []; let n = 0; for await (const c of req) { n += c.length; if (n > 65536) return json(413, { error: 'too_large' }); ch.push(c); } body = Buffer.concat(ch); }
  const key = req.method + u.pathname + u.search + (body ? body.toString() : '');
  const hit = cfCache.get(key); if (hit && now - hit.t < 300000) { res.writeHead(hit.c, { 'Content-Type': 'application/json' }); return res.end(hit.b); }
  try {
    const r = await fetch(CF_UP + p + u.search, { method: req.method, headers: { 'x-api-key': CF_KEY, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body, signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    if (r.ok) { if (cfCache.size > 500) cfCache.delete(cfCache.keys().next().value); cfCache.set(key, { t: now, c: r.status, b: text }); }
    res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(text);
  } catch (e) { json(502, { error: 'upstream_failed' }); }
}
const httpServer = http.createServer((req, res) => {
  if (req.url.startsWith('/cf')) return cfProxy(req, res);
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, users: Object.keys(db.users).length, online: socks.size })); }
  res.writeHead(404); res.end('MobLauncher friends server');
});
const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_FRAME });

wss.on('connection', (ws) => {
  ws.lim = makeLimiter(); ws.uid = null; ws.isAlive = true; ws.challenge = crypto.randomBytes(16).toString('hex');
  const rawSend = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  ws.reply = (o) => rawSend({ ...o, ...(ws.rid ? { rid: ws.rid } : {}) });
  ws.ok = () => rawSend({ t: 'ok', ...(ws.rid ? { rid: ws.rid } : {}) });
  ws.err = (code, message) => rawSend({ t: 'error', code, message: message || code, ...(ws.rid ? { rid: ws.rid } : {}) });
  ws.on('pong', () => { ws.isAlive = true; });
  rawSend({ t: 'hello', challenge: ws.challenge, protocol: 1, serverName: process.env.MOB_SERVER_NAME || 'MobLauncher Friends', sessionServers: { microsoft: MOJANG, elyby: ELYBY } });
  const authTimer = setTimeout(() => { if (!ws.uid) ws.close(); }, 20000);
  let authing = false;

  ws.on('message', async (raw) => {
    if (!take(ws.lim, 'any')) return rawSend({ t: 'error', code: 'rate_limited' });
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    ws.rid = typeof m.rid === 'string' ? m.rid.slice(0, 64) : null;
    if (!ws.uid) {
      if (m.t !== 'auth' || authing) return; authing = true;
      const provider = m.provider === 'elyby' ? 'elyby' : m.provider === 'microsoft' ? 'microsoft' : null;
      const username = String(m.username || ''), uuid = String(m.uuid || '').replace(/-/g, '').toLowerCase();
      if (!provider || !/^[A-Za-z0-9_]{1,32}$/.test(username) || !/^[0-9a-f]{32}$/.test(uuid)) { rawSend({ t: 'error', code: 'auth_failed', message: 'Bad credentials format' }); return ws.close(); }
      if (!(await verify(provider, username, uuid, ws.challenge))) { rawSend({ t: 'error', code: 'auth_failed', message: 'Could not verify your Minecraft account' }); return ws.close(); }
      clearTimeout(authTimer);
      const id = `${provider}:${uuid}`;
      const u = db.users[id] || (db.users[id] = { id, provider, uuid, name: username, friends: [], incoming: [], outgoing: [], lastSeen: 0 });
      u.name = username; ws.uid = id; (socks.get(id) || socks.set(id, new Set()).get(id)).add(ws);
      save();
      rawSend({ t: 'authed', user: ref(id), friends: u.friends.filter(alive).map(friendView), incoming: u.incoming.filter(alive).map(ref), outgoing: u.outgoing.filter(alive).map(ref), unread: unreadFor(id) });
      if (socks.get(id).size === 1) notifyFriends(id); else { const p = presence.get(id); if (p) ws.reply({ t: 'ok' }); }
      return;
    }
    const h = Object.prototype.hasOwnProperty.call(handlers, m.t) ? handlers[m.t] : null;
    if (!h) return ws.err('unknown_type');
    try { h(ws, m); } catch (e) { console.error('handler', m.t, e); ws.err('internal'); }
  });
  ws.on('close', () => {
    clearTimeout(authTimer); const id = ws.uid; if (!id) return;
    const s = socks.get(id); s.delete(ws);
    if (!s.size) { socks.delete(id); presence.delete(id); db.users[id].lastSeen = Date.now(); save(); notifyFriends(id); }
  });
  ws.on('error', () => {});
});

const beat = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} } }, 25000);
beat.unref();

function start(port = PORT) { return new Promise((res) => httpServer.listen(port, () => { console.log(`MobLauncher friends server on :${httpServer.address().port}${INSECURE ? ' (INSECURE AUTH — dev only!)' : ''}`); res(httpServer.address().port); })); }
function stop() { clearTimeout(saveT); flush(); clearInterval(beat); for (const w of wss.clients) w.terminate(); return new Promise(r => httpServer.close(r)); }
if (require.main === module) { start(); for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => stop().then(() => process.exit(0))); }
module.exports = { start, stop };
