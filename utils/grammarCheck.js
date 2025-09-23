// WriteRight Grammar Check Utility - Enhanced LanguageTool API Helper
console.log('WriteRight: Grammar check utility loaded');

// Prevent duplicate function declarations and event listeners
if (window.WriteRightGrammarLoaded) {
  console.log('WriteRight: Grammar utility already loaded, skipping initialization');
} else {
  window.WriteRightGrammarLoaded = true;

// Global grammar checking function with improved error handling
window.checkGrammar = async function(text, language = 'en-US') {
  if (!text || text.trim().length < 3) {
    return { matches: [] };
  }

  // Rate limiting and caching
  const cacheKey = `${text.slice(0, 100)}_${language}`;
  const cachedResult = window.grammarCache?.get(cacheKey);
  
  if (cachedResult && Date.now() - cachedResult.timestamp < 30000) { // 30 second cache
    return cachedResult.data;
  }

  const API_URL = 'https://api.languagetool.org/v2/check';
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          text: text.trim(),
          language: language,
          enabledOnly: 'false',
          level: 'picky',
          disabledRules: 'WHITESPACE_RULE' // Disable whitespace-only rules
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process and enhance the response
      const processedResult = processGrammarResponse(data, text);
      
      // Cache the result
      if (!window.grammarCache) {
        window.grammarCache = new Map();
      }
      
      // Limit cache size
      if (window.grammarCache.size > 50) {
        const firstKey = window.grammarCache.keys().next().value;
        window.grammarCache.delete(firstKey);
      }
      
      window.grammarCache.set(cacheKey, {
        data: processedResult,
        timestamp: Date.now()
      });
      
      return processedResult;
      
    } catch (error) {
      console.log(`WriteRight: Grammar check attempt ${attempt + 1} failed:`, error);
      
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY * (attempt + 1));
        continue;
      }
      
      // Fallback to basic grammar check on final failure
      return getFallbackGrammarCheck(text);
    }
  }
};

// Process and enhance LanguageTool response
function processGrammarResponse(data, originalText) {
  if (!data.matches) {
    return { matches: [] };
  }

  const processedMatches = data.matches
    .filter(match => {
      // Filter out low-quality matches
      return match.replacements && 
             match.replacements.length > 0 &&
             match.length > 0 &&
             match.length < 50; // Skip very long matches
    })
    .map(match => {
      return {
        ...match,
        severity: categorizeSeverity(match),
        category: categorizeIssue(match),
        preview: generatePreview(originalText, match),
        confidence: calculateConfidence(match)
      };
    })
    .filter(match => match.confidence > 0.3); // Only show confident matches

  // Sort by importance (errors first, then by position)
  processedMatches.sort((a, b) => {
    if (a.severity !== b.severity) {
      const severityOrder = { 'error': 0, 'warning': 1, 'info': 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.offset - b.offset;
  });

  return {
    ...data,
    matches: processedMatches.slice(0, 10), // Limit to 10 matches max
    summary: generateSummary(processedMatches)
  };
}

// Fallback grammar check for when API fails
function getFallbackGrammarCheck(text) {
  const matches = [];
  
  // Common spelling errors
  const commonErrors = [
    { pattern: /\bteh\b/gi, replacement: 'the', message: 'Possible typo', category: 'spelling' },
    { pattern: /\brecieve\b/gi, replacement: 'receive', message: 'Spelling: i before e except after c', category: 'spelling' },
    { pattern: /\bseperate\b/gi, replacement: 'separate', message: 'Spelling error', category: 'spelling' },
    { pattern: /\boccured\b/gi, replacement: 'occurred', message: 'Spelling: double r', category: 'spelling' },
    { pattern: /\bdefinately\b/gi, replacement: 'definitely', message: 'Spelling error', category: 'spelling' },
    { pattern: /\bbegining\b/gi, replacement: 'beginning', message: 'Spelling: double n', category: 'spelling' },
    { pattern: /\byour\s+welcome\b/gi, replacement: "you're welcome", message: 'Grammar: use "you\'re" (you are)', category: 'grammar' },
    { pattern: /\bits\s+([a-z]+ing)\b/gi, replacement: "it's $1", message: 'Grammar: use "it\'s" (it is)', category: 'grammar' }
  ];

  commonErrors.forEach(error => {
    let match;
    const regex = new RegExp(error.pattern.source, error.pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        offset: match.index,
        length: match[0].length,
        message: error.message,
        shortMessage: error.category,
        replacements: [{ value: error.replacement }],
        rule: { 
          id: 'FALLBACK_' + error.category.toUpperCase(),
          category: { 
            id: error.category.toUpperCase(),
            name: error.category 
          } 
        },
        severity: 'error',
        category: error.category,
        confidence: 0.8
      });
    }
  });

  return { 
    matches: matches.slice(0, 5), // Limit fallback matches
    fallback: true 
  };
}

// Categorize issue severity
function categorizeSeverity(match) {
  const errorTypes = [
    'MORFOLOGIK_RULE_EN_US', // Spelling
    'GRAMMAR_ERROR',
    'TYPOS',
    'WRONG_WORD'
  ];
  
  const warningTypes = [
    'STYLE',
    'REDUNDANCY',
    'WORDINESS',
    'REPETITION'
  ];

  const ruleId = match.rule?.id || '';
  const category = match.rule?.category?.id || '';
  
  if (errorTypes.some(type => ruleId.includes(type) || category.includes(type))) {
    return 'error';
  } else if (warningTypes.some(type => ruleId.includes(type) || category.includes(type))) {
    return 'warning';
  }
  
  return 'info';
}

// Categorize issue type
function categorizeIssue(match) {
  const ruleId = match.rule?.id || '';
  const category = match.rule?.category?.id || '';
  
  if (ruleId.includes('MORFOLOGIK') || category.includes('TYPOS')) {
    return 'spelling';
  } else if (category.includes('GRAMMAR')) {
    return 'grammar';
  } else if (category.includes('PUNCTUATION')) {
    return 'punctuation';
  } else if (category.includes('STYLE')) {
    return 'style';
  } else if (ruleId.includes('WHITESPACE')) {
    return 'spacing';
  }
  
  return 'other';
}

// Generate text preview with highlighting
function generatePreview(text, match) {
  const start = Math.max(0, match.offset - 20);
  const end = Math.min(text.length, match.offset + match.length + 20);
  
  const before = text.substring(start, match.offset);
  const error = text.substring(match.offset, match.offset + match.length);
  const after = text.substring(match.offset + match.length, end);
  
  return {
    before: before,
    error: error,
    after: after,
    suggestion: match.replacements?.[0]?.value || null
  };
}

// Calculate confidence score
function calculateConfidence(match) {
  let confidence = 0.5; // Base confidence
  
  // Boost confidence for spelling errors
  if (match.rule?.id?.includes('MORFOLOGIK')) {
    confidence += 0.3;
  }
  
  // Boost for grammar rules
  if (match.rule?.category?.id?.includes('GRAMMAR')) {
    confidence += 0.2;
  }
  
  // Boost if there are good replacements
  if (match.replacements && match.replacements.length > 0) {
    confidence += 0.1;
  }
  
  // Boost for shorter matches (more likely to be errors)
  if (match.length <= 10) {
    confidence += 0.1;
  }
  
  // Penalize very long matches
  if (match.length > 20) {
    confidence -= 0.2;
  }
  
  return Math.min(1.0, Math.max(0.0, confidence));
}

// Generate summary of issues
function generateSummary(matches) {
  const summary = {
    total: matches.length,
    errors: 0,
    warnings: 0,
    info: 0,
    categories: {}
  };
  
  matches.forEach(match => {
    summary[match.severity]++;
    
    const category = match.category;
    summary.categories[category] = (summary.categories[category] || 0) + 1;
  });
  
  return summary;
}

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced grammar checking with context
window.checkGrammarWithContext = async function(text, context = {}) {
  const { 
    language = 'en-US',
    userLevel = 'default',
    textType = 'general',
    previousText = ''
  } = context;
  
  // Combine with previous text for better context
  const fullText = previousText ? `${previousText} ${text}` : text;
  const result = await window.checkGrammar(fullText, language);
  
  if (previousText && result.matches) {
    // Filter matches to only include current text
    const currentTextStart = previousText.length + 1;
    result.matches = result.matches.filter(match => 
      match.offset >= currentTextStart
    ).map(match => ({
      ...match,
      offset: match.offset - currentTextStart
    }));
  }
  
  return result;
};

// Real-time grammar checking with debouncing
window.checkGrammarRealtime = function(text, callback, delay = 500) {
  if (!window.grammarDebounceTimer) {
    window.grammarDebounceTimer = {};
  }
  
  const timerId = 'default';
  
  // Clear existing timer
  if (window.grammarDebounceTimer[timerId]) {
    clearTimeout(window.grammarDebounceTimer[timerId]);
  }
  
  // Set new timer
  window.grammarDebounceTimer[timerId] = setTimeout(async () => {
    try {
      const result = await window.checkGrammar(text);
      callback(result);
    } catch (error) {
      console.error('WriteRight: Real-time check failed:', error);
      callback({ matches: [], error: error.message });
    }
  }, delay);
};

// Initialize grammar cache
if (!window.grammarCache) {
  window.grammarCache = new Map();
}

// Global keyboard shortcut handler for Ctrl+Enter
if (!window.writeRightKeyboardHandlerAdded) {
  window.writeRightKeyboardHandlerAdded = true;
  
  document.addEventListener('keydown', function(event) {
    // Check for Ctrl+Enter (or Cmd+Enter on Mac)
    const isCtrlEnter = (event.ctrlKey || event.metaKey) && event.key === 'Enter';
    
    if (isCtrlEnter) {
      const target = event.target;
      
      // Check if target is a text input element
      const isTextInput = target && (
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && ['text', 'email', 'search', 'url'].includes(target.type)) ||
        target.contentEditable === 'true' ||
        target.classList.contains('ql-editor') ||
        target.getAttribute('role') === 'textbox'
      );
      
      if (isTextInput) {
        // Prevent default behavior (form submission, etc.)
        event.preventDefault();
        event.stopPropagation();
        
        // Get text content from the input
        const text = target.value || target.textContent || target.innerText || '';
        
        if (text.trim().length > 0) {
          // Run grammar check function
          runGrammarCheck(target, text);
        }
      }
    }
  }, true); // Use capture phase to ensure we catch the event early
}

// Grammar check function that can be called by keyboard shortcut
async function runGrammarCheck(element, text) {
  try {
    console.log('WriteRight: Running manual grammar check via Ctrl+Enter');
    
    // Add visual feedback that check is running
    const originalBorder = element.style.border;
    element.style.border = '2px solid #667eea';
    element.style.transition = 'border 0.2s ease';
    
    // Show loading indicator
    element.classList.add('writeright-checking');
    
    // Run the grammar check
    const result = await window.checkGrammar(text);
    
    // Remove loading indicator
    element.classList.remove('writeright-checking');
    
    // Restore original border
    element.style.border = originalBorder;
    
    if (result && result.matches && result.matches.length > 0) {
      // Show results in console for debugging
      console.log('WriteRight: Found', result.matches.length, 'grammar issues');
      
      // If there's an active WriteRight instance, use it to handle results
      if (window.writeRightInstance) {
        // Use manual grammar result handler if available, otherwise use regular handler
        if (typeof window.writeRightInstance.handleManualGrammarResult === 'function') {
          window.writeRightInstance.handleManualGrammarResult(element, result, text);
        } else {
          window.writeRightInstance.handleGrammarResult(element, result, text);
        }
      } else {
        // Fallback: show simple notification
        showGrammarResultNotification(element, result);
      }
    } else {
      // No errors found
      console.log('WriteRight: No grammar issues found');
      showGrammarResultNotification(element, { matches: [] });
    }
    
  } catch (error) {
    console.error('WriteRight: Manual grammar check failed:', error);
    
    // Remove loading indicator
    element.classList.remove('writeright-checking');
    
    // Show error notification
    showErrorNotification(element, 'Grammar check failed. Please try again.');
  }
}

// Show grammar check result notification
function showGrammarResultNotification(element, result) {
  // Remove any existing notifications
  const existingNotification = document.querySelector('.writeright-manual-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification
  const notification = document.createElement('div');
  notification.className = 'writeright-manual-notification';
  
  const issueCount = result.matches ? result.matches.length : 0;
  const message = issueCount === 0 
    ? '✅ No grammar issues found!' 
    : `⚠️ Found ${issueCount} grammar issue${issueCount > 1 ? 's' : ''}`;
  
  notification.innerHTML = `
    <div class="writeright-notification-content">
      <span class="writeright-notification-message">${message}</span>
      <button class="writeright-notification-close">&times;</button>
    </div>
  `;
  
  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${issueCount === 0 ? '#27ae60' : '#e74c3c'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    opacity: 0;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  `;
  
  // Style the content
  const content = notification.querySelector('.writeright-notification-content');
  content.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;
  
  // Style the close button
  const closeButton = notification.querySelector('.writeright-notification-close');
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    margin: 0;
    opacity: 0.8;
    transition: opacity 0.2s ease;
  `;
  
  closeButton.addEventListener('click', () => {
    hideNotification(notification);
  });
  
  closeButton.addEventListener('mouseover', () => {
    closeButton.style.opacity = '1';
  });
  
  closeButton.addEventListener('mouseout', () => {
    closeButton.style.opacity = '0.8';
  });
  
  // Add to DOM and show
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(-50%) translateY(0)';
  }, 100);
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    hideNotification(notification);
  }, 4000);
}

// Show error notification
function showErrorNotification(element, message) {
  showGrammarResultNotification(element, { 
    matches: [{ message: message }], 
    error: true 
  });
}

// Hide notification with animation
function hideNotification(notification) {
  if (notification && notification.parentNode) {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }
}

// Enhanced keyboard shortcut handler that works with WriteRight instance
function setupWriteRightKeyboardIntegration() {
  // This function can be called by the main WriteRight class to integrate shortcuts
  window.writeRightKeyboardReady = true;
  console.log('WriteRight: Keyboard integration ready');
}

// Initialize cache and cleanup only if not already done
if (!window.grammarCacheInitialized) {
  window.grammarCacheInitialized = true;
  
  // Clear cache periodically
  setInterval(() => {
    if (window.grammarCache && window.grammarCache.size > 100) {
      // Clear old entries
      const now = Date.now();
      for (const [key, value] of window.grammarCache.entries()) {
        if (now - value.timestamp > 300000) { // 5 minutes
          window.grammarCache.delete(key);
        }
      }
    }
  }, 60000); // Check every minute
}

// Export for use in other modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkGrammar: window.checkGrammar,
    checkGrammarWithContext: window.checkGrammarWithContext,
    checkGrammarRealtime: window.checkGrammarRealtime
  };
}

} // End of WriteRightGrammarLoaded check