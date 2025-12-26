/**
 * Gemini Content Writer Assistant - Background Service Worker
 * Handles message routing, hotkey management, and window management
 */

// ========================================
// State
// ========================================
let currentHotkey = { ctrl: true, shift: true, alt: false, key: 'C' };
let popupWindowId = null;

// ========================================
// Initialize
// ========================================
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed:', details.reason);

  if (details.reason === 'install') {
    chrome.storage.local.set({
      settings: {
        hotkey: { ctrl: true, shift: true, alt: false, key: 'C' },
        koreanCountMethod: 'words',
        showToast: true
      }
    });
  }
});

// Load hotkey setting
chrome.storage.local.get(['settings'], (data) => {
  if (data.settings && data.settings.hotkey) {
    currentHotkey = data.settings.hotkey;
  }
});

// ========================================
// Click on Extension Icon - Open Resizable Window
// ========================================
chrome.action.onClicked.addListener(async (tab) => {
  // Check if popup window already exists
  if (popupWindowId !== null) {
    try {
      const existingWindow = await chrome.windows.get(popupWindowId);
      if (existingWindow) {
        // Focus existing window
        chrome.windows.update(popupWindowId, { focused: true });
        return;
      }
    } catch (e) {
      // Window doesn't exist anymore
      popupWindowId = null;
    }
  }

  // Get screen dimensions
  const screen = await chrome.system.display.getInfo();
  const primaryDisplay = screen[0];
  const screenWidth = primaryDisplay.bounds.width;
  const screenHeight = primaryDisplay.bounds.height;

  // Default window size (small - can be resized by user)
  const windowWidth = 340;
  const windowHeight = 500;

  // Position at right side of screen
  const left = screenWidth - windowWidth - 20;
  const top = 100;

  // Create new popup window
  const newWindow = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: windowWidth,
    height: windowHeight,
    left: left,
    top: top,
    focused: true
  });

  popupWindowId = newWindow.id;

  // Listen for window close
  chrome.windows.onRemoved.addListener(function onRemoved(windowId) {
    if (windowId === popupWindowId) {
      popupWindowId = null;
      chrome.windows.onRemoved.removeListener(onRemoved);
    }
  });
});

// ========================================
// Message Router
// ========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message:', message.type);

  switch (message.type) {
    case 'TEXT_CAPTURED':
      handleTextCaptured(message.text);
      sendResponse({ success: true });
      break;

    case 'HOTKEY_CHANGED':
      currentHotkey = message.hotkey;
      forwardToGeminiTabs(message);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: true });
  }

  return true;
});

// ========================================
// Text Capture Handler
// ========================================
function handleTextCaptured(text) {
  chrome.storage.local.set({
    lastCapturedText: text,
    lastCapturedTime: Date.now()
  });

  chrome.runtime.sendMessage({
    type: 'TEXT_CAPTURED',
    text: text
  }).catch(() => {
    console.log('[Background] Popup not open, text stored');
  });
}

// ========================================
// Forward to Gemini Tabs
// ========================================
async function forwardToGeminiTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://gemini.google.com/*' });

    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        console.log('[Background] Could not send to tab:', tab.id);
      }
    }
  } catch (e) {
    console.error('[Background] Error forwarding message:', e);
  }
}

// ========================================
// Keep Service Worker Alive
// ========================================
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Service worker started');
});

console.log('[Background] Service worker loaded');
