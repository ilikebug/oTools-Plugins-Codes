const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Generate random port between 10000-65535 to avoid conflicts
function getRandomPort() {
  return Math.floor(Math.random() * (65535 - 10000 + 1)) + 10000;
}

const PORT = process.env.OAUTH_PORT || getRandomPort();

// Set environment variable so other modules can access it
process.env.OAUTH_PORT = PORT.toString();

// HTML content for the callback page
const callbackHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Drive Authorization</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f5f6fa;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
    }
    .success {
      color: #10b981;
    }
    .error {
      color: #ef4444;
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="message">Processing authorization...</div>
  </div>

  <script>
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    const messageElement = document.getElementById('message');
    
    if (error) {
      messageElement.textContent = 'Authorization failed: ' + error;
      messageElement.className = 'error';
      
      // Send error message to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: error
        }, '*');
      }
    } else if (code) {
      messageElement.textContent = 'Authorization successful! You can close this window.';
      messageElement.className = 'success';
      
      // Send success message to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_SUCCESS',
          code: code
        }, '*');
      }
    } else {
      messageElement.textContent = 'Invalid authorization response';
      messageElement.className = 'error';
    }
    
    // Close window after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/callback') {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Return the callback HTML
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(callbackHTML);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`OAuth callback server running on http://localhost:${PORT}`);
  console.log(`Callback URL: http://localhost:${PORT}/callback`);
  
  // Export the port for other modules to use
  module.exports.port = PORT;
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down OAuth server...');
  server.close(() => {
    console.log('OAuth server stopped.');
    process.exit(0);
  });
});

module.exports = server;  