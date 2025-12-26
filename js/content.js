/**
 * Gemini Content Writer Assistant - Content Script
 * Handles injection into Gemini and text capture
 */

// ========================================
// State
// ========================================
let settings = {
  hotkey: { ctrl: true, shift: true, alt: false, key: 'C' },
  showToast: true
};

// ========================================
// Initialize
// ========================================
console.log('[Content Writer] Content script loaded');

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
  console.log('[Content Writer] Message received:', message.type);

  switch (message.type) {
    case 'INJECT_COMMAND':
      injectCommand(message.text, message.autoEnter);
      sendResponse({ success: true });
      break;

    case 'SETTINGS_UPDATED':
      settings = { ...settings, ...message.settings };
      sendResponse({ success: true });
      break;

    case 'HOTKEY_CHANGED':
      settings.hotkey = message.hotkey;
      sendResponse({ success: true });
      break;

    case 'PING':
      sendResponse({ success: true, message: 'Content script is alive' });
      break;
  }

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
// Command Injection
// ========================================
function injectCommand(text, autoEnter = true) {
  // Find Gemini input area
  const inputSelectors = [
    'div[contenteditable="true"].ql-editor',
    'div[contenteditable="true"][data-placeholder]',
    'rich-textarea div[contenteditable="true"]',
    '.ql-editor[contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
    '.input-area [contenteditable="true"]',
    'div.ql-editor',
    'p[data-placeholder]',
    'div[contenteditable="true"][aria-label]',
    '.text-input-field [contenteditable="true"]'
  ];

  let inputElement = null;

  for (const selector of inputSelectors) {
    inputElement = document.querySelector(selector);
    if (inputElement) break;
  }

  if (!inputElement) {
    console.error('[Content Writer] Could not find Gemini input area');
    showToast('Không tìm thấy ô nhập Gemini!', 'error');
    return;
  }

  // Focus and set content
  inputElement.focus();

  // Clear existing content
  inputElement.innerHTML = '';

  // Insert text
  if (inputElement.classList.contains('ql-editor')) {
    const p = document.createElement('p');
    p.textContent = text;
    inputElement.appendChild(p);
  } else {
    inputElement.textContent = text;
  }

  // Dispatch input events
  inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  inputElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  if (settings.showToast) {
    showToast(`Đã paste: "${text.substring(0, 30)}..."`, 'success');
  }

  // Auto enter
  if (autoEnter) {
    setTimeout(() => {
      clickSendButton();
    }, 500);
  }
}

function clickSendButton() {
  const sendButtonSelectors = [
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Gửi"]',
    'button[mattooltip*="Send"]',
    'button[data-test-id="send-button"]',
    'button.send-button',
    'button[jsname] mat-icon',
    'button.mdc-icon-button[aria-label]',
    '.send-button-container button',
    'button[jscontroller][jsaction*="click"]'
  ];

  let sendButton = null;

  for (const selector of sendButtonSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const btn = el.tagName === 'BUTTON' ? el : el.closest('button');
      if (!btn) continue;

      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const tooltip = (btn.getAttribute('mattooltip') || '').toLowerCase();

      if (ariaLabel.includes('send') || ariaLabel.includes('gửi') ||
          tooltip.includes('send') || tooltip.includes('gửi')) {
        sendButton = btn;
        break;
      }
    }
    if (sendButton) break;
  }

  if (!sendButton) {
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const svg = btn.querySelector('svg');
      const icon = btn.querySelector('mat-icon');

      if (svg || icon) {
        if (rect.bottom > window.innerHeight / 2 && rect.right > window.innerWidth / 2) {
          if (!btn.disabled && !btn.classList.contains('disabled')) {
            sendButton = btn;
            break;
          }
        }
      }
    }
  }

  if (sendButton) {
    sendButton.click();
    console.log('[Content Writer] Send button clicked');
    if (settings.showToast) {
      showToast('Đã gửi!', 'success');
    }
  } else {
    console.warn('[Content Writer] Could not find send button, trying Enter key');
    const inputElement = document.querySelector('div[contenteditable="true"]');
    if (inputElement) {
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
    }
  }
}

// ========================================
// Text Capture
// ========================================
function captureSelectedText() {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (!text) {
    showToast('Không có text được chọn!', 'warning');
    return;
  }

  const wordCount = countWords(text);

  chrome.runtime.sendMessage({
    type: 'TEXT_CAPTURED',
    text: text
  }, (response) => {
    if (chrome.runtime.lastError) {
      chrome.storage.local.set({
        lastCapturedText: text,
        lastCapturedTime: Date.now()
      });
    }

    if (settings.showToast) {
      showToast(`Captured: ${wordCount} từ`, 'success');
    }
  });
}

function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// ========================================
// Toast Notification
// ========================================
function showToast(message, type = 'info') {
  const existingToast = document.getElementById('cw-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'cw-toast';
  toast.className = `cw-toast cw-toast-${type}`;
  toast.innerHTML = `
    <span class="cw-toast-icon">${getToastIcon(type)}</span>
    <span class="cw-toast-message">${message}</span>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('cw-toast-show');
  });

  setTimeout(() => {
    toast.classList.remove('cw-toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function getToastIcon(type) {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    default: return 'ℹ';
  }
}

// ========================================
// Inject Toast Styles
// ========================================
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  .cw-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #323232;
    color: white;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
  }

  .cw-toast-show {
    opacity: 1;
    transform: translateY(0);
  }

  .cw-toast-success {
    background: #34a853;
  }

  .cw-toast-error {
    background: #ea4335;
  }

  .cw-toast-warning {
    background: #fbbc04;
    color: #202124;
  }

  .cw-toast-icon {
    font-size: 16px;
  }

  .cw-toast-message {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
document.head.appendChild(toastStyles);

console.log('[Content Writer] Content script initialized');
