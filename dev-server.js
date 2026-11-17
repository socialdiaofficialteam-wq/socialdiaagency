'use strict';
// Local preview: node dev-server.js  (needs SUPABASE_URL and SUPABASE_ANON_KEY in the environment)
// It mimics what Vercel does: static files from /public, /api/* functions, everything else rendered by api/render.js.
const http = require('http');
const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function start(port) {
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      let p = decodeURIComponent(u.pathname);
      if (p.startsWith('/api/')) {
        const name = p.slice(5).replace(/[^a-z0-9_-]/gi, '');
        const file = path.join(__dirname, 'api', name + '.js');
        if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('no such function'); }
        return require(file)(req, res);
      }
      if (p === '/admin' || p === '/admin/') p = '/admin/index.html';
      const f = path.join(PUB, p);
      if (f.startsWith(PUB + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.setHeader('Content-Type', TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream');
        if (p.startsWith('/admin/')) res.setHeader('Cache-Control', 'no-cache');
        return fs.createReadStream(f).pipe(res);
      }
      return require('./api/render.js')(req, res);
    } catch (e) { res.statusCode = 500; res.end(String(e.stack || e)); }
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
module.exports = { start };
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  start(port).then(() => console.log('Socialdia dev server: http://localhost:' + port + '  (admin: /admin)'));
}
