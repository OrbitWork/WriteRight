// WriteRight Background Script - Enhanced Service Worker for Chrome Extension
console.log('WriteRight: Background script loaded v2.0');

// Configuration constants
const CONFIG = {
  API_ENDPOINTS: {
    LANGUAGETOOL: 'https://api.languagetool.org/v2/check',
    GRAMMAR_API: 'https://api.sapling.ai/api/v1/edits'
  },
  DEFAULT_SETTINGS: {
    enabled: true,
    grammarCheck: true,
    spellCheck: true,
    autoCorrect: false,
    language: 'en-US',
    checkFrequency: 'delayed',
    errorColor: '#ff4444',
    suggestionColor: '#4444ff',
    showTooltip: true,
    confidenceThreshold: 75,
    excludedSites: '',
    checkPasswords: false,
    showNotifications: true,
    apiProvider: 'languagetool',
    maxTextLength: 10000
  },
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  RATE_LIMIT: {
    requestsPerMinute: 20,
    windowSize: 60 * 1000
  }
};

// Cache and rate limiting
const grammarCache = new Map();
const requestLog = [];

// Extension installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('WriteRight installed:', details.reason);
  
  try {
    switch (details.reason) {
      case 'install':
        await handleInstall();
        break;
      case 'update':
        await handleUpdate(details.previousVersion);
        break;
      default:
        console.log('WriteRight: Startup reason:', details.reason);
    }
  } catch (error) {
    console.error('WriteRight: Installation error:', error);
  }
});

// Installation handler
async function handleInstall() {
  // Set default settings
  await chrome.storage.sync.set(CONFIG.DEFAULT_SETTINGS);
  
  // Initialize extension data
  await chrome.storage.local.set({
    installDate: Date.now(),
    version: chrome.runtime.getManifest().version,
    stats: {
      checksPerformed: 0,
      errorsFound: 0,
      suggestionsAccepted: 0
    }
  });
  
  // Create context menu
  await createContextMenu();
  
  console.log('WriteRight: Installation complete');
}

// Update handler
async function handleUpdate(previousVersion) {
  console.log(`WriteRight: Updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
  
  // Migrate settings if needed
  await migrateSettings(previousVersion);
  
  // Update context menu
  await createContextMenu();
}

// Context menu creation
async function createContextMenu() {
  try {
    await chrome.contextMenus.removeAll();
    
    chrome.contextMenus.create({
      id: 'writeright-check',
      title: 'Check with WriteRight',
      contexts: ['selection', 'editable']
    });
    
    chrome.contextMenus.create({
      id: 'writeright-toggle',
      title: 'Toggle WriteRight',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'writeright-settings',
      title: 'WriteRight Settings',
      contexts: ['page']
    });
  } catch (error) {
    console.error('WriteRight: Context menu creation failed:', error);
  }
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    switch (info.menuItemId) {
      case 'writeright-check':
        if (info.selectionText) {
          await handleContextGrammarCheck(info.selectionText, tab.id);
        }
        break;
      case 'writeright-toggle':
        await toggleExtension(tab.id);
        break;
      case 'writeright-settings':
        await chrome.runtime.openOptionsPage();
        break;
    }
  } catch (error) {
    console.error('WriteRight: Context menu error:', error);
  }
});

// Main message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('WriteRight: Message received:', request.action);
  
  // Handle async responses
  (async () => {
    try {
      let response;
      
      switch (request.action) {
        case 'checkGrammar':
          response = await handleGrammarCheck(request.text, request.options);
          break;
          
        case 'getSettings':
          response = await handleGetSettings();
          break;
          
        case 'saveSettings':
          response = await handleSaveSettings(request.settings);
          break;
          
        case 'updateStats':
          response = await handleUpdateStats(request.stats);
          break;
          
        case 'getStats':
          response = await handleGetStats();
          break;
          
        case 'clearCache':
          response = await handleClearCache();
          break;
          
        case 'reportError':
          response = await handleErrorReport(request.error);
          break;
          
        case 'checkHealth':
          response = await handleHealthCheck();
          break;
          
        default:
          response = { success: false, error: 'Unknown action: ' + request.action };
      }
      
      sendResponse(response);
    } catch (error) {
      console.error('WriteRight: Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});

// Enhanced grammar checking with caching and rate limiting
async function handleGrammarCheck(text, options = {}) {
  try {
    // Input validation
    if (!text || typeof text !== 'string') {
      return { success: false, error: 'Invalid text input' };
    }
    
    if (text.length > CONFIG.maxTextLength) {
      return { success: false, error: 'Text too long' };
    }
    
    // Check rate limiting
    if (!checkRateLimit()) {
      return { success: false, error: 'Rate limit exceeded' };
    }
    
    // Check cache first
    const cacheKey = generateCacheKey(text, options);
    const cached = grammarCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
      console.log('WriteRight: Using cached result');
      return { success: true, data: cached.data, cached: true };
    }
    
    // Get current settings
    const settings = await chrome.storage.sync.get(CONFIG.DEFAULT_SETTINGS);
    
    // Perform grammar check
    const result = await performGrammarCheck(text, { ...settings, ...options });
    
    // Cache the result
    grammarCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    // Update stats
    await updateStats({ checksPerformed: 1, errorsFound: result.matches?.length || 0 });
    
    return { success: true, data: result };
    
  } catch (error) {
    console.error('WriteRight: Grammar check failed:', error);
    return { success: false, error: error.message };
  }
}

// Actual grammar check implementation
async function performGrammarCheck(text, options) {
  const { apiProvider, language } = options;
  
  if (apiProvider === 'languagetool') {
    return await checkWithLanguageTool(text, language);
  } else {
    // Fallback to basic check or other providers
    return await checkWithBasicAlgorithm(text);
  }
}

// LanguageTool API integration
async function checkWithLanguageTool(text, language = 'en-US') {
  const response = await fetch(CONFIG.API_ENDPOINTS.LANGUAGETOOL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      text: text,
      language: language,
      enabledOnly: 'false',
      level: 'picky'
    })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  return await response.json();
}

// Basic algorithm fallback
async function checkWithBasicAlgorithm(text) {
  // Simple regex-based checks for common errors
  const matches = [];
  
  // Common typos
  const typos = {
    'teh': 'the',
    'recieve': 'receive',
    'seperate': 'separate',
    'occured': 'occurred',
    'definately': 'definitely'
  };
  
  Object.entries(typos).forEach(([wrong, correct]) => {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        offset: match.index,
        length: match[0].length,
        message: `Possible typo: "${match[0]}" → "${correct}"`,
        shortMessage: 'Typo',
        replacements: [{ value: correct }],
        rule: { id: 'BASIC_TYPO', category: { id: 'TYPOS' } }
      });
    }
  });
  
  return { matches };
}

// Context menu grammar check
async function handleContextGrammarCheck(text, tabId) {
  const result = await handleGrammarCheck(text);
  
  // Send result to content script
  chrome.tabs.sendMessage(tabId, {
    action: 'contextCheckResult',
    result: result
  }).catch(() => {
    // Tab might not have content script
    console.log('WriteRight: Could not send context result to tab');
  });
}

// Settings management
async function handleGetSettings() {
  try {
    const settings = await chrome.storage.sync.get(CONFIG.DEFAULT_SETTINGS);
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleSaveSettings(newSettings) {
  try {
    await chrome.storage.sync.set(newSettings);
    
    // Notify all tabs about settings change
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'settingsUpdated',
        settings: newSettings
      }).catch(() => {}); // Ignore errors for inactive tabs
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Statistics management
async function handleUpdateStats(newStats) {
  try {
    const { stats } = await chrome.storage.local.get({ stats: { checksPerformed: 0, errorsFound: 0, suggestionsAccepted: 0 } });
    
    const updatedStats = {
      checksPerformed: stats.checksPerformed + (newStats.checksPerformed || 0),
      errorsFound: stats.errorsFound + (newStats.errorsFound || 0),
      suggestionsAccepted: stats.suggestionsAccepted + (newStats.suggestionsAccepted || 0)
    };
    
    await chrome.storage.local.set({ stats: updatedStats });
    return { success: true, stats: updatedStats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetStats() {
  try {
    const { stats } = await chrome.storage.local.get({ stats: { checksPerformed: 0, errorsFound: 0, suggestionsAccepted: 0 } });
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Utility functions
function generateCacheKey(text, options) {
  return `${text.length}_${JSON.stringify(options)}_${text.slice(0, 50)}`;
}

function checkRateLimit() {
  const now = Date.now();
  
  // Remove old requests
  while (requestLog.length > 0 && now - requestLog[0] > CONFIG.RATE_LIMIT.windowSize) {
    requestLog.shift();
  }
  
  // Check if we can make a new request
  if (requestLog.length >= CONFIG.RATE_LIMIT.requestsPerMinute) {
    return false;
  }
  
  // Log this request
  requestLog.push(now);
  return true;
}

async function updateStats(stats) {
  try {
    await handleUpdateStats(stats);
  } catch (error) {
    console.error('WriteRight: Stats update failed:', error);
  }
}

async function handleClearCache() {
  try {
    grammarCache.clear();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleErrorReport(error) {
  try {
    console.error('WriteRight: Reported error:', error);
    // Could send to analytics service here
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleHealthCheck() {
  try {
    const health = {
      cacheSize: grammarCache.size,
      requestsInWindow: requestLog.length,
      uptime: Date.now() - (await chrome.storage.local.get('installDate')).installDate,
      version: chrome.runtime.getManifest().version
    };
    return { success: true, health };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function toggleExtension(tabId) {
  try {
    const { enabled } = await chrome.storage.sync.get({ enabled: true });
    const newState = !enabled;
    
    await chrome.storage.sync.set({ enabled: newState });
    
    // Update icon
    chrome.action.setIcon({
      path: newState ? 'assets/icons/icon16.png' : 'assets/icons/icon16-disabled.png'
    });
    
    // Notify tab
    chrome.tabs.sendMessage(tabId, {
      action: 'extensionToggled',
      enabled: newState
    }).catch(() => {});
    
    return { success: true, enabled: newState };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function migrateSettings(previousVersion) {
  try {
    // Example migration logic
    if (previousVersion && previousVersion < '2.0.0') {
      const oldSettings = await chrome.storage.sync.get();
      const newSettings = { ...CONFIG.DEFAULT_SETTINGS, ...oldSettings };
      await chrome.storage.sync.set(newSettings);
      console.log('WriteRight: Settings migrated from', previousVersion);
    }
  } catch (error) {
    console.error('WriteRight: Migration failed:', error);
  }
}

// Service worker lifecycle management
chrome.runtime.onConnect.addListener((port) => {
  console.log('WriteRight: Port connected:', port.name);
  
  port.onDisconnect.addListener(() => {
    console.log('WriteRight: Port disconnected');
  });
});

// Keep service worker alive with periodic tasks
setInterval(() => {
  // Clean up old cache entries
  const now = Date.now();
  for (const [key, value] of grammarCache.entries()) {
    if (now - value.timestamp > CONFIG.CACHE_DURATION) {
      grammarCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('WriteRight: Extension started');
});

// Handle tab updates for dynamic content script injection
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const { enabled } = await chrome.storage.sync.get({ enabled: true });
      if (enabled && tab.url.startsWith('http')) {
        // Ensure content script is injected
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).catch(() => {
          // Script might already be injected
        });
      }
    } catch (error) {
      console.error('WriteRight: Tab update error:', error);
    }
  }
});

console.log('WriteRight: Background script initialization complete');