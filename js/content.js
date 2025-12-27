/**
 * Gemini Content Writer Assistant - Content Script
 * Handles injection into Gemini and text capture
 */

console.log('[CW] ====== Content script loading ======');

// ========================================
// State
// ========================================
let settings = {
  hotkey: { ctrl: true, shift: true, alt: false, key: 'g' },
  showToast: true
};

// Load settings
chrome.storage.local.get(['settings'], (data) => {
  if (data.settings) {
    settings = { ...settings, ...data.settings };
  }
});

// ========================================
// Message Listener
// ========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CW] Message received:', message);

  if (message.type === 'INJECT_COMMAND') {
    console.log('[CW] Injecting command:', message.text);
    const result = injectCommand(message.text, message.autoEnter);
    sendResponse({ success: result });
    return true;
  }

  if (message.type === 'PING') {
    console.log('[CW] Ping received');
    sendResponse({ success: true, message: 'alive' });
    return true;
  }

  if (message.type === 'HOTKEY_CHANGED') {
    settings.hotkey = message.hotkey;
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CAPTURE_TEXT') {
    console.log('[CW] Capture command received from background');
    captureSelectedText();
    sendResponse({ success: true });
    return true;
  }

  sendResponse({ success: true });
  return true;
});

// ========================================
// Keyboard Listener for Custom Hotkey
// ========================================
document.addEventListener('keydown', (e) => {
  const { ctrl, shift, alt, key } = settings.hotkey;

  const ctrlMatch = ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  const shiftMatch = shift ? e.shiftKey : !e.shiftKey;
  const altMatch = alt ? e.altKey : !e.altKey;

  // Handle Space key specially (e.key can be ' ' or 'Space')
  // For letter keys with Shift pressed, e.key will be uppercase (e.g., 'G')
  let keyMatch = false;
  if (key === ' ') {
    keyMatch = e.key === ' ' || e.code === 'Space';
  } else {
    // Compare case-insensitively for letters
    keyMatch = e.key.toUpperCase() === key.toUpperCase();
  }

  // Debug: Log ALL Ctrl combinations to help troubleshoot
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    console.log('[CW] Key event:', {
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      expected: { ctrl, shift, alt, key },
      matches: { ctrlMatch, shiftMatch, altMatch, keyMatch }
    });
  }

  if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
    e.preventDefault();
    e.stopPropagation();
    console.log('[CW] ★★★ Hotkey matched! Capturing text... ★★★');
    captureSelectedText();
  }
}, true); // Use capture phase to catch event before other handlers

// ========================================
// Find Input Element
// ========================================
function findInputElement() {
  // Try specific selectors for Gemini (updated for 2024/2025 UI)
  const selectors = [
    // Gemini rich-textarea selectors (most common)
    'rich-textarea .ql-editor[contenteditable="true"]',
    'rich-textarea[aria-label] .ql-editor',
    '.input-area-container .ql-editor',
    // Direct contenteditable with role
    '[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="prompt" i]',
    'div[contenteditable="true"][aria-label*="nhập" i]',
    // Fallback selectors
    '.ql-editor[contenteditable="true"]',
    'div.ql-editor.textarea',
    '[contenteditable="true"].ql-editor',
    '[contenteditable="true"][data-placeholder]'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      // Input area is usually at bottom half of screen and has minimum width
      if (rect.width > 100 && rect.height > 20 && rect.top > window.innerHeight * 0.3) {
        console.log('[CW] Found input with selector:', selector);
        return el;
      }
    }
  }

  // Fallback: find any visible contenteditable at bottom of page
  const allEditable = document.querySelectorAll('[contenteditable="true"]');
  for (const el of allEditable) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 20 && rect.top > window.innerHeight * 0.3) {
      console.log('[CW] Found input via fallback (bottom area)');
      return el;
    }
  }

  // Last resort: any visible contenteditable
  for (const el of allEditable) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 20) {
      console.log('[CW] Found input via last resort fallback');
      return el;
    }
  }

  console.error('[CW] No input element found!');
  return null;
}

// ========================================
// Command Injection
// ========================================
function injectCommand(text, autoEnter = true) {
  console.log('[CW] Starting injection...');

  const inputElement = findInputElement();

  if (!inputElement) {
    showToast('Không tìm thấy ô nhập!', 'error');
    return false;
  }

  console.log('[CW] Input element found:', inputElement.className);

  try {
    // Step 1: Focus
    inputElement.focus();
    console.log('[CW] Focused');

    // Step 2: Select all content using Selection API
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputElement);
    selection.removeAllRanges();
    selection.addRange(range);
    console.log('[CW] Selected all via Selection API');

    // Step 3: Insert text using execCommand (bypass Trusted Types)
    document.execCommand('insertText', false, text);
    console.log('[CW] Inserted via execCommand');

    // Step 4: Dispatch events to notify Gemini's framework
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    inputElement.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text
    }));
    console.log('[CW] Events dispatched');

    showToast('Đã nhập lệnh!', 'success');

    // Step 5: Auto send
    if (autoEnter) {
      setTimeout(() => {
        sendMessage(inputElement);
      }, 500);
    }

    return true;

  } catch (err) {
    console.error('[CW] Injection error:', err);
    showToast('Lỗi: ' + err.message, 'error');
    return false;
  }
}

// ========================================
// Send Message
// ========================================
function sendMessage(inputElement) {
  console.log('[CW] Looking for send button...');

  // Try aria-label first (multiple languages)
  const sendByLabel = document.querySelector(
    'button[aria-label*="Send" i], button[aria-label*="Gửi" i], button[aria-label*="Submit" i]'
  );

  if (sendByLabel && !sendByLabel.disabled) {
    console.log('[CW] Found send button by aria-label');
    sendByLabel.click();
    showToast('Đã gửi!', 'success');
    return;
  }

  // Try finding send button by common patterns
  const sendButtonSelectors = [
    'button[data-test-id="send-button"]',
    'button.send-button',
    'button[type="submit"]',
    '.input-area button:not([disabled])',
    'rich-textarea + button',
    'button mat-icon[data-mat-icon-name="send"]',
    'button:has(mat-icon[data-mat-icon-name="send"])'
  ];

  for (const selector of sendButtonSelectors) {
    try {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          console.log('[CW] Found send button by selector:', selector);
          btn.click();
          showToast('Đã gửi!', 'success');
          return;
        }
      }
    } catch (e) {
      // Some selectors may not be supported
    }
  }

  // Try finding button near input (bottom area with SVG icon)
  const allButtons = Array.from(document.querySelectorAll('button'));
  console.log('[CW] Total buttons:', allButtons.length);

  for (const btn of allButtons) {
    if (btn.disabled) continue;

    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Send button usually at bottom half of screen
    if (rect.top < window.innerHeight * 0.5) continue;

    const hasSvg = btn.querySelector('svg');
    const hasMatIcon = btn.querySelector('mat-icon');
    const hasIcon = btn.querySelector('[class*="icon"]');

    if (hasSvg || hasMatIcon || hasIcon) {
      console.log('[CW] Clicking potential send button:', btn);
      btn.click();
      showToast('Đã gửi!', 'success');
      return;
    }
  }

  // Fallback: Enter key
  console.log('[CW] No send button found, trying Enter');
  inputElement.focus();

  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  inputElement.dispatchEvent(enterEvent);

  showToast('Nhấn Enter để gửi', 'info');
}

// ========================================
// Text Capture
// ========================================
function captureSelectedText() {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (!text) {
    showToast('Chưa chọn text!', 'warning');
    return;
  }

  const wordCount = text.split(/\s+/).filter(w => w).length;

  // Always save to storage first (most reliable)
  chrome.storage.local.set({
    lastCapturedText: text,
    lastCapturedTime: Date.now(),
    lastCapturedWordCount: wordCount
  }, () => {
    console.log('[CW] Captured text saved to storage:', wordCount, 'words');

    // Then try to notify background/popup
    chrome.runtime.sendMessage({
      type: 'TEXT_CAPTURED',
      text: text,
      wordCount: wordCount
    }).catch(() => {
      // Popup might be closed, that's OK - data is in storage
      console.log('[CW] Popup not open, text saved to storage');
    });

    showToast(`Captured: ${wordCount} từ`, 'success');
  });
}

// ========================================
// Toast
// ========================================
function showToast(message, type = 'info') {
  const existing = document.getElementById('cw-toast');
  if (existing) existing.remove();

  const colors = {
    success: '#34a853',
    error: '#ea4335',
    warning: '#fbbc04',
    info: '#4285f4'
  };

  const toast = document.createElement('div');
  toast.id = 'cw-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 20px;
    background: ${colors[type] || colors.info};
    color: ${type === 'warning' ? '#000' : '#fff'};
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 999999;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// Ready
// ========================================
console.log('[CW] ====== Content script ready ======');
console.log('[CW] URL:', window.location.href);
