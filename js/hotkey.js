/**
 * YeuTuBe - Global Hotkey Handler
 * Runs on ALL pages to capture text with custom hotkey
 */

(function() {
  'use strict';

  console.log('[YTB] Hotkey script loading...');

  // Default hotkey
  let hotkey = { ctrl: true, shift: true, alt: false, key: 'g' };

  // Load from storage
  chrome.storage.local.get(['settings'], (data) => {
    if (data.settings && data.settings.hotkey) {
      hotkey = data.settings.hotkey;
    }
    console.log('[YTB] Hotkey:', hotkeyToString(hotkey));
  });

  // Listen for changes
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'HOTKEY_CHANGED') {
      hotkey = msg.hotkey;
      console.log('[YTB] Hotkey changed to:', hotkeyToString(hotkey));
      sendResponse({ success: true });
    }
    return true;
  });

  function hotkeyToString(hk) {
    let s = '';
    if (hk.ctrl) s += 'Ctrl+';
    if (hk.shift) s += 'Shift+';
    if (hk.alt) s += 'Alt+';
    s += hk.key === ' ' ? 'Space' : hk.key.toUpperCase();
    return s;
  }

  function showToast(msg, type) {
    // Wait for body
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
      opacity: 1 !important;
      transition: opacity 0.3s !important;
    `;

    document.body.appendChild(div);

    setTimeout(() => {
      div.style.opacity = '0';
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

  // Listen for keys - use window level
  window.addEventListener('keydown', function(e) {
    // Must have at least Ctrl or Meta
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;

    const ctrlOk = hotkey.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
    const shiftOk = hotkey.shift ? e.shiftKey : !e.shiftKey;
    const altOk = hotkey.alt ? e.altKey : !e.altKey;

    let keyOk = false;
    const hkKey = hotkey.key.toLowerCase();
    const pressedKey = e.key.toLowerCase();

    if (hkKey === ' ') {
      keyOk = e.code === 'Space' || e.key === ' ';
    } else {
      keyOk = pressedKey === hkKey;
    }

    // Debug
    console.log('[YTB] Key:', e.key, 'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey, 'Match:', ctrlOk && shiftOk && altOk && keyOk);

    if (ctrlOk && shiftOk && altOk && keyOk) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[YTB] ★★★ MATCHED! Capturing... ★★★');
      capture();
      return false;
    }
  }, true);

  console.log('[YTB] Ready!');
})();
