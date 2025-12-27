/**
 * YeuTuBe - Global Hotkey Handler
 * Runs on ALL pages to capture text with custom hotkey
 */

// Verify script is loaded
if (typeof window !== 'undefined') {
  window.__YTB_LOADED__ = true;
}

(function() {
  'use strict';

  // Multiple ways to log - ensure visibility
  console.log('%c[YTB] Hotkey script init...', 'background: #4285f4; color: white; padding: 2px 6px; border-radius: 3px;');

  // Default hotkey - Ctrl+Shift+G
  let hotkey = { ctrl: true, shift: true, alt: false, key: 'g' };

  // Load saved hotkey from storage
  chrome.storage.local.get(['settings'], (data) => {
    if (data.settings && data.settings.hotkey) {
      hotkey = data.settings.hotkey;
      // Ensure key is lowercase string
      if (hotkey.key && typeof hotkey.key === 'string') {
        hotkey.key = hotkey.key.toLowerCase();
      }
    }
    console.log('[YTB] Loaded hotkey:', formatHotkey(hotkey));
  });

  // Listen for hotkey changes from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'HOTKEY_CHANGED' && msg.hotkey) {
      hotkey = msg.hotkey;
      // Ensure key is lowercase
      if (hotkey.key && typeof hotkey.key === 'string') {
        hotkey.key = hotkey.key.toLowerCase();
      }
      console.log('[YTB] Hotkey updated to:', formatHotkey(hotkey));
      sendResponse({ success: true });
    }
    return true;
  });

  // Also listen for storage changes (backup method)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings && changes.settings.newValue) {
      const newSettings = changes.settings.newValue;
      if (newSettings.hotkey) {
        hotkey = newSettings.hotkey;
        if (hotkey.key && typeof hotkey.key === 'string') {
          hotkey.key = hotkey.key.toLowerCase();
        }
        console.log('[YTB] Hotkey updated via storage:', formatHotkey(hotkey));
      }
    }
  });

  function formatHotkey(hk) {
    if (!hk) return 'undefined';
    let s = '';
    if (hk.ctrl) s += 'Ctrl+';
    if (hk.shift) s += 'Shift+';
    if (hk.alt) s += 'Alt+';
    s += hk.key === ' ' ? 'Space' : (hk.key || '?').toUpperCase();
    return s;
  }

  function showToast(msg, type) {
    if (!document.body) {
      setTimeout(() => showToast(msg, type), 100);
      return;
    }

    const old = document.getElementById('ytb-toast');
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = 'ytb-toast';
    div.textContent = msg;

    const bg = type === 'success' ? '#34a853' : type === 'warning' ? '#fbbc04' : '#4285f4';
    const fg = type === 'warning' ? '#000' : '#fff';

    div.style.cssText = `
      position: fixed !important;
      bottom: 30px !important;
      right: 30px !important;
      padding: 14px 24px !important;
      background: ${bg} !important;
      color: ${fg} !important;
      border-radius: 8px !important;
      font: 600 14px/1.4 -apple-system, sans-serif !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
      z-index: 2147483647 !important;
    `;

    document.body.appendChild(div);

    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.3s';
      setTimeout(() => div.remove(), 300);
    }, 2500);
  }

  function capture() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';

    if (!text) {
      showToast('Chưa chọn text!', 'warning');
      return;
    }

    const words = text.split(/\s+/).filter(w => w).length;

    chrome.storage.local.set({
      lastCapturedText: text,
      lastCapturedTime: Date.now(),
      lastCapturedWordCount: words
    }, () => {
      showToast(`Đã capture: ${words} từ`, 'success');
      console.log('[YTB] Captured', words, 'words');

      chrome.runtime.sendMessage({
        type: 'TEXT_CAPTURED',
        text: text,
        wordCount: words
      }).catch(() => {});
    });
  }

  // Keydown listener
  window.addEventListener('keydown', function(e) {
    // Quick exit if no modifier
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;

    // Get expected values with safety checks
    const expectCtrl = hotkey.ctrl === true;
    const expectShift = hotkey.shift === true;
    const expectAlt = hotkey.alt === true;
    const expectKey = (hotkey.key || 'g').toLowerCase();

    // Check modifiers
    const hasCtrl = e.ctrlKey || e.metaKey;
    const hasShift = e.shiftKey;
    const hasAlt = e.altKey;

    const ctrlOk = expectCtrl ? hasCtrl : !hasCtrl;
    const shiftOk = expectShift ? hasShift : !hasShift;
    const altOk = expectAlt ? hasAlt : !hasAlt;

    // Check key
    let keyOk = false;
    const pressedKey = e.key.toLowerCase();

    if (expectKey === ' ' || expectKey === 'space') {
      keyOk = e.code === 'Space' || e.key === ' ';
    } else {
      keyOk = pressedKey === expectKey;
    }

    const isMatch = ctrlOk && shiftOk && altOk && keyOk;

    // Debug log
    if (hasCtrl || hasAlt) {
      console.log('[YTB] Pressed:',
        (hasCtrl ? 'Ctrl+' : '') + (hasShift ? 'Shift+' : '') + (hasAlt ? 'Alt+' : '') + e.key,
        '| Expected:', formatHotkey(hotkey),
        '| Match:', isMatch
      );
    }

    if (isMatch) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[YTB] ★ HOTKEY MATCHED! ★');
      capture();
      return false;
    }
  }, true);

  console.log('[YTB] Ready! Default:', formatHotkey(hotkey));
})();
