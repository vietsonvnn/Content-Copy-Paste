/**
 * Gemini Content Writer Assistant - Content Script
 * Handles injection into Gemini and text capture
 */

console.log('[CW] ====== Content script loading ======');

// ========================================
// State
// ========================================
let settings = {
  hotkey: { ctrl: true, shift: true, alt: false, key: 'C' },
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
  const keyMatch = e.key.toUpperCase() === key.toUpperCase();

  if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
    e.preventDefault();
    captureSelectedText();
  }
});

// ========================================
// Find Input Element
// ========================================
function findInputElement() {
  // Log all contenteditable elements
  const allEditable = document.querySelectorAll('[contenteditable="true"]');
  console.log('[CW] All contenteditable elements:', allEditable.length);
  allEditable.forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    console.log(`[CW] Element ${i}:`, {
      tag: el.tagName,
      class: el.className,
      id: el.id,
      visible: rect.width > 0 && rect.height > 0,
      width: rect.width,
      height: rect.height
    });
  });

  // Try specific selectors first
  const selectors = [
    'rich-textarea .ql-editor',
    '.ql-editor[contenteditable="true"]',
    'div.ql-editor',
    '[contenteditable="true"].textarea',
    '[contenteditable="true"][aria-label]',
    '[contenteditable="true"][data-placeholder]',
    '[contenteditable="true"]'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 30) {
        console.log('[CW] Found input with selector:', selector);
        return el;
      }
    }
  }

  // Fallback: find any visible contenteditable
  for (const el of allEditable) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 30) {
      console.log('[CW] Found input via fallback');
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

  console.log('[CW] Input element found:', inputElement);

  try {
    // Step 1: Focus
    inputElement.focus();
    console.log('[CW] Focused');

    // Step 2: Clear content
    inputElement.innerHTML = '';
    console.log('[CW] Cleared');

    // Step 3: Insert text
    if (inputElement.classList.contains('ql-editor')) {
      // Quill editor format
      const p = document.createElement('p');
      p.textContent = text;
      inputElement.appendChild(p);
      console.log('[CW] Inserted as Quill paragraph');
    } else {
      inputElement.textContent = text;
      console.log('[CW] Inserted as textContent');
    }

    // Step 4: Dispatch events
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
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

  // Try aria-label first
  const sendByLabel = document.querySelector(
    'button[aria-label*="Send" i], button[aria-label*="Gửi" i]'
  );

  if (sendByLabel && !sendByLabel.disabled) {
    console.log('[CW] Found send button by aria-label');
    sendByLabel.click();
    showToast('Đã gửi!', 'success');
    return;
  }

  // Try finding button near input
  const allButtons = Array.from(document.querySelectorAll('button'));
  console.log('[CW] Total buttons:', allButtons.length);

  for (const btn of allButtons) {
    if (btn.disabled) continue;

    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Send button usually at bottom
    if (rect.top < window.innerHeight * 0.6) continue;

    const hasSvg = btn.querySelector('svg');
    const hasIcon = btn.querySelector('[class*="icon"]');

    if (hasSvg || hasIcon) {
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

  chrome.runtime.sendMessage({
    type: 'TEXT_CAPTURED',
    text: text
  }, () => {
    if (chrome.runtime.lastError) {
      chrome.storage.local.set({
        lastCapturedText: text,
        lastCapturedTime: Date.now()
      });
    }
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
