// WriteRight Popup Script - Main popup functionality with full working grammar check
console.log('WriteRight: Popup script loaded');

class WriteRightPopup {
  constructor() {
    this.currentResults = null;
    this.correctedText = '';
    this.isChecking = false;
    this.settings = {
      autoCheck: true,
      showNotifications: true,
      language: 'en-US'
    };
    
    this.init();
  }

  async init() {
    console.log('WriteRight: Initializing popup');
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    this.loadStats();
    
    // Add entrance animation
    document.body.classList.add('popup-loaded');
    console.log('WriteRight: Popup initialized successfully');
  }

  setupEventListeners() {
    console.log('WriteRight: Setting up event listeners');
    
    // Text input and checking
    const textInput = document.getElementById('textInput');
    const checkBtn = document.getElementById('checkBtn');
    const clearBtn = document.getElementById('clearBtn');
    const charCount = document.getElementById('charCount');

    if (textInput) {
      textInput.addEventListener('input', (e) => {
        this.updateCharCount(e.target.value);
        if (this.settings.autoCheck) {
          this.debounceAutoCheck(e.target.value);
        }
      });

      textInput.addEventListener('paste', (e) => {
        setTimeout(() => {
          this.updateCharCount(e.target.value);
          if (this.settings.autoCheck) {
            this.debounceAutoCheck(e.target.value);
          }
        }, 100);
      });
    }

    if (checkBtn) {
      checkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('WriteRight: Check button clicked');
        const text = textInput?.value || '';
        if (text.trim()) {
          this.checkGrammar(text);
        } else {
          this.showToast('Please enter some text to check', 'warning');
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearInput();
      });
    }

    // Results actions
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.copyToClipboard();
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.downloadText();
      });
    }

    // Settings
    const autoCheck = document.getElementById('autoCheck');
    const showNotifications = document.getElementById('showNotifications');
    const languageSelect = document.getElementById('languageSelect');

    if (autoCheck) {
      autoCheck.addEventListener('change', (e) => {
        this.updateSetting('autoCheck', e.target.checked);
      });
    }

    if (showNotifications) {
      showNotifications.addEventListener('change', (e) => {
        this.updateSetting('showNotifications', e.target.checked);
      });
    }

    if (languageSelect) {
      languageSelect.addEventListener('change', (e) => {
        this.updateSetting('language', e.target.value);
      });
    }

    // Action buttons
    const openWebsiteBtn = document.getElementById('openWebsiteBtn');
    const feedbackBtn = document.getElementById('feedbackBtn');

    if (openWebsiteBtn) {
      openWebsiteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://languagetool.org' });
      });
    }

    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openFeedback();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            if (textInput?.value.trim()) {
              this.checkGrammar(textInput.value);
            }
            break;
          case 'k':
            e.preventDefault();
            textInput?.focus();
            break;
        }
      }
    });

    console.log('WriteRight: Event listeners set up successfully');
  }

  updateCharCount(text) {
    const charCount = document.getElementById('charCount');
    if (!charCount) return;
    
    const count = text.length;
    charCount.textContent = `${count}/5000`;
    
    if (count > 4500) {
      charCount.classList.add('warning');
    } else {
      charCount.classList.remove('warning');
    }
  }

  debounceAutoCheck(text) {
    if (!this.settings.autoCheck || text.length < 10) return;
    
    clearTimeout(this.autoCheckTimer);
    this.autoCheckTimer = setTimeout(() => {
      this.checkGrammar(text, true);
    }, 2000);
  }

  async checkGrammar(text, isAutoCheck = false) {
    console.log('WriteRight: Starting grammar check', { textLength: text.length, isAutoCheck });
    
    if (!text.trim()) {
      this.showToast('Please enter some text to check', 'warning');
      return;
    }
    
    if (this.isChecking) {
      console.log('WriteRight: Already checking, skipping');
      return;
    }
    
    this.isChecking = true;
    this.setButtonLoading(true);
    
    try {
      // Use LanguageTool API directly since this is a demo
      const response = await this.callLanguageToolAPI(text);
      
      if (response && response.matches) {
        console.log('WriteRight: Grammar check successful', { matches: response.matches.length });
        this.currentResults = response;
        this.displayResults(response, text);
        this.updateStats('check');
        
        if (!isAutoCheck) {
          this.showToast('Grammar check completed!', 'success');
        }
      } else {
        throw new Error('Invalid response from grammar check service');
      }
    } catch (error) {
      console.error('WriteRight: Grammar check error:', error);
      this.showToast('Grammar check failed. Please try again.', 'error');
      
      // Show demo results for testing
      this.showDemoResults(text);
    } finally {
      this.isChecking = false;
      this.setButtonLoading(false);
    }
  }

  async callLanguageToolAPI(text) {
    const url = 'https://api.languagetool.org/v2/check';
    const params = new URLSearchParams({
      text: text,
      language: this.settings.language || 'en-US'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  }

  showDemoResults(text) {
    // Create demo results for testing
    const demoResults = {
      matches: [
        {
          message: "Possible spelling mistake found.",
          shortMessage: "Spelling mistake",
          offset: 0,
          length: 4,
          replacements: [
            { value: "This" },
            { value: "These" }
          ],
          rule: {
            id: "MORFOLOGIK_RULE_EN_US",
            category: { id: "TYPOS", name: "Possible Typo" }
          },
          context: {
            text: text.substring(0, Math.min(40, text.length)),
            offset: 0,
            length: Math.min(4, text.length)
          }
        }
      ]
    };
    
    this.currentResults = demoResults;
    this.displayResults(demoResults, text);
    this.showToast('Demo results shown (API unavailable)', 'info');
  }

  setButtonLoading(loading) {
    const checkBtn = document.getElementById('checkBtn');
    const btnText = checkBtn?.querySelector('.btn-text');
    const btnLoader = checkBtn?.querySelector('.btn-loader');
    
    if (!checkBtn) return;
    
    if (loading) {
      checkBtn.disabled = true;
      if (btnText) btnText.style.opacity = '0';
      if (btnLoader) btnLoader.style.display = 'block';
    } else {
      checkBtn.disabled = false;
      if (btnText) btnText.style.opacity = '1';
      if (btnLoader) btnLoader.style.display = 'none';
    }
  }

  displayResults(results, originalText) {
    console.log('WriteRight: Displaying results', { matchCount: results.matches?.length });
    
    const resultsSection = document.getElementById('resultsSection');
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (!resultsSection || !resultsSummary || !resultsContainer) {
      console.error('WriteRight: Results elements not found');
      return;
    }
    
    resultsSection.style.display = 'block';
    
    // Update summary
    const matchCount = results.matches?.length || 0;
    if (matchCount === 0) {
      resultsSummary.innerHTML = `
        <div class="summary-success">
          <span class="summary-icon">✨</span>
          <span class="summary-text">Perfect! No issues found.</span>
        </div>
      `;
      resultsContainer.innerHTML = `
        <div class="no-issues">
          <div class="no-issues-icon">🎉</div>
          <h3>Excellent Writing!</h3>
          <p>Your text looks great with no grammar or spelling issues.</p>
        </div>
      `;
      return;
    }
    
    resultsSummary.innerHTML = `
      <div class="summary-issues">
        <span class="summary-icon">⚠️</span>
        <span class="summary-text">${matchCount} issue${matchCount !== 1 ? 's' : ''} found</span>
      </div>
    `;
    
    // Generate corrected text
    this.correctedText = this.applySuggestions(originalText, results.matches);
    
    // Display issues
    resultsContainer.innerHTML = '';
    results.matches.forEach((match, index) => {
      const issueElement = this.createIssueElement(match, index, originalText);
      resultsContainer.appendChild(issueElement);
    });
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  createIssueElement(match, index, originalText) {
    const issue = document.createElement('div');
    issue.className = 'issue-item';
    issue.dataset.index = index;
    
    const severity = this.getSeverity(match);
    const category = this.getCategory(match);
    
    issue.innerHTML = `
      <div class="issue-header">
        <div class="issue-info">
          <span class="issue-severity ${severity}">${this.getSeverityIcon(severity)}</span>
          <span class="issue-category">${category}</span>
        </div>
        <div class="issue-position">Position ${match.offset}</div>
      </div>
      
      <div class="issue-content">
        <div class="issue-message">${match.message}</div>
        
        <div class="issue-context">
          ${this.createContextHTML(match, originalText)}
        </div>
        
        ${this.createSuggestionsHTML(match, index)}
      </div>
    `;
    
    // Add click animation
    issue.addEventListener('click', () => {
      issue.classList.add('issue-clicked');
      setTimeout(() => issue.classList.remove('issue-clicked'), 200);
    });
    
    return issue;
  }

  createContextHTML(match, originalText) {
    const start = Math.max(0, match.offset - 20);
    const end = Math.min(originalText.length, match.offset + match.length + 20);
    
    const beforeText = originalText.substring(start, match.offset);
    const errorText = originalText.substring(match.offset, match.offset + match.length);
    const afterText = originalText.substring(match.offset + match.length, end);
    
    return `
      <span class="context-before">${beforeText}</span>
      <span class="context-error">${errorText}</span>
      <span class="context-after">${afterText}</span>
    `;
  }

  createSuggestionsHTML(match, index) {
    if (!match.replacements || match.replacements.length === 0) {
      return '<div class="no-suggestions">No suggestions available</div>';
    }
    
    const suggestions = match.replacements.slice(0, 3).map((replacement, rIndex) => `
      <button class="suggestion-btn" data-match-index="${index}" data-replacement="${replacement.value}">
        <span class="suggestion-text">${replacement.value}</span>
        <span class="suggestion-action">Apply</span>
      </button>
    `).join('');
    
    return `
      <div class="suggestions-container">
        <div class="suggestions-label">Suggestions:</div>
        <div class="suggestions-list">${suggestions}</div>
      </div>
    `;
  }

  applySuggestions(text, matches) {
    let correctedText = text;
    let offset = 0;
    
    // Sort matches by offset to apply corrections in order
    const sortedMatches = [...matches].sort((a, b) => a.offset - b.offset);
    
    sortedMatches.forEach(match => {
      if (match.replacements && match.replacements.length > 0) {
        const replacement = match.replacements[0].value;
        const start = match.offset + offset;
        const end = start + match.length;
        
        correctedText = correctedText.substring(0, start) + 
                       replacement + 
                       correctedText.substring(end);
        
        offset += replacement.length - match.length;
      }
    });
    
    return correctedText;
  }

  getSeverity(match) {
    const ruleId = match.rule?.id || '';
    const category = match.rule?.category?.id || '';
    
    if (ruleId.includes('MORFOLOGIK') || category.includes('TYPOS')) {
      return 'error';
    } else if (category.includes('GRAMMAR')) {
      return 'error';
    } else if (category.includes('STYLE')) {
      return 'warning';
    }
    
    return 'info';
  }

  getCategory(match) {
    const category = match.rule?.category?.name || 'Other';
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }

  getSeverityIcon(severity) {
    const icons = {
      error: '🔴',
      warning: '🟡',
      info: '🔵'
    };
    return icons[severity] || '⚪';
  }

  async copyToClipboard() {
    if (!this.correctedText) {
      this.showToast('No corrected text available', 'warning');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(this.correctedText);
      this.showToast('Corrected text copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = this.correctedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      this.showToast('Corrected text copied to clipboard!', 'success');
    }
  }

  downloadText() {
    if (!this.correctedText) {
      this.showToast('No corrected text available', 'warning');
      return;
    }
    
    const blob = new Blob([this.correctedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `corrected-text-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('Text downloaded successfully!', 'success');
  }

  clearInput() {
    const textInput = document.getElementById('textInput');
    const resultsSection = document.getElementById('resultsSection');
    
    if (textInput) {
      textInput.value = '';
      textInput.focus();
    }
    
    if (resultsSection) {
      resultsSection.style.display = 'none';
    }
    
    this.updateCharCount('');
    this.currentResults = null;
    this.correctedText = '';
    
    // Clear animation
    if (textInput) {
      textInput.style.transform = 'scale(1.02)';
      setTimeout(() => {
        textInput.style.transform = 'scale(1)';
      }, 150);
    }
  }

  showToast(message, type = 'info') {
    console.log(`WriteRight Toast: ${message} (${type})`);
    
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide toast
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['writeRightSettings']);
      if (result.writeRightSettings) {
        this.settings = { ...this.settings, ...result.writeRightSettings };
      }
      this.applySettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use default settings
      this.applySettings();
    }
  }

  applySettings() {
    const autoCheck = document.getElementById('autoCheck');
    const showNotifications = document.getElementById('showNotifications');
    const languageSelect = document.getElementById('languageSelect');
    
    if (autoCheck) autoCheck.checked = this.settings.autoCheck;
    if (showNotifications) showNotifications.checked = this.settings.showNotifications;
    if (languageSelect) languageSelect.value = this.settings.language;
  }

  async updateSetting(key, value) {
    this.settings[key] = value;
    
    try {
      await chrome.storage.sync.set({ writeRightSettings: this.settings });
      this.showToast(`Setting updated successfully!`, 'success');
    } catch (error) {
      console.error('Failed to save setting:', error);
      this.showToast('Failed to save setting', 'error');
    }
  }

  updateUI() {
    // Update status indicator
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
      statusIndicator.classList.add('active');
    }
  }

  async loadStats() {
    try {
      const stats = await chrome.storage.local.get(['checksToday', 'fixesApplied', 'lastCheckDate']);
      const today = new Date().toDateString();
      
      if (stats.lastCheckDate !== today) {
        await chrome.storage.local.set({ checksToday: 0, lastCheckDate: today });
        this.updateStatDisplay('checksToday', 0);
      } else {
        this.updateStatDisplay('checksToday', stats.checksToday || 0);
      }
      
      this.updateStatDisplay('fixesApplied', stats.fixesApplied || 0);
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Set default values
      this.updateStatDisplay('checksToday', 0);
      this.updateStatDisplay('fixesApplied', 0);
    }
  }

  updateStatDisplay(statId, value) {
    const element = document.getElementById(statId);
    if (element) {
      element.textContent = value.toString();
    }
  }

  async updateStats(type) {
    try {
      const stats = await chrome.storage.local.get(['checksToday', 'fixesApplied']);
      
      if (type === 'check') {
        const newChecks = (stats.checksToday || 0) + 1;
        await chrome.storage.local.set({ checksToday: newChecks });
        this.updateStatDisplay('checksToday', newChecks);
      } else if (type === 'fix') {
        const newFixes = (stats.fixesApplied || 0) + 1;
        await chrome.storage.local.set({ fixesApplied: newFixes });
        this.updateStatDisplay('fixesApplied', newFixes);
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  openFeedback() {
    const email = 'feedback@writeright.com';
    const subject = 'WriteRight Feedback';
    const body = 'Hi WriteRight Team,\n\nI would like to share the following feedback:\n\n';
    
    chrome.tabs.create({
      url: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    });
  }
}

// Initialize popup when DOM is ready
let popupInstance = null;

function initializePopup() {
  if (!popupInstance) {
    console.log('WriteRight: Creating popup instance');
    popupInstance = new WriteRightPopup();
  }
}

// Handle different loading states
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

// Add entrance animation
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 100);
});