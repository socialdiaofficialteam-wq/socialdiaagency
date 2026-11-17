'use strict';
// Accepts https://xxx.supabase.co even if pasted with a trailing slash, /rest/v1, /auth/v1, quotes or spaces.
function cleanUrl(v) {
  let s = String(v || '').trim().replace(/^["']|["']$/g, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).origin; } catch (e) { return s.replace(/\/+$/, ''); }
}
// Gives the admin page the public Supabase address and anon key.
// (Both are meant to be public; the security rules in schema.sql protect the data.)
module.exports = function handler(req, res) {
  const url = cleanUrl(process.env.SUPABASE_URL);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!url || !anonKey) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'not_configured' })); }
  res.end(JSON.stringify({ url, anonKey }));
};
