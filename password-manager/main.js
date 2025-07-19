// PasswordManager

class PasswordManager {
  constructor() {
    this.DB_NAME = 'password_db';
    this.PASSWORDS_KEY = 'passwords';
    this.MASTER_PASSWORD_KEY = 'master_password_hash';
    this.SALT_KEY = 'salt';
    this.passwordList = [];
    this.currentEditId = null;
    this.searchKeyword = '';
    this.isAuthenticated = false;
    this.masterPassword = null;

    this.init();
  }
  
  /**
   * Initialize the plugin
   */
  async init() {
    // Check if master password is set
    const hasMasterPassword = await this.checkMasterPassword();
    
    if (hasMasterPassword) {
      // Show master password dialog
      this.showMasterPasswordDialog();
    } else {
      // First time setup - create master password
      this.showSetupMasterPasswordDialog();
    }
  }

  /**
   * Check if master password exists
   */
  async checkMasterPassword() {
    const result = await window.otools.getDbValue(this.DB_NAME, this.MASTER_PASSWORD_KEY);
    return result && result.success && result.value;
  }

  /**
   * Show master password setup dialog
   */
  showSetupMasterPasswordDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'master-password-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Set Master Password</h3>
        <p>This is your first time using the password manager. Please set a master password to protect all your passwords.</p>
        <div class="form-group">
          <label for="masterPassword">Master Password</label>
          <input type="password" id="masterPassword" placeholder="Enter master password...">
        </div>
        <div class="form-group">
          <label for="confirmMasterPassword">Confirm Master Password</label>
          <input type="password" id="confirmMasterPassword" placeholder="Enter master password again...">
        </div>
        <div class="dialog-buttons">
          <button class="btn-primary" id="setupMasterPassword">Set Master Password</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Bind events
    document.getElementById('setupMasterPassword').addEventListener('click', () => {
      this.setupMasterPassword();
    });
    
    // Handle Enter key
    const inputs = dialog.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.setupMasterPassword();
        }
      });
    });
  }

  /**
   * Remove existing dialogs by class name
   */
  removeExistingDialogs(className) {
    const existingDialogs = document.querySelectorAll(className);
    existingDialogs.forEach(dialog => dialog.remove());
  }

  /**
   * Show master password dialog
   */
  showMasterPasswordDialog() {
    this.removeExistingDialogs('.master-password-dialog');
    
    const dialog = document.createElement('div');
    dialog.className = 'master-password-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Enter Master Password</h3>
        <p>Please enter your master password to unlock the password manager.</p>
        <div class="form-group">
          <label for="masterPassword">Master Password</label>
          <input type="password" id="masterPassword" placeholder="Enter master password...">
        </div>
        <div class="dialog-buttons">
          <button class="btn-primary" id="unlockMasterPassword">Unlock</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Bind events
    document.getElementById('unlockMasterPassword').addEventListener('click', () => {
      this.unlockMasterPassword();
    });
    
    // Handle Enter key
    const input = dialog.querySelector('input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.unlockMasterPassword();
      }
    });
    
    input.focus();
  }

  /**
   * Setup master password
   */
  async setupMasterPassword() {
    const masterPassword = document.getElementById('masterPassword').value;
    const confirmPassword = document.getElementById('confirmMasterPassword').value;
    
    if (!masterPassword || masterPassword.length < 6) {
      this.showNotification('Master password must be at least 6 characters', 'error');
      return;
    }
    
    if (masterPassword !== confirmPassword) {
      this.showNotification('Passwords do not match', 'error');
      return;
    }
    
    try {
      // Generate salt and hash
      const salt = this.generateSalt();
      const hash = await this.hashPassword(masterPassword, salt);
      
      // Save master password hash and salt
      await window.otools.setDbValue(this.DB_NAME, this.MASTER_PASSWORD_KEY, hash);
      await window.otools.setDbValue(this.DB_NAME, this.SALT_KEY, salt);
      
      // Remove dialog and initialize
      this.removeExistingDialogs('.master-password-dialog');
      this.masterPassword = masterPassword;
      this.isAuthenticated = true;
      this.initializeAfterAuth();
      
      this.showNotification('Master password set successfully!', 'success');
    } catch (error) {
      this.showNotification('Failed to set master password', 'error');
    }
  }

  /**
   * Show change master password dialog
   */
  showChangeMasterPasswordDialog() {
    this.removeExistingDialogs('.change-master-password-dialog');
    
    const dialog = document.createElement('div');
    dialog.className = 'change-master-password-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Change Master Password</h3>
        <p>Please enter your current master password and set a new one.</p>
        <div class="form-group">
          <label for="currentMasterPassword">Current Master Password</label>
          <input type="password" id="currentMasterPassword" placeholder="Enter current master password...">
        </div>
        <div class="form-group">
          <label for="newMasterPassword">New Master Password</label>
          <input type="password" id="newMasterPassword" placeholder="Enter new master password...">
        </div>
        <div class="form-group">
          <label for="confirmNewMasterPassword">Confirm New Master Password</label>
          <input type="password" id="confirmNewMasterPassword" placeholder="Enter new master password again...">
        </div>
        <div class="dialog-buttons">
          <button class="btn-secondary" id="cancelChangeMasterPassword">Cancel</button>
          <button class="btn-primary" id="confirmChangeMasterPassword">Change Master Password</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Bind events
    document.getElementById('confirmChangeMasterPassword').addEventListener('click', () => {
      this.changeMasterPassword();
    });
    
    document.getElementById('cancelChangeMasterPassword').addEventListener('click', () => {
      this.removeExistingDialogs('.change-master-password-dialog');
    });
    
    // Handle Enter key
    const inputs = dialog.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.changeMasterPassword();
        }
      });
    });
    
    dialog.querySelector('#currentMasterPassword').focus();
  }

  /**
   * Change master password
   */
  async changeMasterPassword() {
    const currentPassword = document.getElementById('currentMasterPassword').value;
    const newPassword = document.getElementById('newMasterPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewMasterPassword').value;
    
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      this.showNotification('Please fill in all fields', 'error');
      return;
    }
    
    if (newPassword.length < 6) {
      this.showNotification('New master password must be at least 6 characters', 'error');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      this.showNotification('New passwords do not match', 'error');
      return;
    }
    
    try {
      // Verify current password
      const hashResult = await window.otools.getDbValue(this.DB_NAME, this.MASTER_PASSWORD_KEY);
      const saltResult = await window.otools.getDbValue(this.DB_NAME, this.SALT_KEY);
      
      if (!hashResult.success || !saltResult.success) {
        this.showNotification('Current password verification failed', 'error');
        return;
      }
      
      const storedHash = hashResult.value;
      const salt = saltResult.value;
      const inputHash = await this.hashPassword(currentPassword, salt);
      
      if (inputHash !== storedHash) {
        this.showNotification('Current master password is incorrect', 'error');
        document.getElementById('currentMasterPassword').value = '';
        return;
      }
      
      // Show progress notification
      this.showNotification('Changing master password and re-encrypting all passwords...', 'info');
      
      // Generate new salt and hash
      const newSalt = this.generateSalt();
      const newHash = await this.hashPassword(newPassword, newSalt);
      
      // Get all passwords from database to ensure we have the complete dataset
      const allPasswords = await this.getEncryptedPasswords();
      
      // Re-encrypt all passwords with new master password
      const reEncryptedPasswords = await Promise.all(allPasswords.map(async (password) => {
        return await this.encryptData(password, newPassword);
      }));
      
      // Save new master password and re-encrypted passwords
      await window.otools.setDbValue(this.DB_NAME, this.MASTER_PASSWORD_KEY, newHash);
      await window.otools.setDbValue(this.DB_NAME, this.SALT_KEY, newSalt);
      await window.otools.setDbValue(this.DB_NAME, this.PASSWORDS_KEY, reEncryptedPasswords);
      
      // Update current master password and password list
      this.masterPassword = newPassword;
      this.passwordList = allPasswords;
      
      // Update the UI
      this.renderPasswordList();
      
      // If cloud sync is enabled, sync the re-encrypted passwords to cloud
      if (window.plugin.googleDrive && window.plugin.googleDrive.isAuthenticated()) {
        try {
          await this.syncToCloud();
          this.showNotification('Master password changed and synced to cloud successfully!', 'success');
        } catch (syncError) {
          this.showNotification('Master password changed successfully, but cloud sync failed. Please sync manually later.', 'warning');
        }
      } else {
        this.showNotification('Master password changed successfully!', 'success');
      }
      
      // Remove dialog
      this.removeExistingDialogs('.change-master-password-dialog');
    } catch (error) {
      this.showNotification('Failed to change master password: ' + error.message, 'error');
    }
  } 

  /**
   * Unlock with master password
   */
  async unlockMasterPassword() {
    const masterPassword = document.getElementById('masterPassword').value;
    
    if (!masterPassword) {
      this.showNotification('Please enter master password', 'info');
      return;
    }
    
    try {
      // Get stored hash and salt
      const hashResult = await window.otools.getDbValue(this.DB_NAME, this.MASTER_PASSWORD_KEY);
      const saltResult = await window.otools.getDbValue(this.DB_NAME, this.SALT_KEY);
      
      if (!hashResult.success || !saltResult.success) {
        this.showNotification('Master password verification failed', 'error');
        return;
      }
      
      const storedHash = hashResult.value;
      const salt = saltResult.value;
      
      // Verify password
      const inputHash = await this.hashPassword(masterPassword, salt);
      
      if (inputHash === storedHash) {
        // Remove dialog and initialize
        this.removeExistingDialogs('.master-password-dialog');
        this.masterPassword = masterPassword;
        this.isAuthenticated = true;
        this.initializeAfterAuth();
        
        this.showNotification('Unlocked successfully!', 'success');
      } else {
        this.showNotification('Incorrect master password', 'error');
        document.getElementById('masterPassword').value = '';
      }
    } catch (error) {
      this.showNotification('Verification failed', 'error');
    }
  }

  /**
   * Initialize after authentication
   */
  async initializeAfterAuth() {
    // Load encrypted passwords from database
    this.passwordList = await this.getEncryptedPasswords();
    
    // Render password list
    this.renderPasswordList();
    
    // Bind events
    this.bindEvents();
    
    // Initialize cloud sync
    await this.initCloudSync();
    
    // Auto save passwords
    setInterval(() => {
      this.saveEncryptedPasswords();
    }, 5000);
  }

  /**
   * Generate random salt
   */
  generateSalt() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash password with salt
   */
  async hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Encrypt data with AES
   */
  async encryptData(data, password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = encoder.encode(JSON.stringify(data));
    
    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );
    
    return {
      encrypted: Array.from(new Uint8Array(encryptedContent)),
      iv: Array.from(iv),
      salt: Array.from(salt)
    };
  }

  /**
   * Decrypt data with AES
   */
  async decryptData(encryptedData, password) {
    try {
      if (!encryptedData || !password) {
        return null;
      }
      // Handle different encrypted data formats
      let data = encryptedData;
      // If data is a string, try to parse it
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (parseError) {
          return null;
        }
      }
      // Validate encrypted data structure
      if (!data.encrypted || !data.iv || !data.salt) {
        return null;
      }
      // Convert arrays to Uint8Array if needed
      const encrypted = Array.isArray(data.encrypted) ? new Uint8Array(data.encrypted) : data.encrypted;
      const iv = Array.isArray(data.iv) ? new Uint8Array(data.iv) : data.iv;
      const salt = Array.isArray(data.salt) ? new Uint8Array(data.salt) : data.salt;
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['decrypt']
      );
      const decryptedContent = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encrypted
      );
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedContent);
      // Validate decrypted content
      if (!decryptedText || decryptedText.trim() === '') {
        return null;
      }
      try {
        return JSON.parse(decryptedText);
      } catch (parseError) {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Search functionality
    const searchInput = document.querySelector('.top-bar input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (!this.isAuthenticated) return;
        this.searchKeyword = e.target.value.trim().toLowerCase();
        this.renderPasswordList();
      });
    }

    // Add new password button
    const addBtn = document.querySelector('.add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (!this.isAuthenticated) {
          this.showNotification('Please unlock the password manager first', 'info');
          return;
        }
        this.showAddModal();
      });
    }

    // Change master password button
    const changeMasterPasswordBtn = document.getElementById('changeMasterPassword');
    if (changeMasterPasswordBtn) {
      changeMasterPasswordBtn.addEventListener('click', () => {
        if (!this.isAuthenticated) {
          this.showNotification('Please unlock the password manager first', 'info');
          return;
        }
        this.showChangeMasterPasswordDialog();
      });
    }

    // Close window button
    const closeWindowBtn = document.getElementById('closeWindow');
    if (closeWindowBtn) {
      closeWindowBtn.addEventListener('click', () => {
        this.closeWindow();
      });
    }

    // Cloud sync buttons
    const connectGoogleBtn = document.getElementById('connectGoogle');
    const syncToCloudBtn = document.getElementById('syncToCloud');
    const syncFromCloudBtn = document.getElementById('syncFromCloud');
    const logoutGoogleBtn = document.getElementById('logoutGoogle');

    if (connectGoogleBtn) {
      connectGoogleBtn.addEventListener('click', () => {
        if (!this.isAuthenticated) {
          this.showNotification('Please unlock the password manager first', 'info');
          return;
        }
        this.showGoogleDriveLogin();
      });
    }

    if (syncToCloudBtn) {
      syncToCloudBtn.addEventListener('click', async () => {
        if (!this.isAuthenticated) {
          this.showNotification('Please unlock the password manager first', 'info');
          return;
        }
        await this.syncToCloud();
      });
    }

    if (syncFromCloudBtn) {
      syncFromCloudBtn.addEventListener('click', async () => {
        if (!this.isAuthenticated) {
          this.showNotification('Please unlock the password manager first', 'info');
          return;
        }
        await this.syncFromCloudWithMerge();
      });
    }

    if (logoutGoogleBtn) {
      logoutGoogleBtn.addEventListener('click', () => {
        this.logoutFromGoogleDrive();
      });
    }

    // Modal events
    this.bindModalEvents();
    
    // Keyboard navigation
    this.bindKeyboardNavigation();
  }

  /**
   * Bind modal events
   */
  bindModalEvents() {
    const modal = document.getElementById('passwordModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const generatePasswordBtn = document.getElementById('generatePassword');

    // Close modal
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.hideModal();
      });
    }

    // Save password
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await this.savePassword();
      });
    }

    // Toggle password visibility
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', () => {
        this.togglePasswordVisibility();
      });
    }

    // Generate password
    if (generatePasswordBtn) {
      generatePasswordBtn.addEventListener('click', () => {
        // Generate a strong password and fill the input
        const password = this.generateStrongPassword();
        document.getElementById('password').value = password;
        // Optionally, show a notification
        this.showNotification('Password generated!', 'success');
      });
    }

    // Close modal on outside click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideModal();
        }
      });
    }

    // Handle Enter key in modal
    const modalInputs = modal.querySelectorAll('input, textarea');
    modalInputs.forEach(input => {
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && e.target.type !== 'textarea') {
          e.preventDefault();
          await this.savePassword();
        }
      });
    });
  }

  /**
   * Generate a strong random password
   * @param {number} length - Password length (default 16)
   * @param {boolean} useUpper - Include uppercase letters
   * @param {boolean} useLower - Include lowercase letters
   * @param {boolean} useNumbers - Include numbers
   * @param {boolean} useSymbols - Include symbols
   * @returns {string} Generated password
   */
  generateStrongPassword(length = 16, useUpper = true, useLower = true, useNumbers = true, useSymbols = true) {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    let chars = '';
    if (useUpper) chars += upper;
    if (useLower) chars += lower;
    if (useNumbers) chars += numbers;
    if (useSymbols) chars += symbols;
    if (!chars) chars = lower;
    let password = '';
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      password += chars[idx];
    }
    return password;
  }

  /**
   * Bind keyboard navigation
   */
  bindKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // Handle close window shortcut (Ctrl+W or Cmd+W)
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        this.closeWindow();
        return;
      }

      // Don't handle keyboard events when modal is open
      if (document.getElementById('passwordModal').classList.contains('show')) {
        return;
      }

      // Don't handle keyboard events when not authenticated
      if (!this.isAuthenticated) {
        return;
      }

      const items = document.querySelectorAll('.password-item');
      const selectedItem = document.querySelector('.password-item.selected');
      let selectedIndex = Array.from(items).indexOf(selectedItem);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
          this.selectPasswordItem(selectedIndex);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          this.selectPasswordItem(selectedIndex);
          break;
        case 'Enter':
          if (selectedItem) {
            e.preventDefault();
            const passwordId = selectedItem.getAttribute('data-id');
            this.copyPassword(passwordId);
          }
          break;
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (!this.isAuthenticated) {
              this.showNotification('Please unlock the password manager first', 'info');
              return;
            }
            this.showAddModal();
          }
          break;
      }
    });
  }

  /**
   * Select password item by index
   */
  selectPasswordItem(index) {
    const items = document.querySelectorAll('.password-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Render password list with TOTP code if available
   */
  renderPasswordList() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    // Check if authenticated
    if (!this.isAuthenticated) {
      mainContent.innerHTML = `<div class="empty">Please unlock the password manager first</div>`;
      return;
    }

    let filteredPasswords = this.passwordList;
    // Filter by search keyword
    if (this.searchKeyword) {
      filteredPasswords = this.passwordList.filter(password => 
        password.title.toLowerCase().includes(this.searchKeyword) ||
        password.username.toLowerCase().includes(this.searchKeyword) ||
        (password.url && password.url.toLowerCase().includes(this.searchKeyword)) ||
        (password.notes && password.notes.toLowerCase().includes(this.searchKeyword))
      );
    }

    if (filteredPasswords.length === 0) {
      const emptyMessage = this.searchKeyword ? 'No passwords found' : 'No passwords yet. Click + to add one.';
      mainContent.innerHTML = `<div class="empty">${emptyMessage}</div>`;
      return;
    }

    const passwordListHtml = filteredPasswords.map(password => {
      const id = password.id;
      // Generate TOTP code if totpSecret exists
      let totpHtml = '';
      if (password.totpSecret) {
        const code = this.getTotpCode(password.totpSecret);
        const remaining = this.getTotpRemaining();
        totpHtml = `<div class="totp-section"><span class="totp-code" id="totp-code-${id}">${code}</span><span class="totp-timer" id="totp-timer-${id}">${remaining}s</span></div>`;
      }
      return `
        <div class="password-item" data-id="${id}">
          <div class="password-info">
            <div class="password-title">${this.escapeHtml(password.title)}</div>
            <div class="password-username">${this.escapeHtml(password.username)}</div>
            ${totpHtml}
          </div>
          <div class="password-actions">
            <button class="action-btn copy-btn" title="Copy Password" data-id="${id}">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-3M8 3H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="action-btn edit-btn" title="Edit" data-id="${id}">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4H4a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-7" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="action-btn delete-btn" title="Delete" data-id="${id}">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6h14M8 6V4a2 2 0 012-2h0a2 2 0 012 2v2m3 0v10a2 2 0 01-2 2H7a2 2 0 01-2-2V6h12z" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    mainContent.innerHTML = `<div class="password-list">${passwordListHtml}</div>`;

    // Bind password item events
    this.bindPasswordItemEvents();

    // Start TOTP timer if any entry has TOTP
    if (filteredPasswords.some(p => p.totpSecret)) {
      this.startTotpTimer(filteredPasswords);
    }
  }

  /**
   * Bind password item events
   */
  bindPasswordItemEvents() {
    const passwordItems = document.querySelectorAll('.password-item');
    const copyBtns = document.querySelectorAll('.copy-btn');
    const editBtns = document.querySelectorAll('.edit-btn');
    const deleteBtns = document.querySelectorAll('.delete-btn');

    // Password item click
    passwordItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.action-btn')) {
          const passwordId = item.getAttribute('data-id');
          this.copyPassword(passwordId);
        }
      });
    });

    // Copy button
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const passwordId = btn.getAttribute('data-id');
        this.copyPassword(passwordId);
      });
    });

    // Edit button
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const passwordId = btn.getAttribute('data-id');
        this.showEditModal(passwordId);
      });
    });

    // Delete button
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const passwordId = btn.getAttribute('data-id');
        this.deletePassword(passwordId);
      });
    });
  }

  /**
   * Show add password modal
   */
  showAddModal() {
    if (!this.isAuthenticated) {
      this.showNotification('Please unlock the password manager first', 'info');
      return;
    }
    
    this.currentEditId = null;
    this.clearModalForm();
    document.getElementById('modalTitle').textContent = 'Add New Password';
    document.getElementById('passwordModal').classList.add('show');
    document.getElementById('title').focus();
  }

  /**
   * Show edit password modal
   */
  showEditModal(passwordId) {
    if (!this.isAuthenticated) {
      this.showNotification('Please unlock the password manager first', 'info');
      return;
    }
    
    const password = this.passwordList.find(p => p.id === passwordId);
    if (!password) return;

    this.currentEditId = passwordId;
    this.fillModalForm(password);
    document.getElementById('modalTitle').textContent = 'Edit Password';
    document.getElementById('passwordModal').classList.add('show');
    document.getElementById('title').focus();
  }

  /**
   * Hide modal
   */
  hideModal() {
    document.getElementById('passwordModal').classList.remove('show');
    this.currentEditId = null;
  }

  /**
   * Clear modal form
   */
  clearModalForm() {
    document.getElementById('title').value = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('url').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('totpSecret').value = '';
  }

  /**
   * Fill modal form with password data
   */
  fillModalForm(password) {
    document.getElementById('title').value = password.title || '';
    document.getElementById('username').value = password.username || '';
    document.getElementById('password').value = password.password || '';
    document.getElementById('url').value = password.url || '';
    document.getElementById('notes').value = password.notes || '';
    document.getElementById('totpSecret').value = password.totpSecret || '';
  }

  /**
   * Save password (including TOTP secret)
   */
  async savePassword() {
    if (!this.isAuthenticated) {
      this.showNotification('Please unlock the password manager first', 'info');
      return;
    }

    const title = document.getElementById('title').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const url = document.getElementById('url').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const totpSecret = document.getElementById('totpSecret').value.trim();

    // If TOTP secret is provided, only title is required
    if (totpSecret) {
      if (!title) {
        this.showNotification('Please fill in title', 'info');
        return;
      }
    } else {
      // If no TOTP secret, require title, username and password
      if (!title || !username || !password) {
        this.showNotification('Please fill in title, username and password', 'info');
        return;
      }
    }

    const passwordData = {
      title,
      username,
      password,
      url,
      notes,
      totpSecret,
      createdAt: new Date().toISOString()
    };

    if (this.currentEditId) {
      // Edit existing password
      const index = this.passwordList.findIndex(p => p.id === this.currentEditId);
      if (index !== -1) {
        passwordData.id = this.currentEditId;
        passwordData.createdAt = this.passwordList[index].createdAt;
        passwordData.updatedAt = new Date().toISOString();
        this.passwordList[index] = passwordData;
      }
    } else {
      // Add new password
      passwordData.id = this.generateId();
      this.passwordList.unshift(passwordData);
    }

    this.renderPasswordList();
    this.hideModal();
    this.showNotification('Password saved successfully!', 'success');
    
    // Auto sync to cloud if connected
    if (window.plugin.googleDrive.isAuthenticated()) {
      await this.syncToCloud();
    }
  }

  /**
   * Copy password or TOTP code to clipboard
   */
  async copyPassword(passwordId) {
    if (!this.isAuthenticated) {
      this.showNotification('Please unlock the password manager first', 'info');
      return;
    }

    const password = this.passwordList.find(p => p.id === passwordId);
    if (!password) return;

    try {
      let contentToCopy;
      let notificationMessage;

      // If TOTP secret exists, copy TOTP code instead of password
      if (password.totpSecret) {
        const totpCode = this.getTotpCode(password.totpSecret);
        if (totpCode && totpCode !== 'Invalid' && totpCode !== 'N/A') {
          contentToCopy = totpCode;
          notificationMessage = 'TOTP code copied to clipboard!';
        } else {
          this.showNotification('Invalid TOTP secret', 'error');
          return;
        }
      } else {
        // Copy password if no TOTP secret
        contentToCopy = password.password;
        notificationMessage = 'Password copied to clipboard!';
      }

      await window.otools.writeClipboard(contentToCopy);
      this.showNotification(notificationMessage, 'success');
    } catch (error) {
      this.showNotification('Failed to copy to clipboard', 'error');
    }
  }

  /**
   * Delete password
   */
  async deletePassword(passwordId) {
    if (!this.isAuthenticated) {
      this.showNotification('Please unlock the password manager first', 'info');
      return;
    }

    if (confirm('Are you sure you want to delete this password?')) {
      this.passwordList = this.passwordList.filter(p => p.id !== passwordId);
      this.renderPasswordList();
      this.showNotification('Password deleted successfully!', 'success');
      
      // Auto sync to cloud if connected
      if (window.plugin.googleDrive.isAuthenticated()) {
        await this.syncToCloud();
      }
    }
  }

  /**
   * Toggle password visibility and update eye icon
   */
  togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    const icon = document.getElementById('togglePasswordIcon');

    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      // Switch to eye-off icon
      icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0120 12c0-5.52-4.48-10-10-10S0 6.48 0 12c0 1.76.46 3.4 1.26 4.82L17.94 17.94z"/><path d="M1 1l22 22"/>';
    } else {
      passwordInput.type = 'password';
      // Switch to eye icon
      icon.innerHTML = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>';
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'success') {
    // Remove existing notifications
    this.removeExistingDialogs('.copy-success');

    // Create new notification
    const notification = document.createElement('div');
    notification.className = 'copy-success';
    
    // Set background color based on type
    let backgroundColor;
    switch (type) {
      case 'success':
        backgroundColor = 'var(--success-color)';
        break;
      case 'error':
        backgroundColor = 'var(--danger-color)';
        break;
      case 'info':
        backgroundColor = 'var(--info-color)';
        break;
      case 'warning':
        backgroundColor = 'var(--warning-color)';
        break;
      default:
        backgroundColor = 'var(--success-color)';
    }
    
    notification.style.background = backgroundColor;
    notification.textContent = message;
    
    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(tag) {
      const charsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return charsToReplace[tag] || tag;
    });
  }

  /**
   * Get passwords from database
   */
  async getPasswords() {
    const result = await window.otools.getDbValue(this.DB_NAME, this.PASSWORDS_KEY);
    if (result && result.success && result.value) {
      return result.value;
    }
    return [];
  }

  /**
   * Save passwords to database
   */
  async savePasswords() {
    await window.otools.setDbValue(this.DB_NAME, this.PASSWORDS_KEY, this.passwordList);
  }

  /**
   * Get encrypted passwords from database
   */
  async getEncryptedPasswords() {
    const result = await window.otools.getDbValue(this.DB_NAME, this.PASSWORDS_KEY);
    if (result && result.success && result.value) {
      // Decrypt the passwords
      const decryptedPasswords = await Promise.all(result.value.map(async (encryptedPassword) => {
        const decrypted = await this.decryptData(encryptedPassword, this.masterPassword);
        return decrypted;
      }));
      return decryptedPasswords;
    }
    return [];
  }

  /**
   * Save encrypted passwords to database
   */
  async saveEncryptedPasswords() {
    // Encrypt the passwords before saving
    const encryptedPasswords = await Promise.all(this.passwordList.map(async (password) => {
      const encrypted = await this.encryptData(password, this.masterPassword);
      return encrypted;
    }));
    await window.otools.setDbValue(this.DB_NAME, this.PASSWORDS_KEY, encryptedPasswords);
  }

  /**
   * Get current TOTP code using plugin.generateTotp from preload
   */
  getTotpCode(secret) {
    try {
      if (!window.plugin || typeof window.plugin.generateTotp !== 'function') return 'N/A';
      const code = window.plugin.generateTotp(secret);
      return code || 'Invalid';
    } catch (e) {
      return 'Invalid';
    }
  }

  /**
   * Get seconds remaining for current TOTP code
   */
  getTotpRemaining() {
    const step = 30;
    const now = Math.floor(Date.now() / 1000);
    return step - (now % step);  
  }

  /**
   * Start TOTP timer to update codes and countdown
   */
  startTotpTimer(passwords) {
    if (this._totpInterval) clearInterval(this._totpInterval);
    this._totpInterval = setInterval(() => {
      passwords.forEach(p => {
        if (p.totpSecret) {
          const codeElem = document.getElementById(`totp-code-${p.id}`);
          const timerElem = document.getElementById(`totp-timer-${p.id}`);
          if (codeElem) codeElem.textContent = this.getTotpCode(p.totpSecret);
          if (timerElem) timerElem.textContent = this.getTotpRemaining() + 's';
        }
      });
    }, 1000);
  }

  // Google Drive Cloud Sync 

  /**
   * Initialize cloud sync
   */
  async initCloudSync() {
    // Check if user is authenticated with Google Drive
    const isAuthenticated = window.plugin.googleDrive.isAuthenticated();
    
    if (isAuthenticated) {
      // Auto sync on startup with local-first merge strategy
      const syncResult = await this.syncFromCloudWithMerge();
      
      // If sync failed, show recovery options
      if (!syncResult) {
        this.showCloudSyncRecoveryDialog();
      }
    }
    
    // Update sync status
    this.updateSyncStatus();
  }

  /**
   * Show cloud sync recovery dialog
   */
  showCloudSyncRecoveryDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'modal show';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Cloud Sync Issue Detected</h3>
          <button class="close-btn" onclick="this.closest('.modal').remove()">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5l10 10" stroke="#666" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p>Failed to sync from Google Drive. This could be due to:</p>
          <ul>
            <li>Master password mismatch</li>
            <li>Corrupted cloud data</li>
            <li>Network connectivity issues</li>
          </ul>
          <p>Your local passwords are safe and encrypted.</p>
          <p><strong>Note:</strong> Your local passwords will be preserved and merged with cloud data when possible.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="window.passwordManager.resetCloudSync()">Reset Cloud Sync</button>
          <button class="btn-secondary" onclick="window.passwordManager.disconnectFromCloud()">Disconnect</button>
          <button class="btn-primary" onclick="window.passwordManager.retryCloudSync()">Retry</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
  }

  /**
   * Reset cloud sync (delete cloud file and re-upload)
   */
  async resetCloudSync() {
    try {
      // Remove the dialog
      this.removeExistingDialogs('.modal.show');
      
      this.showNotification('Resetting cloud sync...', 'info');
      
      // Delete cloud file
      await window.plugin.googleDrive.deleteFromDrive();
      
      // Upload current local data
      const uploadResult = await this.syncToCloud();
      
      if (uploadResult) {
        this.showNotification('Cloud sync reset successfully!', 'success');
      } else {
        this.showNotification('Failed to reset cloud sync', 'error');
      }
    } catch (error) {
      this.showNotification('Failed to reset cloud sync: ' + error.message, 'error');
    }
  }

  /**
   * Disconnect from cloud sync
   */
  async disconnectFromCloud() {
    // Remove the dialog
    this.removeExistingDialogs('.modal.show');
    
    // Logout from Google Drive
    window.plugin.googleDrive.logout();
    this.updateSyncStatus();
    
    this.showNotification('Disconnected from Google Drive. Your local passwords are safe.', 'info');
  }

  /**
   * Retry cloud sync
   */
  async retryCloudSync() {
    // Remove the dialog
    this.removeExistingDialogs('.modal.show');
    
    // Try to sync again with merge strategy
    const result = await this.syncFromCloudWithMerge();
    
    if (!result) {
      // If retry fails, show the recovery dialog again
      setTimeout(() => {
        this.showCloudSyncRecoveryDialog();
      }, 1000);
    }
  }



  /**
   * Show Google Drive login dialog
   */
  showGoogleDriveLogin() {
    const dialog = document.createElement('div');
    dialog.className = 'google-drive-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Connect to Google Drive</h3>
        <p>Connect your Google Drive account to enable cloud sync for your passwords.</p>
        <div class="login-container">
          <button class="btn-primary" id="googleLoginBtn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
        <div class="dialog-buttons">
          <button class="btn-secondary" id="cancelGoogleLogin">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Bind events
    document.getElementById('googleLoginBtn').addEventListener('click', () => {
      this.handleGoogleLogin();
    });
    
    document.getElementById('cancelGoogleLogin').addEventListener('click', () => {
      this.removeExistingDialogs('.google-drive-dialog');
    });
  }

  /**
   * Handle Google Drive login
   */
  async handleGoogleLogin() {
    try {
      // Get current OAuth port
      const oauthPort = await window.plugin.googleDrive.getOAuthPort();
      
      // Get authorization URL
      const authUrl = await window.plugin.googleDrive.getAuthUrl();
      
      // Open popup window for OAuth
      const popup = window.open(authUrl, 'googleAuth', 'width=500,height=600');
      
      // Listen for authorization code
      const messageHandler = async (event) => {
        // Accept messages from localhost callback server (any port)
        if (!event.origin.startsWith('http://localhost:') && event.origin !== 'null') {
          return;
        }
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          const { code } = event.data;
          
          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Remove event listener
          window.removeEventListener('message', messageHandler);
          
          // Exchange code for tokens
          const result = await window.plugin.googleDrive.getTokensFromCode(code);
          
          if (result.success) {
            // Close popup
            try {
              if (popup && !popup.closed) {
                popup.close();
              }
            } catch (error) {
              // Continue without closing popup
            }
            
            // Remove dialog
            this.removeExistingDialogs('.google-drive-dialog');
            
            // Sync with cloud
            await this.syncToCloud();
            
            this.showNotification('Successfully connected to Google Drive!', 'success');
            this.updateSyncStatus();
          } else {
            this.showNotification('Failed to connect to Google Drive: ' + result.error, 'error');
          }
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Remove event listener
          window.removeEventListener('message', messageHandler);
          
          this.showNotification('Google Drive authorization failed: ' + event.data.error, 'error');
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Add timeout to handle cases where popup is blocked or fails
      let timeoutId = setTimeout(() => {
        try {
          // Check if popup is accessible
          if (popup) {
            // Try to access popup properties safely
            const isClosed = popup.closed;
            if (isClosed) {
              window.removeEventListener('message', messageHandler);
              this.showNotification('Google Drive login popup was closed. Please try again.', 'error');
            }
          }
        } catch (error) {
          // Handle COOP policy error
          window.removeEventListener('message', messageHandler);
          this.showNotification('Google Drive login popup was closed. Please try again.', 'error');
        }
      }, 30000); // 30 second timeout
      
    } catch (error) {
      this.showNotification('Failed to start Google Drive login: ' + error.message, 'error');
    }
  }

  async syncToCloud() {
    try {
      // Get encrypted passwords from database (actual encrypted data)
      const result = await window.otools.getDbValue(this.DB_NAME, this.PASSWORDS_KEY);
      if (!result || !result.success || !result.value) {
        this.showNotification('No passwords to sync', 'info'); // 静默提示
        return false;
      }
      // Check if data is an empty array
      if (Array.isArray(result.value) && result.value.length === 0) {
        this.showNotification('No passwords to sync', 'info'); // 静默提示，合并
        return false;
      }
      // Ensure data is properly formatted for cloud storage
      const cloudData = {
        version: '1.0',
        timestamp: Date.now(),
        data: result.value
      };
      // Upload encrypted data to Google Drive
      const uploadResult = await window.plugin.googleDrive.uploadToDrive(cloudData);
      if (uploadResult.success) {
        this.showNotification('Successfully synced to Google Drive!', 'info'); // 静默提示
        this.updateSyncStatus();
        return true;
      } else {
        this.showNotification('Failed to sync to Google Drive: ' + uploadResult.error, 'error'); // 失败弹窗
        return false;
      }
    } catch (error) {
      this.showNotification('Sync failed: ' + error.message, 'error'); // 失败弹窗
      return false;
    }
  }

  async syncFromCloudWithMerge() {
    try {
      // Download from Google Drive
      const result = await window.plugin.googleDrive.downloadFromDrive();
      
      if (result.success) {
        // Handle different cloud data formats
        let cloudData = result.data;
        // If cloudData is a Blob, convert to string
        if (cloudData instanceof Blob) {
          cloudData = await cloudData.text();
        }
        // If data is a string, try to parse it
        if (typeof cloudData === 'string') {
          try {
            cloudData = JSON.parse(cloudData);
          } catch (parseError) {
            this.showNotification('Invalid cloud data format. Please reset cloud sync.', 'error'); // 失败弹窗
            return false;
          }
        }
        // Compatible with both new and old formats: use data if it is an array, otherwise use cloudData directly
        let encryptedArray = [];
        if (cloudData && Array.isArray(cloudData.data)) {
          encryptedArray = cloudData.data;
        } else if (Array.isArray(cloudData)) {
          encryptedArray = cloudData;
        } else {
          this.showNotification('Invalid cloud data format. Please reset cloud sync.', 'error'); // 失败弹窗
          return false;
        }
        // Fault-tolerant decryption: skip items with wrong format or failed decryption
        const decryptedPasswords = [];
        let failedCount = 0;
        for (let i = 0; i < encryptedArray.length; i++) {
          const encryptedPassword = encryptedArray[i];
          let decrypted = null;
          try {
            // Check encrypted object structure
            if (!encryptedPassword || typeof encryptedPassword !== 'object' || !encryptedPassword.encrypted || !encryptedPassword.iv || !encryptedPassword.salt) {
              failedCount++;
              continue;
            }
            decrypted = await this.decryptData(encryptedPassword, this.masterPassword);
            if (decrypted) {
              decryptedPasswords.push(decrypted);
            } else {
              failedCount++;
            }
          } catch (error) {
            failedCount++;
            continue;
          }
        }
        if (decryptedPasswords.length === 0) {
          this.showNotification('Failed to decrypt any passwords from cloud. The master password may be incorrect or the data is corrupted.', 'error'); // 失败弹窗
          return false;
        }
        if (failedCount > 0) {
          this.showNotification(`Some cloud data failed to parse. Successfully imported ${decryptedPasswords.length} items.`, 'info'); // 静默提示
        } else {
          this.showNotification(`Successfully imported ${decryptedPasswords.length} passwords from cloud.`, 'info'); // 静默提示
        }
        // Merge strategy: local-first
        const mergedPasswords = this.mergePasswordsLocalFirst(decryptedPasswords);
        // Update password list with merged data
        this.passwordList = mergedPasswords;
        await this.savePasswords();
        this.renderPasswordList();
        this.updateSyncStatus();
        return true;
      } else {
        this.showNotification('Failed to sync from cloud: ' + result.error, 'error'); // 失败弹窗
        return false;
      }
    } catch (error) {
      this.showNotification('Sync failed: ' + error.message, 'error'); // 失败弹窗
      return false;
    }
  }

  mergePasswordsLocalFirst(cloudPasswords) {
    const localPasswords = [...this.passwordList];
    const mergedPasswords = [...localPasswords];
    // Create a map of local passwords by ID for quick lookup
    const localPasswordMap = new Map();
    localPasswords.forEach(pwd => {
      localPasswordMap.set(pwd.id, pwd);
    });
    // Process cloud passwords
    cloudPasswords.forEach(cloudPwd => {
      const localPwd = localPasswordMap.get(cloudPwd.id);
      if (!localPwd) {
        // This password doesn't exist locally, add it
        mergedPasswords.push(cloudPwd);
      }
      // Password exists locally, keep local version (local-first strategy)
    });
    // Show merge summary
    const newFromCloud = cloudPasswords.filter(cloudPwd => !localPasswordMap.has(cloudPwd.id)).length;
    if (newFromCloud > 0) {
      this.showNotification(`Added ${newFromCloud} new passwords from cloud`, 'info'); // 静默提示
    }
    return mergedPasswords;
  }



  /**
   * Update sync status display
   */
  updateSyncStatus() {
    const isAuthenticated = window.plugin.googleDrive.isAuthenticated();
    const syncStatusElement = document.getElementById('syncStatus');
    const connectGoogleBtn = document.getElementById('connectGoogle');
    const syncToCloudBtn = document.getElementById('syncToCloud');
    const syncFromCloudBtn = document.getElementById('syncFromCloud');
    const logoutGoogleBtn = document.getElementById('logoutGoogle');
    
    if (syncStatusElement) {
      if (isAuthenticated) {
        syncStatusElement.innerHTML = `
          <span class="sync-status connected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Connected to Google Drive
          </span>
        `;
        
        // Show sync buttons when connected
        if (connectGoogleBtn) connectGoogleBtn.style.display = 'none';
        if (syncToCloudBtn) syncToCloudBtn.style.display = 'flex';
        if (syncFromCloudBtn) syncFromCloudBtn.style.display = 'flex';
        if (logoutGoogleBtn) logoutGoogleBtn.style.display = 'flex';
      } else {
        syncStatusElement.innerHTML = `
          <span class="sync-status disconnected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Not connected to Google Drive
          </span>
        `;
        
        // Show connect button when disconnected
        if (connectGoogleBtn) connectGoogleBtn.style.display = 'flex';
        if (syncToCloudBtn) syncToCloudBtn.style.display = 'none';
        if (syncFromCloudBtn) syncFromCloudBtn.style.display = 'none';
        if (logoutGoogleBtn) logoutGoogleBtn.style.display = 'none';
      }
    }
  }

  /**
   * Logout from Google Drive
   */
  logoutFromGoogleDrive() {
    window.plugin.googleDrive.logout();
    this.updateSyncStatus();
    this.showNotification('Disconnected from Google Drive', 'info');
  }

  /**
   * Close the password manager window
   */
  closeWindow() {
    // Check if there are unsaved changes
    if (this.hasUnsavedChanges()) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        this.performClose();
      }
    } else {
      this.performClose();
    }
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges() {
    // Check if modal is open with unsaved data
    const modal = document.getElementById('passwordModal');
    if (modal && modal.classList.contains('show')) {
      const title = document.getElementById('title').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const url = document.getElementById('url').value;
      const notes = document.getElementById('notes').value;
      const totpSecret = document.getElementById('totpSecret').value;
      
      return title || username || password || url || notes || totpSecret;
    }
    return false;
  }

  /**
   * Perform the actual window close
   */
  performClose() {
    // Save any pending data
    this.saveEncryptedPasswords();
    
    // Show closing notification
    this.showNotification('Closing Password Manager...', 'info');
    
    // Close the window after a short delay
    setTimeout(() => {
      // Try to close using Electron API if available
      if (window.otools && window.otools.closeWindow) {
        window.otools.closeWindow();
      } else {
        // Fallback to browser close
        window.close();
      }
    }, 1000);
  }
}

// Initialize password manager
window.passwordManager = new PasswordManager(); 