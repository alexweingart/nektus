const https = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

// Create Next.js app
const app = next({ dev, hostname, port: parseInt(port) + 1 }); // Use port+1 for the Next.js app
const handle = app.getRequestHandler();

// Load SSL certificates
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '.ssl/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '.ssl/cert.pem'))
};

app.prepare().then(() => {
  const server = https.createServer(httpsOptions, async (req, res) => {
    try {
      await handle(req, res, parse(req.url, true));
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${port}`);
    console.log(`> Network: https://192.168.86.241:${port}`);
    console.log(`> Next.js running on port ${parseInt(port) + 1}`);
  });
});
