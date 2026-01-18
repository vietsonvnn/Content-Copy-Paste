/**
 * Gemini Content Writer Assistant - Content Script
 * Handles injection into Gemini and text capture
 */

console.log('[CW] ====== Content script loading (Gemini only) ======');

// ========================================
// Toast for Gemini page
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

  sendResponse({ success: true });
  return true;
});

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
  console.log('[CW] Text length:', text.length);

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

    // Step 2: Clear existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputElement);
    selection.removeAllRanges();
    selection.addRange(range);
    console.log('[CW] Selected all via Selection API');

    // Step 3: Insert text - use different method for large text
    if (text.length > 10000) {
      // For large text: directly set innerHTML/innerText (faster, no lag)
      console.log('[CW] Using direct insertion for large text');

      // Clear first
      inputElement.innerHTML = '';

      // Create text node and append
      const textNode = document.createTextNode(text);
      inputElement.appendChild(textNode);

      // Move cursor to end
      range.selectNodeContents(inputElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // For normal text: use execCommand
      document.execCommand('insertText', false, text);
    }
    console.log('[CW] Text inserted');

    // Step 4: Dispatch events to notify Gemini's framework
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    inputElement.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text.substring(0, 100) // Only send first 100 chars in event data
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

  console.log('[CW] No send button found, trying Enter key');
}

// ========================================
// Ready
// ========================================
console.log('[CW] ====== Content script ready ======');
console.log('[CW] URL:', window.location.href);
