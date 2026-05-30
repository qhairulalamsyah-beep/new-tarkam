const http = require('http');
const { execSync } = require('child_process');

const server = http.createServer((req, res) => {
  // If Next.js isn't running, start it
  try {
    const check = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/', { timeout: 3000 }).toString();
    if (check.trim() === '200') {
      // Proxy to Next.js
      const proxy = http.request({ hostname: 'localhost', port: 3001, path: req.url, method: req.method }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      req.pipe(proxy);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>TARKAM - Starting...</h1><p>Server is warming up, please refresh in 10 seconds.</p></body></html>');
    }
  } catch(e) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>TARKAM - Starting...</h1><p>Server is warming up, please refresh in 10 seconds.</p></body></html>');
  }
});

server.listen(3000, () => {
  console.log('Keepalive server on port 3000');
  
  // Start Next.js on port 3001
  const { spawn } = require('child_process');
  const nextProc = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3001'], {
    cwd: '/home/z/my-project',
    detached: true,
    stdio: 'ignore'
  });
  nextProc.unref();
  console.log('Next.js started on port 3001, PID:', nextProc.pid);
});
