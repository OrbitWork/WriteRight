// WriteRight Enhanced Content Script - Clickable suggestions with real-time checking
console.log('WriteRight Enhanced: Content script loaded');

// Prevent duplicate class declarations and multiple initializations
if (window.WriteRightEnhancedLoaded) {
  console.log('WriteRight: Already loaded, skipping initialization');
} else {
  window.WriteRightEnhancedLoaded = true;

class WriteRightEnhanced {
  constructor() {
    this.isActive = true;
    this.checkedElements = new WeakSet();
    this.debounceTimers = new WeakMap();
    this.activeOverlays = new WeakMap();
    this.grammarErrors = new WeakMap();
    this.lastCheckedTexts = new WeakMap();
    this.activeSuggestionBox = null;
    
    // Store global reference for keyboard shortcuts (only if not already set)
    if (!window.writeRightInstance) {
      window.writeRightInstance = this;
    }
    
    this.init();
  }

  init() {
    chrome.storage.sync.get(['autoCheck', 'apiKey'], (res) => {
      if (res.autoCheck !== false) {
        this.createFloatingIndicator();
      }
    });
    
    this.injectStyles();
    this.observeTextInputs();
    this.setupEventListeners();
    this.startPeriodicScan();
    this.setupGlobalClickHandler();
  }

  injectStyles() {
    if (document.getElementById('writeright-enhanced-styles')) return;

    const styles = `
      /* WriteRight Enhanced Styles */
      .writeright-enhanced {
        position: relative !important;
        transition: border-color 0.2s ease !important;
      }
      
      .writeright-enhanced:focus {
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2) !important;
        border-color: #667eea !important;
      }

      /* Grammar Error Underline */
      .writeright-error-underline {
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 2px,
          #ff4444 2px,
          #ff4444 4px
        );
        background-size: 8px 2px;
        background-repeat: repeat-x;
        background-position: 0 calc(100% - 2px);
        cursor: pointer;
        position: relative;
        transition: background-image 0.2s ease;
      }

      .writeright-error-underline:hover {
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 2px,
          #ff2222 2px,
          #ff2222 4px
        );
      }

      /* Suggestion Box */
      .writeright-suggestion-box {
        position: absolute;
        background: white;
        border: 1px solid #e1e8ed;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.1);
        z-index: 999999;
        max-width: 280px;
        min-width: 200px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        backdrop-filter: blur(10px);
      }

      .writeright-suggestion-box.show {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      .writeright-suggestion-header {
        padding: 12px 16px 8px;
        border-bottom: 1px solid #f0f3f4;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 12px 12px 0 0;
      }

      .writeright-error-type {
        font-size: 11px;
        color: #e74c3c;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }

      .writeright-error-message {
        font-size: 13px;
        color: #2c3e50;
        line-height: 1.4;
        margin: 0;
      }

      .writeright-suggestions {
        padding: 4px 0;
        max-height: 200px;
        overflow-y: auto;
      }

      .writeright-suggestion-item {
        padding: 10px 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
        color: #2c3e50;
        border-left: 3px solid transparent;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .writeright-suggestion-item:hover {
        background-color: #f8f9fa;
        border-left-color: #667eea;
        transform: translateX(2px);
      }

      .writeright-suggestion-item:active {
        background-color: #e9ecef;
        transform: translateX(1px);
      }

      .writeright-suggestion-text {
        font-weight: 500;
        color: #27ae60;
        flex: 1;
      }

      .writeright-suggestion-shortcut {
        font-size: 11px;
        color: #7f8c8d;
        background: #ecf0f1;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 8px;
      }

      .writeright-ignore-btn {
        padding: 8px 16px;
        border-top: 1px solid #f0f3f4;
        text-align: center;
        font-size: 12px;
        color: #7f8c8d;
        cursor: pointer;
        transition: all 0.2s ease;
        border-radius: 0 0 12px 12px;
      }

      .writeright-ignore-btn:hover {
        background-color: #f1f2f6;
        color: #2c3e50;
      }

      /* Floating Indicator */
      #writeright-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 16px;
        border-radius: 25px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 999999;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        backdrop-filter: blur(10px);
      }
      
      #writeright-indicator.show {
        opacity: 1;
        transform: translateX(0);
      }
      
      .wr-indicator-content {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .wr-logo {
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      /* Text Overlay for Rich Text Editors */
      .writeright-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 1;
        font: inherit;
        padding: inherit;
        margin: inherit;
        border: inherit;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
        color: transparent;
        background: transparent;
      }

      .writeright-overlay-highlight {
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 2px,
          #ff4444 2px,
          #ff4444 4px
        );
        background-size: 8px 2px;
        background-repeat: repeat-x;
        background-position: 0 calc(100% - 2px);
        cursor: pointer;
        position: relative;
        pointer-events: all;
      }

      .writeright-overlay-highlight:hover {
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 2px,
          #ff2222 2px,
          #ff2222 4px
        );
      }

      /* Mobile responsiveness */
      @media (max-width: 480px) {
        .writeright-suggestion-box {
          max-width: calc(100vw - 40px);
          min-width: 250px;
          left: 20px !important;
          right: 20px !important;
          width: auto !important;
        }
        
        #writeright-indicator {
          right: 10px;
          top: 10px;
          font-size: 11px;
          padding: 6px 12px;
        }
      }

      /* Animation for error removal */
      .writeright-error-removing {
        animation: fadeOutError 0.3s ease-out forwards;
      }

      @keyframes fadeOutError {
        0% { 
          background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, #ff4444 2px, #ff4444 4px);
          opacity: 1;
        }
        100% { 
          background-image: none;
          opacity: 0;
        }
      }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'writeright-enhanced-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  createFloatingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'writeright-indicator';
    indicator.innerHTML = `
      <div class="wr-indicator-content">
        <span class="wr-logo">✍️</span>
        <span class="wr-text">WriteRight Active</span>
      </div>
    `;
    
    document.body.appendChild(indicator);
    
    // Show indicator after page load
    setTimeout(() => indicator.classList.add('show'), 1000);
    
    // Hide indicator after 6 seconds
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateX(100px)';
      setTimeout(() => indicator.remove(), 300);
    }, 6000);

    // Click to toggle extension
    indicator.addEventListener('click', () => {
      this.isActive = !this.isActive;
      this.updateIndicatorState(indicator);
    });
  }

  updateIndicatorState(indicator) {
    const textEl = indicator.querySelector('.wr-text');
    textEl.textContent = this.isActive ? 'WriteRight Active' : 'WriteRight Paused';
    indicator.style.background = this.isActive 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)';
    
    if (!this.isActive) {
      this.clearAllErrors();
    }
  }

  observeTextInputs() {
    // Initial scan
    this.scanForTextInputs();

    // Only set up mutation observer if not already done
    if (!this.mutationObserver) {
      this.mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.scanForTextInputs(node);
            }
          });
        });
      });

      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  scanForTextInputs(container = document) {
    const textInputs = container.querySelectorAll(`
      input[type="text"],
      input[type="email"], 
      input[type="search"],
      input[type="url"],
      textarea,
      [contenteditable="true"],
      [contenteditable=""],
      .ql-editor,
      .ace_text-input,
      .CodeMirror textarea,
      .notranslate,
      [role="textbox"],
      .DraftEditor-root,
      .public-DraftEditor-content
    `);

    textInputs.forEach(element => {
      if (!this.checkedElements.has(element) && this.isValidTextInput(element)) {
        this.attachToTextInput(element);
        this.checkedElements.add(element);
      }
    });
  }

  isValidTextInput(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 50 && 
           rect.height > 20 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           !element.disabled &&
           !element.readOnly;
  }

  attachToTextInput(element) {
    element.classList.add('writeright-enhanced');
    
    // Create overlay for rich text editors
    if (element.contentEditable === 'true' || element.classList.contains('ql-editor')) {
      this.createTextOverlay(element);
    }
    
    this.setupElementListeners(element);
  }

  createTextOverlay(element) {
    const overlay = document.createElement('div');
    overlay.className = 'writeright-overlay';
    
    // Position overlay relative to element
    element.style.position = element.style.position || 'relative';
    element.parentNode.insertBefore(overlay, element.nextSibling);
    this.activeOverlays.set(element, overlay);
  }

  setupElementListeners(element) {
    const handleInput = () => {
      if (!this.isActive) return;

      const text = this.getElementText(element);
      const lastText = this.lastCheckedTexts.get(element);
      
      // Clear errors immediately if text is empty or very short
      if (text.length < 3) {
        this.clearErrors(element);
        this.lastCheckedTexts.set(element, text);
        return;
      }

      // Skip if text hasn't changed
      if (text === lastText) return;
      
      this.lastCheckedTexts.set(element, text);
      
      // Clear existing timer
      if (this.debounceTimers.has(element)) {
        clearTimeout(this.debounceTimers.get(element));
      }
      
      // Set new timer with real-time feel
      const timer = setTimeout(async () => {
        try {
          const result = await window.checkGrammar(text);
          this.handleGrammarResult(element, result, text);
        } catch (error) {
          console.log('WriteRight: Grammar check failed', error);
        }
      }, 400); // Reduced to 400ms for real-time feel
      
      this.debounceTimers.set(element, timer);
    };

    // Real-time input handling
    ['input', 'keyup', 'paste'].forEach(eventType => {
      element.addEventListener(eventType, handleInput, { passive: true });
    });

    // Handle paste with slight delay
    element.addEventListener('paste', () => {
      setTimeout(handleInput, 50);
    });

    // Clear suggestions on blur
    element.addEventListener('blur', () => {
      setTimeout(() => this.hideSuggestionBox(), 150);
    });
  }

  getElementText(element) {
    if (element.contentEditable === 'true') {
      return element.textContent || element.innerText || '';
    }
    return element.value || '';
  }

  handleGrammarResult(element, result, originalText) {
    // Always clear previous errors first
    this.clearErrors(element);
    
    if (!result || !result.matches || result.matches.length === 0) {
      return;
    }

    // Filter out low-confidence matches
    const filteredMatches = result.matches.filter(match => {
      // Only show matches with replacements
      return match.replacements && match.replacements.length > 0;
    });

    if (filteredMatches.length === 0) {
      return;
    }

    // Store errors for this element
    this.grammarErrors.set(element, { matches: filteredMatches, text: originalText });

    // Apply visual indicators
    this.applyErrorHighlights(element, filteredMatches, originalText);
  }

  clearErrors(element) {
    // Remove error classes with animation
    const existingErrors = element.querySelectorAll('.writeright-error-underline');
    existingErrors.forEach(el => {
      el.classList.add('writeright-error-removing');
      setTimeout(() => {
        el.classList.remove('writeright-error-underline', 'writeright-error-removing');
        el.style.backgroundImage = '';
      }, 300);
    });

    // Clear overlay highlights
    const overlay = this.activeOverlays.get(element);
    if (overlay) {
      overlay.innerHTML = '';
    }

    // Clear stored errors
    this.grammarErrors.delete(element);

    // Clear input field highlights
    if (element.style) {
      element.style.backgroundImage = '';
      element.removeAttribute('title');
    }
  }

  clearAllErrors() {
    document.querySelectorAll('.writeright-enhanced').forEach(element => {
      this.clearErrors(element);
    });
    this.hideSuggestionBox();
  }

  applyErrorHighlights(element, matches, text) {
    if (element.contentEditable === 'true') {
      this.applyRichTextHighlights(element, matches, text);
    } else {
      this.applyInputHighlights(element, matches);
    }
  }

  applyRichTextHighlights(element, matches, text) {
    const overlay = this.activeOverlays.get(element);
    if (!overlay) return;

    let highlightedHTML = '';
    let lastOffset = 0;

    // Sort matches by offset
    const sortedMatches = matches.slice().sort((a, b) => a.offset - b.offset);

    sortedMatches.forEach((match, index) => {
      // Add text before this match
      highlightedHTML += this.escapeHtml(text.slice(lastOffset, match.offset));
      
      // Add highlighted error
      const errorText = text.slice(match.offset, match.offset + match.length);
      highlightedHTML += `<span class="writeright-overlay-highlight" data-error-index="${index}" title="${match.message}">${this.escapeHtml(errorText)}</span>`;
      
      lastOffset = match.offset + match.length;
    });

    // Add remaining text
    highlightedHTML += this.escapeHtml(text.slice(lastOffset));

    overlay.innerHTML = highlightedHTML;

    // Add click handlers for suggestions
    overlay.querySelectorAll('.writeright-overlay-highlight').forEach((span, index) => {
      span.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showSuggestionBox(element, matches[index], span);
      });
    });
  }

  applyInputHighlights(element, matches) {
    // For input/textarea, show visual indicator
    element.style.backgroundImage = 'linear-gradient(to right, rgba(255, 68, 68, 0.1) 0%, rgba(255, 68, 68, 0.1) 100%)';
    element.title = `${matches.length} grammar issue(s) found. Click to see suggestions.`;
    
    // Add click handler for first suggestion
    const clickHandler = (e) => {
      if (matches.length > 0) {
        this.showSuggestionBox(element, matches[0], element);
      }
      element.removeEventListener('click', clickHandler);
    };
    element.addEventListener('click', clickHandler);
  }

  showSuggestionBox(element, match, targetElement) {
    // Hide existing suggestion box
    this.hideSuggestionBox();

    const suggestionBox = document.createElement('div');
    suggestionBox.className = 'writeright-suggestion-box';
    
    const suggestions = match.replacements.slice(0, 3);
    
    suggestionBox.innerHTML = `
      <div class="writeright-suggestion-header">
        <div class="writeright-error-type">${match.rule?.category?.name || 'Grammar'}</div>
        <div class="writeright-error-message">${match.message}</div>
      </div>
      <div class="writeright-suggestions">
        ${suggestions.map((replacement, index) => `
          <div class="writeright-suggestion-item" data-suggestion="${replacement.value}" data-index="${index}">
            <span class="writeright-suggestion-text">${replacement.value}</span>
            ${index === 0 ? '<span class="writeright-suggestion-shortcut">Enter</span>' : ''}
          </div>
        `).join('')}
      </div>
      <div class="writeright-ignore-btn">Ignore suggestion</div>
    `;

    // Position suggestion box
    this.positionSuggestionBox(suggestionBox, targetElement);

    document.body.appendChild(suggestionBox);
    this.activeSuggestionBox = suggestionBox;

    // Show with animation
    setTimeout(() => suggestionBox.classList.add('show'), 50);

    // Setup click handlers
    suggestionBox.querySelectorAll('.writeright-suggestion-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const suggestion = item.dataset.suggestion;
        this.applySuggestion(element, match, suggestion);
        this.hideSuggestionBox();
      });
    });

    suggestionBox.querySelector('.writeright-ignore-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.ignoreSuggestion(element, match);
      this.hideSuggestionBox();
    });

    // Keyboard navigation
    document.addEventListener('keydown', this.handleSuggestionKeyboard.bind(this, suggestions, element, match));
  }

  positionSuggestionBox(box, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    let left = rect.left + scrollLeft;
    let top = rect.bottom + scrollTop + 5;
    
    // Adjust for mobile/small screens
    if (window.innerWidth <= 480) {
      left = 20;
      box.style.right = '20px';
      box.style.width = 'auto';
    } else {
      // Adjust if box would go off-screen
      const boxWidth = 280;
      if (left + boxWidth > window.innerWidth) {
        left = window.innerWidth - boxWidth - 20;
      }
      
      // Adjust if box would go below viewport
      if (top + 150 > window.innerHeight + scrollTop) {
        top = rect.top + scrollTop - 150;
      }
    }
    
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  handleSuggestionKeyboard(suggestions, element, match, e) {
    if (!this.activeSuggestionBox) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      this.applySuggestion(element, match, suggestions[0].value);
      this.hideSuggestionBox();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.hideSuggestionBox();
    }
  }

  applySuggestion(element, match, suggestion) {
    if (element.contentEditable === 'true') {
      this.applySuggestionToContentEditable(element, match, suggestion);
    } else {
      this.applySuggestionToInput(element, match, suggestion);
    }
    
    // Clear this specific error
    this.removeSpecificError(element, match);
  }

  applySuggestionToContentEditable(element, match, suggestion) {
    const text = element.textContent;
    const beforeText = text.substring(0, match.offset);
    const afterText = text.substring(match.offset + match.length);
    const newText = beforeText + suggestion + afterText;
    
    element.textContent = newText;
    
    // Trigger input event for framework compatibility
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  applySuggestionToInput(element, match, suggestion) {
    const text = element.value;
    const beforeText = text.substring(0, match.offset);
    const afterText = text.substring(match.offset + match.length);
    const newText = beforeText + suggestion + afterText;
    
    element.value = newText;
    
    // Set cursor position after the replacement
    const cursorPos = match.offset + suggestion.length;
    element.setSelectionRange(cursorPos, cursorPos);
    
    // Trigger input event for framework compatibility
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  removeSpecificError(element, match) {
    const grammarData = this.grammarErrors.get(element);
    if (grammarData) {
      const filteredMatches = grammarData.matches.filter(m => 
        m.offset !== match.offset || m.length !== match.length
      );
      
      if (filteredMatches.length === 0) {
        this.clearErrors(element);
      } else {
        grammarData.matches = filteredMatches;
        this.applyErrorHighlights(element, filteredMatches, grammarData.text);
      }
    }
  }

  ignoreSuggestion(element, match) {
    this.removeSpecificError(element, match);
  }

  hideSuggestionBox() {
    if (this.activeSuggestionBox) {
      this.activeSuggestionBox.style.opacity = '0';
      this.activeSuggestionBox.style.transform = 'translateY(-10px) scale(0.95)';
      
      setTimeout(() => {
        if (this.activeSuggestionBox && this.activeSuggestionBox.parentNode) {
          this.activeSuggestionBox.remove();
        }
        this.activeSuggestionBox = null;
      }, 200);
      
      // Remove keyboard listener
      document.removeEventListener('keydown', this.handleSuggestionKeyboard);
    }
  }

  setupGlobalClickHandler() {
    document.addEventListener('click', (e) => {
      // Hide suggestion box when clicking outside
      if (this.activeSuggestionBox && 
          !e.target.closest('.writeright-suggestion-box') && 
          !e.target.classList.contains('writeright-overlay-highlight') &&
          !e.target.classList.contains('writeright-error-underline')) {
        this.hideSuggestionBox();
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggle') {
        this.isActive = !this.isActive;
        if (!this.isActive) {
          this.clearAllErrors();
        }
        sendResponse({ active: this.isActive });
      }
    });
    
    // Set up keyboard shortcut integration
    this.setupKeyboardShortcuts();
  }

  setupKeyboardShortcuts() {
    // Notify grammar check utility that WriteRight is ready
    if (typeof setupWriteRightKeyboardIntegration === 'function') {
      setupWriteRightKeyboardIntegration();
    }
    
    console.log('WriteRight: Keyboard shortcuts enabled (Ctrl+Enter for manual check)');
  }

  // Handle grammar results from manual keyboard shortcut
  handleManualGrammarResult(element, result, text) {
    // Use the same logic as regular grammar checking
    this.handleGrammarResult(element, result, text);
    
    // If there are suggestions, automatically show the first one
    if (result && result.matches && result.matches.length > 0) {
      const firstMatch = result.matches[0];
      
      // Delay showing suggestion to allow highlights to render
      setTimeout(() => {
        if (element.contentEditable === 'true') {
          const errorElement = element.querySelector('.writeright-overlay-highlight');
          if (errorElement) {
            this.showSuggestionBox(element, firstMatch, errorElement);
          }
        } else {
          this.showSuggestionBox(element, firstMatch, element);
        }
      }, 100);
    }
  }

  startPeriodicScan() {
    // Only start if not already running
    if (!this.periodicScanInterval) {
      this.periodicScanInterval = setInterval(() => {
        if (this.isActive) {
          this.scanForTextInputs();
        }
      }, 5000);
    }
  }

  // Cleanup method for proper resource management
  cleanup() {
    // Clear all timers
    if (this.periodicScanInterval) {
      clearInterval(this.periodicScanInterval);
      this.periodicScanInterval = null;
    }
    
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    
    // Disconnect mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    // Clear all errors
    this.clearAllErrors();
    
    // Hide suggestion box
    this.hideSuggestionBox();
    
    console.log('WriteRight: Cleanup completed');
  }
}

// Initialize when DOM is ready - only if not already initialized
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.writeRightInstance) {
      new WriteRightEnhanced();
    }
  });
} else {
  if (!window.writeRightInstance) {
    new WriteRightEnhanced();
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  console.log('WriteRight: Cleaning up...');
  
  // Clean up instance
  if (window.writeRightInstance && typeof window.writeRightInstance.cleanup === 'function') {
    window.writeRightInstance.cleanup();
  }
  
  // Reset global flags
  window.WriteRightEnhancedLoaded = false;
  window.writeRightInstance = null;
});

// Handle dynamic page changes (SPA navigation)
window.addEventListener('popstate', () => {
  // Reinitialize if needed after navigation
  setTimeout(() => {
    if (window.writeRightInstance && window.writeRightInstance.isActive) {
      window.writeRightInstance.scanForTextInputs();
    }
  }, 500);
});

} // End of WriteRightEnhancedLoaded check