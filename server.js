const net = require('net');

function parseRequest(rawData) {
  const request = rawData.toString();

  const [headerSection, body] = request.split('\r\n\r\n');
  const lines = headerSection.split('\r\n');

  const [method, fullPath, version] = lines[0].split(' ');

  const [path, queryString] = fullPath.split('?');
  const query = {};
  if (queryString) {
    queryString.split('&').forEach(param => {
      const [key, value] = param.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
  }

  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const colonIndex = lines[i].indexOf(':');
    if (colonIndex > 0) {
      const key = lines[i].slice(0, colonIndex).toLowerCase().trim();
      const value = lines[i].slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  return { method, path, query, headers, body, version };
}

function buildResponse(statusCode, statusText, headers, body) {
  // Status line
  let response = `HTTP/1.1 ${statusCode} ${statusText}\r\n`;

  // Add Content-Length if we have a body
  if (body) {
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  // Add headers
  for (const [key, value] of Object.entries(headers)) {
    response += `${key}: ${value}\r\n`;
  }

  // Empty line + body
  response += '\r\n';
  if (body) {
    response += body;
  }

  return response;
}

function createRouter() {
  const routes = {
    GET: [],
    POST: [],
    PUT: [],
    DELETE: []
  };

  function addRoute(method, path, handler) {
    const paramNames = [];
    const regexPath = path.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    routes[method].push({
      regex: new RegExp(`^${regexPath}$`),
      paramNames,
      handler
    });
  }

  function match(method, path) {
    const methodRoutes = routes[method] || [];

    for (const route of methodRoutes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  return {
    get: (path, handler) => addRoute('GET', path, handler),
    post: (path, handler) => addRoute('POST', path, handler),
    put: (path, handler) => addRoute('PUT', path, handler),
    delete: (path, handler) => addRoute('DELETE', path, handler),
    match
  };
}

function createResponse(socket) {
  let statusCode = 200;
  let statusText = 'OK';
  const headers = {};

  return {
    status(code) {
      statusCode = code;
      const statusTexts = {
        200: 'OK', 201: 'Created', 400: 'Bad Request',
        404: 'Not Found', 500: 'Internal Server Error'
      };
      statusText = statusTexts[code] || 'Unknown';
      return this;
    },
    set(key, value) {
      headers[key] = value;
      return this;
    },
    json(data) {
      const body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
      const response = buildResponse(statusCode, statusText, headers, body);
      socket.end(response);
    },
    send(text, contentType = 'text/plain') {
        headers['Content-Type'] = contentType;
        const response = buildResponse(statusCode, statusText, headers, text);
        socket.end(response);
    },
    html(text) {
        this.send(text, 'text/html');
    }
  };
}

const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(staticDir, req, socket) {
  const filePath = path.join(staticDir, req.path);
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(staticDir);

  if (!resolvedPath.startsWith(resolvedDir)) {
    const res = createResponse(socket);
    res.status(403).send('Access denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const res = createResponse(socket);
      res.status(404).send('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    let responseHeaders = `HTTP/1.1 200 OK\r\nContent-Type: ${mimeType}\r\nContent-Length: ${stats.size}\r\n\r\n`;
    socket.write(responseHeaders);
    fs.createReadStream(filePath).pipe(socket);
  });
}

const router = createRouter();

router.get('/time', (req, res) => {
  const now = new Date();
  res.json({ 
    time: now.toLocaleTimeString(),
    date: now.toLocaleDateString(),
    timestamp: now.toISOString()
  });
});

router.get('/hello/:name', (req, res) => {
  res.json({ message: `Hello, ${req.params.name}!` });
});

router.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>My HTTP Server</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; color: #333; }
    h1 { font-size: 28px; }
    p { color: #666; }
    .route { background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .method { background: #333; color: white; padding: 3px 8px; border-radius: 4px; font-size: 13px; font-family: monospace; }
    .path { font-family: monospace; font-size: 16px; margin-left: 8px; }
    .desc { color: #666; margin-top: 6px; font-size: 14px; }
    a { color: #333; }
  </style>
</head>
<body>
  <h1>Welcome to my HTTP Server</h1>
  <p>Built from scratch using only Node.js's net module. Here's what you can do:</p>

  <div class="route">
    <span class="method">GET</span>
    <span class="path"><a href="/hello/arielle">/hello/:name</a></span>
    <div class="desc">Returns a greeting for any name you put in the URL</div>
  </div>

  <div class="route">
    <span class="method">GET</span>
    <span class="path"><a href="/time">/time</a></span>
    <div class="desc">Returns the current time and date</div>
  </div>

  <div class="route">
    <span class="method">GET</span>
    <span class="path"><a href="/index.html">/index.html</a></span>
    <div class="desc">Serves a static HTML file from the public folder</div>
  </div>
</body>
</html>`;

  res.html(html);
});

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const req = parseRequest(data);
    const res = createResponse(socket);

    const matched = router.match(req.method, req.path);
    if (matched) {
      req.params = matched.params;
      matched.handler(req, res);
    } else {
      serveStatic('./public', req, socket);
    }
  });
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});