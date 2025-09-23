// WriteRight Configuration
window.WriteRightConfig = {
  // API Configuration
  API: {
    // LanguageTool API Options
    LANGUAGETOOL: {
      // Free API (Rate limited: 20 requests/minute)
      FREE_ENDPOINT: 'https://api.languagetool.org/v2/check',
      
      // Premium API (Requires subscription)
      PREMIUM_ENDPOINT: 'https://api.languagetoolplus.com/v2/check',
      
      // Your API Key (Get from: https://languagetool.org/editor/settings/api)
      API_KEY: '', // Leave empty for free tier
      
      // Default language
      LANGUAGE: 'auto', // 'en-US', 'en-GB', 'de', 'fr', 'es', etc.
      
      // Request timeout
      TIMEOUT: 5000
    }
  },
  
  // Extension Settings
  SETTINGS: {
    // Real-time checking
    REALTIME_CHECK: true,
    
    // Debounce delay (milliseconds)
    DEBOUNCE_DELAY: 800,
    
    // Minimum text length to check
    MIN_TEXT_LENGTH: 10,
    
    // Maximum text length to check
    MAX_TEXT_LENGTH: 10000,
    
    // Auto-apply first suggestion
    AUTO_APPLY_FIRST: false,
    
    // Show floating indicator
    SHOW_INDICATOR: true,
    
    // Enable sound notifications
    SOUND_NOTIFICATIONS: false,
    
    // Enable browser notifications
    BROWSER_NOTIFICATIONS: false
  },
  
  // Visual Settings
  VISUAL: {
    // Error highlighting style
    ERROR_STYLE: 'underline', // 'underline', 'background', 'border'
    
    // Error color
    ERROR_COLOR: '#e74c3c',
    
    // Suggestion box theme
    THEME: 'light', // 'light', 'dark', 'auto'
    
    // Animation speed
    ANIMATION_SPEED: 'normal' // 'slow', 'normal', 'fast'
  },
  
  // Supported websites (for specific customizations)
  WEBSITES: {
    'web.whatsapp.com': {
      selectors: ['[contenteditable="true"]', '[data-tab="1"]'],
      checkDelay: 1000
    },
    'docs.google.com': {
      selectors: ['.docs-texteventtarget-iframe', '.kix-wordhtmlgenerator-word-node'],
      checkDelay: 1200
    },
    'mail.google.com': {
      selectors: ['[contenteditable="true"]', '.Am.Al.editable'],
      checkDelay: 800
    },
    'twitter.com': {
      selectors: ['[data-testid="tweetTextarea_0"]', '[contenteditable="true"]'],
      checkDelay: 600
    },
    'linkedin.com': {
      selectors: ['[contenteditable="true"]', '.ql-editor'],
      checkDelay: 800
    }
  }
};

// API Key Management
class APIKeyManager {
  static async getAPIKey() {
    try {
      const result = await chrome.storage.sync.get('languageToolApiKey');
      return result.languageToolApiKey || window.WriteRightConfig.API.LANGUAGETOOL.API_KEY;
    } catch (error) {
      console.warn('WriteRight: Could not access storage, using default API key');
      return window.WriteRightConfig.API.LANGUAGETOOL.API_KEY;
    }
  }
  
  static async setAPIKey(apiKey) {
    try {
      await chrome.storage.sync.set({ languageToolApiKey: apiKey });
      return true;
    } catch (error) {
      console.error('WriteRight: Could not save API key', error);
      return false;
    }
  }
  
  static async getEndpoint() {
    const apiKey = await this.getAPIKey();
    return apiKey ? 
      window.WriteRightConfig.API.LANGUAGETOOL.PREMIUM_ENDPOINT : 
      window.WriteRightConfig.API.LANGUAGETOOL.FREE_ENDPOINT;
  }
}

// Settings Management
class SettingsManager {
  static async getSettings() {
    try {
      const result = await chrome.storage.sync.get('writeRightSettings');
      return {
        ...window.WriteRightConfig.SETTINGS,
        ...result.writeRightSettings
      };
    } catch (error) {
      return window.WriteRightConfig.SETTINGS;
    }
  }
  
  static async updateSetting(key, value) {
    try {
      const settings = await this.getSettings();
      settings[key] = value;
      await chrome.storage.sync.set({ writeRightSettings: settings });
      return true;
    } catch (error) {
      console.error('WriteRight: Could not save setting', error);
      return false;
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WriteRightConfig, APIKeyManager, SettingsManager };
}

window.APIKeyManager = APIKeyManager;
window.SettingsManager = SettingsManager;