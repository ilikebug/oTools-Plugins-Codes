// Preload script for Password Manager plugin
// This file provides necessary APIs for the password manager to function

const { contextBridge } = require('electron');
const { authenticator } = require('otplib');
const { google } = require('googleapis');
const Store = require('electron-store');

// Start OAuth server and get port
let oauthPort = null;
let oauthServer = null;
let oauthServerStarted = false;

async function initializeOAuthServer() {
  // If already started, return the port
  if (oauthServerStarted && oauthPort) {
    return oauthPort;
  }
  
  try {
    const OAuthServer = require('./oauth-server');
    oauthPort = await OAuthServer.startOAuthServer();
    oauthServer = OAuthServer;
    oauthServerStarted = true;
    return oauthPort;
  } catch (error) {
    // If server is already running, try to get the port
    if (error.message.includes('Listen method has been called more than once') || 
        error.message.includes('EADDRINUSE')) {
      const OAuthServer = require('./oauth-server');
      oauthPort = OAuthServer.port;
      oauthServer = OAuthServer;
      oauthServerStarted = true;
      return oauthPort;
    }
    // Last resort: use fixed port
    oauthPort = 12345;
    return oauthPort;
  }
}

// Initialize OAuth server immediately
initializeOAuthServer();

// Initialize store for Google Drive tokens
const store = new Store();

// Secure Google API configuration
const secureConfig = require('./secure-config');

// Initialize Google OAuth2 client with secure configuration
let oauth2Client = null;
let drive = null;

// Initialize OAuth2 client with current port
function initializeOAuth2Client(port) {
  oauth2Client = new google.auth.OAuth2(
    secureConfig.getClientId(),
    secureConfig.getClientSecret(),
    `http://localhost:${port}/callback`
  );
  
  drive = google.drive({ version: 'v3', auth: oauth2Client });
}

// Initialize with current port (will be updated when OAuth server starts)
initializeOAuth2Client(oauthPort || 10000);

// Expose plugin object with generateTotp and Google Drive APIs
contextBridge.exposeInMainWorld('plugin', {
  getplatformName: () => {
    // This would be implemented by the main process
    return process.platform; // Default to macOS
  },
  generateTotp: (secret) => {
    try {
      // Clean up secret: remove spaces, uppercase
      const cleanSecret = (secret || '').replace(/\s+/g, '').toUpperCase();
      if (!cleanSecret) return '';
      return authenticator.generate(cleanSecret);
    } catch (e) {
      return '';
    }
  },
  
  // Google Drive API methods
  googleDrive: {
    // Get current OAuth port
    getOAuthPort: async () => {
      if (oauthPort) {
        return oauthPort;
      }
      // Wait for OAuth server to start
      return await initializeOAuthServer();
    },
    
    // Reinitialize OAuth2 client with current port
    reinitializeOAuth: async () => {
      const currentPort = await initializeOAuthServer();
      initializeOAuth2Client(currentPort);
      return currentPort;
    },
    
    // Get Google OAuth URL for authorization
    getAuthUrl: async () => {
      // Ensure we have the latest port
      const currentPort = await initializeOAuthServer();
      
      // Always reinitialize with current port to ensure consistency
      oauthPort = currentPort;
      initializeOAuth2Client(currentPort);
      
      const scopes = [
        'https://www.googleapis.com/auth/drive.file'
      ];
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });
      
      return authUrl;
    },
    
    // Exchange authorization code for tokens
    getTokensFromCode: async (code) => {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        store.set('googleTokens', tokens);
        oauth2Client.setCredentials(tokens);
        return { success: true, tokens };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    // Check if user is authenticated
    isAuthenticated: () => {
      const tokens = store.get('googleTokens');
      if (tokens && tokens.access_token) {
        oauth2Client.setCredentials(tokens);
        return true;
      }
      return false;
    },
    
    // Refresh access token
    refreshToken: async () => {
      try {
        const tokens = store.get('googleTokens');
        if (tokens && tokens.refresh_token) {
          oauth2Client.setCredentials(tokens);
          const { credentials } = await oauth2Client.refreshAccessToken();
          store.set('googleTokens', credentials);
          oauth2Client.setCredentials(credentials);
          return { success: true };
        }
        return { success: false, error: 'No refresh token available' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    // Upload encrypted data to Google Drive
    uploadToDrive: async (data, filename = 'passwords.enc') => {
      try {
        // Ensure we have valid tokens
        if (!oauth2Client.credentials.access_token) {
          const refreshResult = await this.refreshToken();
          if (!refreshResult.success) {
            throw new Error('Authentication required');
          }
        }
        
        // Check if file already exists
        const existingFiles = await drive.files.list({
          q: `name='${filename}' and trashed=false`,
          fields: 'files(id,name)'
        });
        
        const fileMetadata = {
          name: filename,
          mimeType: 'application/json'
        };
        
        const media = {
          mimeType: 'application/json',
          body: JSON.stringify(data)
        };
        
        let fileId;
        if (existingFiles.data.files.length > 0) {
          // Update existing file
          fileId = existingFiles.data.files[0].id;
          await drive.files.update({
            fileId: fileId,
            media: media
          });
        } else {
          // Create new file
          const file = await drive.files.create({
            resource: fileMetadata,
            media: media
          });
          fileId = file.data.id;
        }
        
        return { success: true, fileId };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    // Download encrypted data from Google Drive
    downloadFromDrive: async (filename = 'passwords.enc') => {
      try {
        // Ensure we have valid tokens
        if (!oauth2Client.credentials.access_token) {
          const refreshResult = await this.refreshToken();
          if (!refreshResult.success) {
            throw new Error('Authentication required');
          }
        }
        
        // Find the file
        const files = await drive.files.list({
          q: `name='${filename}' and trashed=false`,
          fields: 'files(id,name)'
        });
        
        if (files.data.files.length === 0) {
          return { success: false, error: 'File not found' };
        }
        
        const fileId = files.data.files[0].id;
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media'
        });
        
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    // Delete file from Google Drive
    deleteFromDrive: async (filename = 'passwords.enc') => {
      try {
        // Ensure we have valid tokens
        if (!oauth2Client.credentials.access_token) {
          const refreshResult = await this.refreshToken();
          if (!refreshResult.success) {
            throw new Error('Authentication required');
          }
        }
        
        // Find the file
        const files = await drive.files.list({
          q: `name='${filename}' and trashed=false`,
          fields: 'files(id,name)'
        });
        
        if (files.data.files.length === 0) {
          return { success: false, error: 'File not found' };
        }
        
        const fileId = files.data.files[0].id;
        await drive.files.delete({
          fileId: fileId
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    // Logout (clear stored tokens)
    logout: () => {
      store.delete('googleTokens');
      oauth2Client.credentials = {};
    }
  }
}); 