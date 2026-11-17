'use strict';
// Accepts https://xxx.supabase.co even if pasted with a trailing slash, /rest/v1, /auth/v1, quotes or spaces.
function cleanUrl(v) {
  let s = String(v || '').trim().replace(/^["']|["']$/g, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).origin; } catch (e) { return s.replace(/\/+$/, ''); }
}
// Tiny Supabase REST helper (no dependencies). Uses the public anon key,
// so it can only read what the security rules allow everyone to read.
const cache = new Map();

function config() {
  return {
    url: cleanUrl(process.env.SUPABASE_URL),
    key: String(process.env.SUPABASE_ANON_KEY || ''),
  };
}
function ttlMs() {
  if (process.env.SD_NO_CACHE) return 0;
  const n = Number(process.env.SD_CACHE_SECONDS);
  return (Number.isFinite(n) ? n : 10) * 1000;
}

async function rest(table, query) {
  const { url, key } = config();
  if (!url || !key) {
    const e = new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    e.code = 'NOT_CONFIGURED';
    throw e;
  }
  const full = `${url}/rest/v1/${table}${query ? '?' + query : ''}`;
  const ttl = ttlMs();
  const hit = cache.get(full);
  if (ttl && hit && Date.now() - hit.t < ttl) return hit.v;
  const r = await fetch(full, { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    const e = new Error(`Supabase ${table} ${r.status}: ${txt.slice(0, 200)}`);
    e.code = 'SUPABASE_' + r.status;
    throw e;
  }
  const v = await r.json();
  if (ttl) cache.set(full, { t: Date.now(), v });
  return v;
}

async function insert(table, row) {
  const { url, key } = config();
  if (!url || !key) { const e = new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY'); e.code = 'NOT_CONFIGURED'; throw e; }
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    const e = new Error(`Supabase insert ${table} ${r.status}: ${txt.slice(0, 200)}`);
    e.code = 'SUPABASE_' + r.status;
    throw e;
  }
}

module.exports = { rest, insert, config };
