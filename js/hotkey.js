/**
 * YeuTuBe - Global Hotkey Handler
 * Chạy trên TẤT CẢ các trang để capture text
 */

(function() {
  'use strict';

  // Log ngay khi script load
  console.log('[YTB] ===== HOTKEY SCRIPT LOADED =====');
  console.log('[YTB] URL:', window.location.href);

  // Hotkey mặc định
  let hotkey = { ctrl: true, shift: true, alt: false, key: 'g' };

  // Load từ storage
  try {
    chrome.storage.local.get(['settings'], function(data) {
      if (chrome.runtime.lastError) {
        console.log('[YTB] Storage error:', chrome.runtime.lastError);
        return;
      }
      if (data && data.settings && data.settings.hotkey) {
        hotkey = data.settings.hotkey;
        // Đảm bảo key là lowercase
        if (typeof hotkey.key === 'string') {
          hotkey.key = hotkey.key.toLowerCase();
        }
      }
      console.log('[YTB] Hotkey loaded:', JSON.stringify(hotkey));
    });
  } catch(e) {
    console.log('[YTB] Error loading storage:', e);
  }

  // Lắng nghe thay đổi từ popup
  try {
    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
      console.log('[YTB] Message received:', msg.type);
      if (msg.type === 'HOTKEY_CHANGED' && msg.hotkey) {
        hotkey = msg.hotkey;
        if (typeof hotkey.key === 'string') {
          hotkey.key = hotkey.key.toLowerCase();
        }
        console.log('[YTB] Hotkey changed to:', JSON.stringify(hotkey));
        sendResponse({ success: true });
      }
      return true;
    });
  } catch(e) {
    console.log('[YTB] Error setting up message listener:', e);
  }

  // Lắng nghe storage change (backup)
  try {
    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area === 'local' && changes.settings) {
        var newSettings = changes.settings.newValue;
        if (newSettings && newSettings.hotkey) {
          hotkey = newSettings.hotkey;
          if (typeof hotkey.key === 'string') {
            hotkey.key = hotkey.key.toLowerCase();
          }
          console.log('[YTB] Hotkey updated via storage change:', JSON.stringify(hotkey));
        }
      }
    });
  } catch(e) {
    console.log('[YTB] Error setting up storage listener:', e);
  }

  // Toast notification
  function showToast(msg, type) {
    if (!document.body) {
      setTimeout(function() { showToast(msg, type); }, 100);
      return;
    }

    var old = document.getElementById('ytb-toast');
    if (old) old.parentNode.removeChild(old);

    var div = document.createElement('div');
    div.id = 'ytb-toast';
    div.textContent = msg;

    var bg = type === 'success' ? '#34a853' : (type === 'warning' ? '#fbbc04' : '#4285f4');
    var fg = type === 'warning' ? '#000' : '#fff';

    div.style.cssText = 'position:fixed!important;bottom:30px!important;right:30px!important;' +
      'padding:14px 24px!important;background:' + bg + '!important;color:' + fg + '!important;' +
      'border-radius:8px!important;font:600 14px -apple-system,sans-serif!important;' +
      'box-shadow:0 4px 20px rgba(0,0,0,0.3)!important;z-index:2147483647!important;';

    document.body.appendChild(div);

    setTimeout(function() {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 3000);
  }

  // Capture text
  function captureText() {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : '';

    console.log('[YTB] Capturing... Selected text length:', text.length);

    if (!text) {
      showToast('Chưa chọn text!', 'warning');
      return;
    }

    var words = text.split(/\s+/).filter(function(w) { return w.length > 0; }).length;

    chrome.storage.local.set({
      lastCapturedText: text,
      lastCapturedTime: Date.now(),
      lastCapturedWordCount: words
    }, function() {
      if (chrome.runtime.lastError) {
        console.log('[YTB] Save error:', chrome.runtime.lastError);
        return;
      }
      showToast('Đã capture: ' + words + ' từ', 'success');
      console.log('[YTB] Captured', words, 'words');

      // Thông báo popup nếu đang mở
      try {
        chrome.runtime.sendMessage({
          type: 'TEXT_CAPTURED',
          text: text,
          wordCount: words
        });
      } catch(e) {}
    });
  }

  // Keydown handler
  function onKeyDown(e) {
    // Lấy config hiện tại
    var wantCtrl = hotkey.ctrl === true;
    var wantShift = hotkey.shift === true;
    var wantAlt = hotkey.alt === true;
    var wantKey = (hotkey.key || 'g').toLowerCase();

    // Lấy phím đang bấm
    var hasCtrl = e.ctrlKey || e.metaKey;
    var hasShift = e.shiftKey;
    var hasAlt = e.altKey;

    // So sánh key - dùng e.code để tránh vấn đề với Shift
    var pressedKey = '';
    if (e.code) {
      // e.code cho kết quả ổn định hơn (KeyG, KeyA, Space, etc.)
      if (e.code.startsWith('Key')) {
        pressedKey = e.code.substring(3).toLowerCase(); // KeyG -> g
      } else if (e.code === 'Space') {
        pressedKey = ' ';
      } else {
        pressedKey = e.key.toLowerCase();
      }
    } else {
      pressedKey = e.key.toLowerCase();
    }

    // Check từng modifier
    var ctrlOk = wantCtrl === hasCtrl;
    var shiftOk = wantShift === hasShift;
    var altOk = wantAlt === hasAlt;
    var keyOk = (wantKey === pressedKey) || (wantKey === ' ' && pressedKey === ' ');

    var isMatch = ctrlOk && shiftOk && altOk && keyOk;

    // Debug - chỉ log khi có modifier
    if (hasCtrl || hasAlt || hasShift) {
      console.log('[YTB] Key event:', {
        code: e.code,
        key: e.key,
        pressed: pressedKey,
        ctrl: hasCtrl,
        shift: hasShift,
        alt: hasAlt,
        want: wantKey,
        match: isMatch
      });
    }

    if (isMatch) {
      console.log('[YTB] ★★★ MATCHED! ★★★');
      e.preventDefault();
      e.stopPropagation();
      captureText();
      return false;
    }
  }

  // Đăng ký listener với capture phase
  document.addEventListener('keydown', onKeyDown, true);

  // Backup: đăng ký trên window
  window.addEventListener('keydown', onKeyDown, true);

  console.log('[YTB] ===== READY =====');
  console.log('[YTB] Default hotkey:', JSON.stringify(hotkey));
})();
