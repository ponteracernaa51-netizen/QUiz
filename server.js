const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dbPath = path.join(root, 'db.json');
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function defaultDB() {
  return { version: 1, updated: '', quizzes: [] };
}

function readDB() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(raw);
    return {
      version: db.version || 1,
      updated: db.updated || '',
      quizzes: Array.isArray(db.quizzes) ? db.quizzes : []
    };
  } catch (error) {
    return defaultDB();
  }
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  if (req.url !== '/api/db') {
    send(res, 404, 'Not found');
    return;
  }

  if (req.method === 'GET') {
    send(res, 200, JSON.stringify(readDB()), 'application/json; charset=utf-8');
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = await readBody(req);
      const db = JSON.parse(body);
      if (!Array.isArray(db.quizzes)) {
        send(res, 400, 'Invalid db format: quizzes must be an array');
        return;
      }

      const nextDB = {
        version: db.version || 1,
        updated: db.updated || new Date().toISOString(),
        quizzes: db.quizzes
      };

      fs.writeFileSync(dbPath, JSON.stringify(nextDB, null, 2), 'utf8');
      send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
    } catch (error) {
      send(res, 400, error.message);
    }
    return;
  }

  send(res, 405, 'Method not allowed');
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const requestedPath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`QuizHub is running at http://localhost:${port}`);
  console.log(`Saving quizzes to ${dbPath}`);
});
