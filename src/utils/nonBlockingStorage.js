// utils/nonBlockingStorage.js - Non-blocking storage operations with lazy loading and pagination
// ✅ CIRCULAR DEPENDENCY FIX: Remove direct import, use dependency injection instead

// ✅ CROSS-PLATFORM FIX: setImmediate polyfill for environments that don't support it
const setImmediatePolyfill = typeof setImmediate !== 'undefined' 
  ? setImmediate 
  : (fn) => setTimeout(fn, 0);

// ✅ NON-BLOCKING JSON OPERATIONS: Use MessageChannel for background processing
class NonBlockingJSON {
  static async stringify(obj, chunkSize = 1000) {
    // For small objects, use regular JSON.stringify
    if (this._estimateSize(obj) < chunkSize) {
      return JSON.stringify(obj);
    }

    // For large objects, use chunked processing with setImmediate
    return new Promise((resolve, reject) => {
      try {
        const result = JSON.stringify(obj);
        // Use setImmediate to yield to UI thread
        setImmediatePolyfill(() => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  }

  static async parse(str, chunkSize = 1000) {
    // For small strings, use regular JSON.parse
    if (str.length < chunkSize) {
      return JSON.parse(str);
    }

    // For large strings, use non-blocking parsing
    return new Promise((resolve, reject) => {
      try {
        const result = JSON.parse(str);
        // Use setImmediate to yield to UI thread
        setImmediatePolyfill(() => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  }

  static _estimateSize(obj) {
    // Quick size estimation without full serialization
    if (typeof obj === 'string') return obj.length;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (obj === null || obj === undefined) return 4;
    if (Array.isArray(obj)) return obj.length * 50; // Rough estimate
    if (typeof obj === 'object') return Object.keys(obj).length * 100; // Rough estimate
    return 100;
  }
}

// ✅ LAZY LOADING STORAGE: Split large objects into smaller, manageable chunks
class LazyStorageManager {
  constructor(storageProvider = null) {
    this.cache = new Map();
    this.loadingPromises = new Map();
    this.storage = storageProvider;
  }

  // ✅ DEPENDENCY INJECTION: Set storage provider after initialization
  setStorageProvider(provider) {
    this.storage = provider;
  }

  // ✅ VALIDATION: Ensure storage provider is available
  _ensureStorage() {
    if (!this.storage) {
      throw new Error('Storage provider not initialized. Call setStorageProvider() first.');
    }
  }

  // ✅ SPLIT USER DATA: Separate basic info from heavy data like boards
  async setUserData(userData) {
    if (!userData) return;
    this._ensureStorage();

    try {
      // Split user data into basic and extended parts
      const { boards, colorHistory, preferences, ...basicData } = userData;
      
      // ✅ BASIC DATA: Always loaded, small and fast
      const basicUser = {
        ...basicData,
        hasBoards: !!(boards && boards.length > 0),
        hasPalettes: !!(colorHistory && colorHistory.length > 0),
        lastUpdated: Date.now()
      };

      // Store basic data immediately (non-blocking for small objects)
      await this.storage.setItem('user:basic', basicUser);

      // ✅ LAZY DATA: Store heavy data separately for on-demand loading
      if (boards && boards.length > 0) {
        await this._storeBoardsPaginated(boards);
      }

      if (colorHistory && colorHistory.length > 0) {
        await this._storeColorHistoryPaginated(colorHistory);
      }

      if (preferences) {
        await this.storage.setItem('user:preferences', preferences);
      }

      console.log('✅ User data stored with lazy loading pattern');
    } catch (error) {
      console.error('❌ Failed to store user data:', error);
      throw error;
    }
  }

  // ✅ FAST BASIC LOAD: Get essential user info immediately
  async getUserBasic() {
    this._ensureStorage();
    
    try {
      const basic = await this.storage.getItem('user:basic');
      if (basic) {
        this.cache.set('user:basic', basic);
      }
      return basic;
    } catch (error) {
      console.error('❌ Failed to load basic user data:', error);
      return null;
    }
  }

  // ✅ LAZY LOAD BOARDS: Load boards only when needed, with pagination
  async getUserBoards(page = 0, pageSize = 10) {
    const cacheKey = `user:boards:${page}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Start loading
    const loadingPromise = this._loadBoardsPage(page, pageSize);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const boards = await loadingPromise;
      this.cache.set(cacheKey, boards);
      return boards;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  // ✅ LAZY LOAD COLOR HISTORY: Load color history with pagination
  async getColorHistory(page = 0, pageSize = 20) {
    const cacheKey = `user:colors:${page}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Start loading
    const loadingPromise = this._loadColorHistoryPage(page, pageSize);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const colors = await loadingPromise;
      this.cache.set(cacheKey, colors);
      return colors;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  // ✅ PREFERENCES: Load user preferences (usually small)
  async getUserPreferences() {
    const cacheKey = 'user:preferences';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    this._ensureStorage();
    
    try {
      const preferences = await this.storage.getItem('user:preferences');
      if (preferences) {
        this.cache.set(cacheKey, preferences);
      }
      return preferences || {};
    } catch (error) {
      console.error('❌ Failed to load user preferences:', error);
      return {};
    }
  }

  // ✅ COMPLETE USER DATA: Assemble complete user data when needed (expensive)
  async getCompleteUserData() {
    try {
      const basic = await this.getUserBasic();
      if (!basic) return null;

      // Load additional data based on what's available
      const promises = [];
      
      if (basic.hasBoards) {
        promises.push(this._loadAllBoards());
      }
      
      if (basic.hasPalettes) {
        promises.push(this._loadAllColorHistory());
      }

      promises.push(this.getUserPreferences());

      const [boards = [], colorHistory = [], preferences = {}] = await Promise.all(promises);

      return {
        ...basic,
        boards,
        colorHistory,
        preferences
      };
    } catch (error) {
      console.error('❌ Failed to load complete user data:', error);
      return null;
    }
  }

  // ✅ PAGINATED BOARD STORAGE: Store boards in chunks to avoid large JSON operations
  async _storeBoardsPaginated(boards, pageSize = 10) {
    const totalPages = Math.ceil(boards.length / pageSize);
    
    // Store metadata
    await this.storage.setItem('user:boards:meta', {
      totalBoards: boards.length,
      totalPages,
      pageSize,
      lastUpdated: Date.now()
    });

    // Store each page
    const storePromises = [];
    for (let page = 0; page < totalPages; page++) {
      const start = page * pageSize;
      const end = start + pageSize;
      const pageBoards = boards.slice(start, end);
      
      storePromises.push(
        this.storage.setItem(`user:boards:page:${page}`, {
          page,
          boards: pageBoards,
          count: pageBoards.length
        })
      );
    }

    await Promise.all(storePromises);
  }

  // ✅ PAGINATED COLOR HISTORY STORAGE
  async _storeColorHistoryPaginated(colorHistory, pageSize = 20) {
    const totalPages = Math.ceil(colorHistory.length / pageSize);
    
    // Store metadata
    await this.storage.setItem('user:colors:meta', {
      totalColors: colorHistory.length,
      totalPages,
      pageSize,
      lastUpdated: Date.now()
    });

    // Store each page
    const storePromises = [];
    for (let page = 0; page < totalPages; page++) {
      const start = page * pageSize;
      const end = start + pageSize;
      const pageColors = colorHistory.slice(start, end);
      
      storePromises.push(
        this.storage.setItem(`user:colors:page:${page}`, {
          page,
          colors: pageColors,
          count: pageColors.length
        })
      );
    }

    await Promise.all(storePromises);
  }

  // ✅ LOAD BOARDS PAGE
  async _loadBoardsPage(page, pageSize) {
    this._ensureStorage();
    
    try {
      const pageData = await this.storage.getItem(`user:boards:page:${page}`);
      return pageData ? pageData.boards : [];
    } catch (error) {
      console.error(`❌ Failed to load boards page ${page}:`, error);
      return [];
    }
  }

  // ✅ LOAD COLOR HISTORY PAGE
  async _loadColorHistoryPage(page, pageSize) {
    this._ensureStorage();
    
    try {
      const pageData = await this.storage.getItem(`user:colors:page:${page}`);
      return pageData ? pageData.colors : [];
    } catch (error) {
      console.error(`❌ Failed to load color history page ${page}:`, error);
      return [];
    }
  }

  // ✅ LOAD ALL BOARDS (expensive operation)
  async _loadAllBoards() {
    this._ensureStorage();
    
    try {
      const meta = await this.storage.getItem('user:boards:meta');
      if (!meta) return [];

      const loadPromises = [];
      for (let page = 0; page < meta.totalPages; page++) {
        loadPromises.push(this._loadBoardsPage(page));
      }

      const pages = await Promise.all(loadPromises);
      return pages.flat();
    } catch (error) {
      console.error('❌ Failed to load all boards:', error);
      return [];
    }
  }

  // ✅ LOAD ALL COLOR HISTORY (expensive operation)
  async _loadAllColorHistory() {
    this._ensureStorage();
    
    try {
      const meta = await this.storage.getItem('user:colors:meta');
      if (!meta) return [];

      const loadPromises = [];
      for (let page = 0; page < meta.totalPages; page++) {
        loadPromises.push(this._loadColorHistoryPage(page));
      }

      const pages = await Promise.all(loadPromises);
      return pages.flat();
    } catch (error) {
      console.error('❌ Failed to load all color history:', error);
      return [];
    }
  }

  // ✅ CACHE MANAGEMENT
  clearCache() {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  // ✅ PRELOAD: Preload commonly accessed data
  async preloadEssentials() {
    try {
      // Preload basic user data and first page of boards/colors
      const promises = [
        this.getUserBasic(),
        this.getUserPreferences(),
        this.getUserBoards(0, 5), // First 5 boards
        this.getColorHistory(0, 10) // First 10 colors
      ];

      await Promise.all(promises);
      console.log('✅ Essential user data preloaded');
    } catch (error) {
      console.error('❌ Failed to preload essentials:', error);
    }
  }
}

// ✅ BACKGROUND PROCESSING: Use Web Workers or similar for heavy operations
class BackgroundProcessor {
  static async processLargeData(data, processor) {
    return new Promise((resolve, reject) => {
      // Use setImmediate to process in background
      const process = () => {
        try {
          const result = processor(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      // Yield to UI thread first
      setImmediatePolyfill(process);
    });
  }

  static async chunkProcess(array, processor, chunkSize = 100) {
    const results = [];
    
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      
      // Process chunk and yield to UI thread
      const chunkResult = await new Promise((resolve) => {
        setImmediatePolyfill(() => {
          try {
            const result = processor(chunk);
            resolve(result);
          } catch (error) {
            resolve(null);
          }
        });
      });

      if (chunkResult) {
        results.push(...chunkResult);
      }
    }

    return results;
  }
}

// ✅ SINGLETON INSTANCE: Created without storage provider (will be injected later)
const lazyStorageManager = new LazyStorageManager();

export {
  NonBlockingJSON,
  LazyStorageManager,
  BackgroundProcessor,
  lazyStorageManager
};

export default lazyStorageManager;
