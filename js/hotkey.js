/**
 * YeuTuBe - Global Hotkey Handler
 * Runs on ALL pages to capture text with custom hotkey
 */

console.log('[YTB-Hotkey] Loading...');

// Default hotkey settings
let hotkey = { ctrl: true, shift: true, alt: false, key: 'g' };

// Load hotkey from storage
chrome.storage.local.get(['settings'], (data) => {
  if (data.settings && data.settings.hotkey) {
    hotkey = data.settings.hotkey;
    console.log('[YTB-Hotkey] Loaded hotkey:', formatHotkey(hotkey));
  }
});

// Listen for hotkey changes from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'HOTKEY_CHANGED') {
    hotkey = message.hotkey;
    console.log('[YTB-Hotkey] Hotkey updated:', formatHotkey(hotkey));
    sendResponse({ success: true });
  }
  return true;
});

// Format hotkey for display
function formatHotkey(hk) {
  const parts = [];
  if (hk.ctrl) parts.push('Ctrl');
  if (hk.shift) parts.push('Shift');
  if (hk.alt) parts.push('Alt');
  parts.push(hk.key === ' ' ? 'Space' : hk.key.toUpperCase());
  return parts.join('+');
}

// Show toast notification
function showToast(message, type = 'info') {
  const existing = document.getElementById('ytb-hotkey-toast');
  if (existing) existing.remove();

  const colors = {
    success: '#34a853',
    error: '#ea4335',
    warning: '#fbbc04',
    info: '#4285f4'
  };

  const toast = document.createElement('div');
  toast.id = 'ytb-hotkey-toast';
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
    z-index: 2147483647;
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

// Capture selected text
function captureSelectedText() {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (!text) {
    showToast('Chưa chọn text!', 'warning');
    return;
  }

  const wordCount = text.split(/\s+/).filter(w => w).length;

  // Save to storage
  chrome.storage.local.set({
    lastCapturedText: text,
    lastCapturedTime: Date.now(),
    lastCapturedWordCount: wordCount
  }, () => {
    console.log('[YTB-Hotkey] Captured:', wordCount, 'words');
    showToast(`Đã capture: ${wordCount} từ`, 'success');

    // Notify popup if open
    chrome.runtime.sendMessage({
      type: 'TEXT_CAPTURED',
      text: text,
      wordCount: wordCount
    }).catch(() => {
      // Popup closed, that's OK
    });
  });
}

// Global keydown listener with capture phase
document.addEventListener('keydown', (e) => {
  // Check modifier keys
  const ctrlMatch = hotkey.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  const shiftMatch = hotkey.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = hotkey.alt ? e.altKey : !e.altKey;

  // Check main key (case-insensitive)
  let keyMatch = false;
  if (hotkey.key === ' ') {
    keyMatch = e.key === ' ' || e.code === 'Space';
  } else {
    keyMatch = e.key.toUpperCase() === hotkey.key.toUpperCase();
  }

  // Debug log when any modifier is pressed
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
    console.log('[YTB-Hotkey] Key pressed:', {
      pressed: `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`,
      expected: formatHotkey(hotkey),
      match: ctrlMatch && shiftMatch && altMatch && keyMatch
    });
  }

  // If all match, capture text
  if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
    e.preventDefault();
    e.stopPropagation();
    console.log('[YTB-Hotkey] ★ Hotkey matched! Capturing...');
    captureSelectedText();
  }
}, true); // capture phase = true

console.log('[YTB-Hotkey] Ready. Hotkey:', formatHotkey(hotkey));
