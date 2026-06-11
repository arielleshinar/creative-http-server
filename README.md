# Creative HTTP Server

An HTTP server built from scratch using only Node.js's `net` module (no `http`, no Express, no third-party libraries).

## How it works

The server manually parses raw HTTP/1.1 text, matches requests to routes, and builds valid HTTP responses, all from scratch using TCP sockets.

## Features

### 1. Routing system
Match incoming requests to handlers by path and HTTP method. Supports URL parameters (`:name`).

### 2. Static file serving
Files in the `public/` folder are served automatically with the correct MIME type.

### 3. API Playground (creative feature)
Visiting `/` in the browser shows a live homepage that documents all available routes with clickable links. Instead of raw JSON, the server explains itself, no external documentation needed.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API playground homepage |
| GET | `/hello/:name` | Returns a greeting for any name |
| GET | `/time` | Returns the current time and date |
| GET | `/index.html` | Serves a static HTML file |

## How to run

```bash
node server.js
```

Then open `http://localhost:3000` in your browser.