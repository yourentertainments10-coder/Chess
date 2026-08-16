// Dev-server proxy for online play.
//
// A bare "proxy" field in package.json forwards *every* request the dev server
// cannot serve, so with the API server down even manifest.json fails and the
// whole page looks broken. Scoping it to /api keeps the rest of the app working
// normally whether or not the game server is running.
const { createProxyMiddleware } = require('http-proxy-middleware');

const TARGET = process.env.API_TARGET || 'http://localhost:4000';

module.exports = function (app) {
  app.use('/api', createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    // Long polling holds a request open for ~25s, so do not time out early.
    proxyTimeout: 60000,
    timeout: 60000,
    onError(err, req, res) {
      // Answer in the shape the client expects so it can show a useful message
      // instead of the dev server's HTML error page.
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'The game server is not running. Start it in another terminal with "npm run server".'
      }));
    }
  }));
};
