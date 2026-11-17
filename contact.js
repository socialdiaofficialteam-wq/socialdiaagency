'use strict';
// Receives the contact form and stores it in the "messages" table.
const { insert } = require('../lib/supa');

const hits = new Map(); // very small per-instance rate limit
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 6;
}
function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') { try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve({}); } }
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

module.exports = async function handler(req, res) {
  const out = (status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return out(405, { ok: false, error: 'method' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return out(429, { ok: false, error: 'rate' });
  const b = await readBody(req);
  if (clean(b.website, 50)) return out(200, { ok: true }); // honeypot: pretend it worked
  const row = { name: clean(b.name, 200), email: clean(b.email, 200), phone: clean(b.phone, 60), subject: clean(b.subject, 200), message: clean(b.message, 5000), page: clean(b.page, 200) };
  if (!row.name || row.message.length < 2) return out(400, { ok: false, error: 'invalid' });
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return out(400, { ok: false, error: 'email' });
  try { await insert('messages', row); return out(200, { ok: true }); }
  catch (e) { console.error('contact error:', e.message); return out(500, { ok: false, error: 'server' }); }
};
