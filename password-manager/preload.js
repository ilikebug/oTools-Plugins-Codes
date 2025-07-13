// Preload script for Password Manager plugin
// This file provides necessary APIs for the password manager to function

const { contextBridge } = require('electron');
const { authenticator } = require('otplib');
const { google } = require('googleapis');
const Store = require('electron-store');

// Start OAuth callback server
let oauthServer = null;
try {
  const OAuthServer = require('./oauth-server');
  oauthServer = OAuthServer;
  console.log('OAuth callback server started');
} catch (error) {
  console.log('OAuth server not available:', error.message);
}

// Initialize store for Google Drive tokens
const store = new Store();

// Secure Google API configuration
const secureConfig = require('./secure-config');

// Get OAuth server port from environment variable
const oauthPort = process.env.OAUTH_PORT || 10000;

// Initialize Google OAuth2 client with secure configuration
const oauth2Client = new google.auth.OAuth2(
  secureConfig.getClientId(),
  secureConfig.getClientSecret(),
  `http://localhost:${oauthPort}/callback`
);

// Google Drive API
const drive = google.drive({ version: 'v3', auth: oauth2Client });

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
    // Get Google OAuth URL for authorization
    getAuthUrl: () => {
      const scopes = [
        'https://www.googleapis.com/auth/drive.file'
      ];
      
      return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });
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
          const refreshResult = await contextBridge.exposeInMainWorld('plugin').googleDrive.refreshToken();
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
          const refreshResult = await contextBridge.exposeInMainWorld('plugin').googleDrive.refreshToken();
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
          const refreshResult = await contextBridge.exposeInMainWorld('plugin').googleDrive.refreshToken();
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