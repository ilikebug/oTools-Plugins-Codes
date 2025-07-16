// =====================
// ClipboardManager 
// =====================

class ClipboardManager {
  constructor() {
    // Polling interval for clipboard
    this.POLL_INTERVAL = 100;
    // Maximum number of clipboard history items
    this.HISTORY_LIST_MAX = 100;
    this.HISTORY_KEY = 'clipboard_history';
    this.FAV_KEY = 'clipboard_fav';
    this.DB_NAME = 'clipboard_db';
    this.listenerEnable = false;
    this.lastUniqID = null;
    this.historyList = [];
    this.favList = [];
    this.showFavOnly = false;
    this.clusterize = null;
    this._needRender = false; // Mark if render is needed
    this._renderTimer = null; // Throttle render
    this._loading = false;
    this._binded = false; // Mark if event is already binded
    this.init();
  }

  // Show loading animation
  showLoading() {
    const contentArea = document.getElementById('contentArea');
    if (contentArea) {
      contentArea.innerHTML = '<div class="empty">Loading...</div>';
    }
    this._loading = true;
  }

  // Hide loading animation
  hideLoading() {
    this._loading = false;
  }

  // Throttle render to avoid frequent calls
  scheduleRender() {
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => {
      this.renderHistoryList();
    }, 60);
  }

  /**
   * Initialize the plugin
   */
  async init() {
    this.showLoading();
    await this.startClipboardListener();
    // Load history and fav in parallel
    const [history, fav] = await Promise.all([
      this.getHistory(),
      this.getFavList()
    ]);
    this.historyList = history;
    this.favList = fav;
    this.hideLoading();
    this.renderHistoryList();
    this.bindSearchEvents();
    this.bindFavToggleEvent();
    this.bindContentEvents(); 
  }

  /**
   * start up clipboard listener
   */
  async startClipboardListener() {
    if (this.listenerEnable) {
      return
    } 
    setInterval(() => this.checkClipboard(), this.POLL_INTERVAL)
    this.listenerEnable = true
  } 

  /**
   * check clipboard
   */
  async checkClipboard() {
    const content = await this.readClipboardItem();
    if (!content) return; 
     const uniqID = this.generateContentUniqID(content); 
     if (uniqID == this.lastUniqID) return;   
     this.lastUniqID = uniqID
     // execute set history item
     this.addContent2HistoryList(content)
     // render content
     this.renderHistoryList()
  }

  // Generate unique ID
  generateContentUniqID(content) {
    if (content.type === 'text') return 't_' + this.hashCode(content.data);
    if (content.type === 'image') return 'i_' + this.hashCode(content.data);
    return 'u_' + Date.now();
  } 
  
  // hash code by clipboard content
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i); 
      hash |= 0;
    }
    return hash.toString(36);
  }

  // Only call render when data changes
  addContent2HistoryList(content) {
    if (this.historyList.length >= this.HISTORY_LIST_MAX) {
      this.historyList.shift();
    }
    this.historyList.push(content);
    this.scheduleRender();
    this.saveHistoryList(); 
  }

  getHistoryList() {
    return this.historyList;
  }

  async saveHistoryList() {
    await window.otools.setDbValue(this.DB_NAME, this.HISTORY_KEY, this.historyList);
  } 

  // Only render when data changes
  renderHistoryList(list) {
    if (this._loading) return;
    // Ensure DOM is ready before Clusterize init
    const contentArea = document.getElementById('contentArea');
    const scrollArea = document.getElementById('scrollArea');
    if (!contentArea || !scrollArea) {
      setTimeout(() => this.renderHistoryList(list), 50);
      return;
    }
    if (this.showFavOnly) {
      list = [...this.favList].reverse();
    } else if (!list) {
      list = [...this.historyList].reverse();
    }
    if (!list || list.length === 0) {
      if (contentArea) contentArea.innerHTML = '<div class="empty">No clipboard history.</div>';
      if (this.clusterize) this.clusterize.update([]);
      return;
    }
    // Generate HTML string array for Clusterize
    const htmlRows = list.map((item, idx) => this.renderClipItem(item, idx));
    if (!this.clusterize) {
      this.clusterize = new window.Clusterize({
        rows: htmlRows,
        scrollId: 'scrollArea',
        contentId: 'contentArea',
        no_data_text: ''
      });
    } else {
      this.clusterize.update(htmlRows);
    }
    // Important: Bind keyboard navigation after each render
    this.bindKeyboardNavigation(list);
  }

  // Render a single clipboard item
  renderClipItem(item, idx) {
    const isFav = this.isFav(item) ? 'fav' : '';
    const starIcon = `<button class="clip-fav-btn ${isFav}" data-index="${idx}" title="Favorite">
      <svg viewBox="0 0 20 20" fill="none" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 15l-5.09 2.67 1-5.82L2 7.97l5.91-.86L10 2.5l2.09 4.61 5.91.86-4.27 4.88 1 5.82z" stroke="#2563eb" stroke-width="1.5" fill="${this.isFav(item) ? '#ffd600' : 'none'}"/>
      </svg>
    </button>`;
    if (item.type === 'text') {
      return `<div class='clip-item' data-index='${idx}'>
        <div class='clip-content' data-fulltext="${this.escapeHtml(item.data)}">${this.escapeHtml(item.data)}</div>
        ${starIcon}
      </div>`;
    } else if (item.type === 'image') {
      return `<div class='clip-item' data-index='${idx}'>
        <img class='clip-img' src='${item.data}' loading="lazy" />
        ${starIcon}
      </div>`;
    } else {
      return `<div class='clip-item' data-index='${idx}'>
        <div class='clip-content'>[Unknown type]</div>
        ${starIcon}
      </div>`;
    }
  }

  // Keyboard navigation for clipboard items
  bindKeyboardNavigation(list, startIdx = 0, endIdx = list.length) {
    // Remove previous listeners
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
    }
    let selectedIdx = startIdx;
    const items = document.querySelectorAll('.clip-item');
    if (items.length === 0) return;
    // Set initial highlight
    items.forEach((el, idx) => {
      el.classList.toggle('selected', idx === 0);
    });
    this._keydownHandler = (e) => {
      if (e.key === 'Tab' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.showFavOnly = !this.showFavOnly;
        const favToggleBtn = document.querySelector('.fav-toggle-btn');
        if (favToggleBtn) {
          favToggleBtn.classList.toggle('active', this.showFavOnly);
        }
        const input = document.querySelector('.top-bar input');
        if (input) input.value = '';
        this.renderHistoryList();
        return;
      }
      if (e.key === 'ArrowDown') {
        selectedIdx = Math.min(selectedIdx + 1, endIdx - 1);
        items.forEach((el, idx) => {
          el.classList.toggle('selected', idx === selectedIdx - startIdx);
        });
        items[selectedIdx - startIdx]?.scrollIntoView({block: 'nearest'});
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        selectedIdx = Math.max(selectedIdx - 1, startIdx);
        items.forEach((el, idx) => {
          el.classList.toggle('selected', idx === selectedIdx - startIdx);
        });
        items[selectedIdx - startIdx]?.scrollIntoView({block: 'nearest'});
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const content = list[selectedIdx];
        this.copyToClipboard(content);
        window.otools.hideWindow();
      }
    };
    document.addEventListener('keydown', this._keydownHandler);
  }

  bindFavToggleEvent() {
    const favToggleBtn = document.querySelector('.fav-toggle-btn');
    if (favToggleBtn) {
      favToggleBtn.onclick = () => {
        this.showFavOnly = !this.showFavOnly;
        favToggleBtn.classList.toggle('active', this.showFavOnly);
        const input = document.querySelector('.top-bar input');
        if (input) input.value = '';
        this.renderHistoryList();
      }
    }
  }

  /**
   * Bind search input and button events
   */
  bindSearchEvents() {
    const input = document.querySelector('.top-bar input');
    if (!input) return;
    input.addEventListener('input', () => {
      const value = input.value;
      if (value === '') {
        this.renderHistoryList();
      } else {
        this.handleSearch(value);
      }
    });
  }

  /**
   * Search and render results
   */
  handleSearch(keyword) {
    keyword = keyword.trim().toLowerCase();
    if (!keyword) {
      this.renderHistoryList();
      return;
    }
    const filtered = this.historyList.filter(item => {
      if (item.type === 'text') {
        return item.data.toLowerCase().includes(keyword);
      }
      // Extend for other types if needed
      return false;
    });
    this.renderHistoryList(filtered);
  }

  // Add a helper to escape HTML for tooltip
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

  // Get History 
  async getHistory() {
    const result = await window.otools.getDbValue(this.DB_NAME, this.HISTORY_KEY); 
    if (result && result.success && result.value) {
      return result.value
    }
    return []
  }

  // Read clipboard content (prefer text, then image)
  async readClipboardItem() {
    const textData = await window.otools.readClipboard();
    if (textData && textData.success) {
      return { type: 'text', data: textData.text };
    }
    const imageData = await window.otools.readClipboardImage(); 
    if (imageData && imageData.success) {
      return { type: 'image', data: imageData.imageData };
    }
    return null; 
  }

  // Copy to clipboard
  async copyToClipboard(item) {
    if (item.type === 'text') {
      await window.otools.writeClipboard(item.data); 
    } else if (item.type === 'image') {
      await window.otools.writeClipboardImage(item.data);
    }
  }

  // fav methods
  async getFavList() {
    const result = await window.otools.getDbValue(this.DB_NAME, this.FAV_KEY);
    if (result && result.success && result.value) {
      return result.value;
    }
    return [];
  }

  async saveFavList() { 
    await window.otools.setDbValue(this.DB_NAME, this.FAV_KEY, this.favList);
  }

  addToFav(item) {
    const uniqID = this.generateContentUniqID(item);
    if (!this.favList.find(f => this.generateContentUniqID(f) === uniqID)) { 
      this.favList.push(item);
      this.scheduleRender();
      this.saveFavList(); // Immediately save after change
    }
  }

  removeFromFav(item) {
    const uniqID = this.generateContentUniqID(item);
    const before = this.favList.length;
    this.favList = this.favList.filter(f => this.generateContentUniqID(f) !== uniqID);
    if (this.favList.length !== before) {
      this.scheduleRender();
      this.saveFavList(); // Immediately save after change
    }
  }
  
  isFav(item) {
    const uniqID = this.generateContentUniqID(item);
    return this.favList.some(f => this.generateContentUniqID(f) === uniqID);
  }

  // Only bind content events once, use event delegation
  bindContentEvents() {
    if (this._binded) return;
    this._binded = true;
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    contentArea.addEventListener('click', async (e) => {
      const item = e.target.closest('.clip-item');
      if (!item) return;
      if (e.target.closest('.clip-fav-btn')) return;
      const idx = item.getAttribute('data-index');
      const list = this.showFavOnly ? [...this.favList].reverse() : [...this.historyList].reverse();
      const content = list[idx];
      await this.copyToClipboard(content);
      await window.otools.hideWindow();
    });
    contentArea.addEventListener('click', (e) => {
      const btn = e.target.closest('.clip-fav-btn');
      if (!btn) return;
      e.stopPropagation();
      const idx = btn.getAttribute('data-index');
      const list = this.showFavOnly ? [...this.favList].reverse() : [...this.historyList].reverse();
      const content = list[idx];
      if (this.isFav(content)) {
        this.removeFromFav(content);
      } else {
        this.addToFav(content);
      }
    });
    // Tooltip events
    contentArea.addEventListener('mouseenter', (e) => {
      const el = e.target.closest('.clip-content');
      if (!el) return;
      el.style.maxHeight = 'none';
      el.style.webkitLineClamp = 'unset';
      el.style.overflow = 'visible';
    }, true);
    contentArea.addEventListener('mouseleave', (e) => {
      const el = e.target.closest('.clip-content');
      if (!el) return;
      el.style.maxHeight = '60px';
      el.style.webkitLineClamp = 3;
      el.style.overflow = 'hidden';
    }, true);
  }
} 


window.onload = function() {
  window.clipboard = new ClipboardManager();
}
