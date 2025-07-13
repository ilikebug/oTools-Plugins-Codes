const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Use a fixed port that's less likely to be used by other applications
const FIXED_PORT = 12345;

// Generate random port between 10000-65535 to avoid conflicts
function getRandomPort() {
  return Math.floor(Math.random() * (65535 - 10000 + 1)) + 10000;
}

const PORT = process.env.OAUTH_PORT || FIXED_PORT;

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
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const messageElement = document.getElementById('message');
    
    // Function to send message to opener
    function sendMessageToOpener(type, data) {
      if (window.opener) {
        try {
          window.opener.postMessage({ type: type, ...data }, '*');
        } catch (error) {
          // Handle error silently
        }
        
        // Also try to close the window after a short delay
        setTimeout(() => {
          try {
            if (!window.closed) {
              window.close();
            }
          } catch (error) {
            // Handle error silently
          }
        }, 1000);
      }
    }
    
    if (error) {
      messageElement.textContent = 'Authorization failed: ' + error;
      messageElement.className = 'error';
      sendMessageToOpener('GOOGLE_AUTH_ERROR', { error: error });
    } else if (code) {
      messageElement.textContent = 'Authorization successful! You can close this window.';
      messageElement.className = 'success';
      sendMessageToOpener('GOOGLE_AUTH_SUCCESS', { code: code });
    } else {
      messageElement.textContent = 'Invalid authorization response';
      messageElement.className = 'error';
      sendMessageToOpener('GOOGLE_AUTH_ERROR', { error: 'Invalid authorization response' });
    }
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

// Function to start OAuth server
let isServerStarted = false;

function startOAuthServer() {
  return new Promise((resolve, reject) => {
    // Check if server is already started
    if (isServerStarted) {
      resolve(PORT);
      return;
    }
    
    server.listen(PORT, () => {
      isServerStarted = true;
      resolve(PORT);
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        // Port is in use, try a random port
        const newPort = getRandomPort();
        server.listen(newPort, () => {
          isServerStarted = true;
          resolve(newPort);
        });
      } else {
        reject(error);
      }
    });
  });
}

// Graceful shutdown
function stopOAuthServer() {
  return new Promise((resolve) => {
    if (!isServerStarted) {
      resolve();
      return;
    }
    
    server.close(() => {
      isServerStarted = false;
      resolve();
    });
  });
}

// If run directly, start the server
if (require.main === module) {
  startOAuthServer().catch(console.error);
  
  // Handle shutdown signals
  process.on('SIGINT', () => {
    stopOAuthServer().then(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    stopOAuthServer().then(() => process.exit(0));
  });
}

module.exports = {
  server,
  port: PORT,
  callbackHTML,
  startOAuthServer,
  stopOAuthServer,
  getPort: () => PORT
};  