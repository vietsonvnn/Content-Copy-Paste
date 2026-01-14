/**
 * Gemini Content Writer Assistant - Background Service Worker
 * Handles message routing, hotkey management, and window management
 */

// ========================================
// State
// ========================================
let currentHotkey = { ctrl: true, shift: true, alt: false, key: 'g' };

// ========================================
// Initialize
// ========================================
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed:', details.reason);

  if (details.reason === 'install') {
    chrome.storage.local.set({
      settings: {
        hotkey: { ctrl: true, shift: true, alt: false, key: 'g' },
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

// Popup is now handled via default_popup in manifest.json

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

    case 'INJECT_TO_GEMINI':
      // Handle injection request from popup window
      handleInjectToGemini(message.text, message.autoEnter)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response

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
// Inject Command to Gemini Tab
// ========================================
async function handleInjectToGemini(text, autoEnter) {
  console.log('[Background] Handling inject to Gemini:', text.substring(0, 50));

  try {
    // Find all Gemini tabs - try multiple URL patterns
    let geminiTabs = await chrome.tabs.query({ url: 'https://gemini.google.com/*' });

    // If not found, try without wildcard
    if (!geminiTabs || geminiTabs.length === 0) {
      geminiTabs = await chrome.tabs.query({});
      geminiTabs = geminiTabs.filter(tab => tab.url && tab.url.includes('gemini.google.com'));
      console.log('[Background] Found tabs via filter:', geminiTabs.length);
    }

    if (!geminiTabs || geminiTabs.length === 0) {
      console.log('[Background] No Gemini tab found');
      return { success: false, error: 'Vui lòng mở trang gemini.google.com trước!' };
    }

    // Prefer active tab, or use the first one
    let targetTab = geminiTabs.find(tab => tab.active) || geminiTabs[0];
    console.log('[Background] Target tab:', targetTab.id, targetTab.url);

    // Direct injection using executeScript (more reliable)
    console.log('[Background] Injecting directly via executeScript');

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: (textToInject, shouldAutoEnter) => {
          console.log('[CW-Inject] ========== STARTING INJECTION ==========');
          console.log('[CW-Inject] Text:', textToInject.substring(0, 50));
          console.log('[CW-Inject] Window size:', window.innerWidth, 'x', window.innerHeight);

          // Log ALL contenteditable elements first
          const allEditable = document.querySelectorAll('[contenteditable="true"]');
          console.log('[CW-Inject] Total contenteditable elements:', allEditable.length);
          allEditable.forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            console.log(`[CW-Inject] #${i}:`, {
              tag: el.tagName,
              class: el.className.substring(0, 50),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              visible: rect.width > 0 && rect.height > 0
            });
          });

          // Find input element - Try simpler approach first
          let input = null;

          // Method 1: Find .ql-editor (Quill editor used by Gemini)
          const qlEditors = document.querySelectorAll('.ql-editor');
          console.log('[CW-Inject] Found .ql-editor elements:', qlEditors.length);
          for (const el of qlEditors) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 10) {
              input = el;
              console.log('[CW-Inject] Using .ql-editor');
              break;
            }
          }

          // Method 2: Any contenteditable that's visible
          if (!input) {
            for (const el of allEditable) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 100 && rect.height > 20) {
                input = el;
                console.log('[CW-Inject] Using first visible contenteditable');
                break;
              }
            }
          }

          if (!input) {
            console.error('[CW-Inject] NO INPUT FOUND!');
            return { success: false, error: 'Không tìm thấy ô nhập! Hãy click vào ô chat trước.' };
          }

          console.log('[CW-Inject] Selected input:', input.tagName, input.className);

          // INJECT TEXT
          try {
            // Focus the input
            input.focus();
            console.log('[CW-Inject] Focused input');

            // Method A: Try execCommand first
            document.execCommand('selectAll', false, null);
            const inserted = document.execCommand('insertText', false, textToInject);
            console.log('[CW-Inject] execCommand insertText result:', inserted);

            if (!inserted) {
              // Method B: Direct text manipulation
              console.log('[CW-Inject] execCommand failed, trying direct manipulation');

              // For Quill editor, we need to work with its internal structure
              if (input.classList.contains('ql-editor')) {
                // Clear and set via innerHTML with a paragraph
                while (input.firstChild) {
                  input.removeChild(input.firstChild);
                }
                const p = document.createElement('p');
                p.textContent = textToInject;
                input.appendChild(p);
                console.log('[CW-Inject] Set via innerHTML for Quill');
              } else {
                input.textContent = textToInject;
              }
            }

            // Dispatch events
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

            // Also try dispatching on parent elements
            if (input.parentElement) {
              input.parentElement.dispatchEvent(new Event('input', { bubbles: true }));
            }

            console.log('[CW-Inject] Events dispatched');
            console.log('[CW-Inject] Current input content:', input.textContent.substring(0, 50));

          } catch (injectErr) {
            console.error('[CW-Inject] Injection error:', injectErr);
            return { success: false, error: 'Lỗi inject: ' + injectErr.message };
          }

          // Auto send if requested
          if (shouldAutoEnter) {
            setTimeout(() => {
              console.log('[CW-Inject] Looking for send button...');

              // Find send button - look for button near input area
              const buttons = document.querySelectorAll('button:not([disabled])');
              console.log('[CW-Inject] Found', buttons.length, 'enabled buttons');

              let sendBtn = null;

              // Try aria-label first
              sendBtn = document.querySelector('button[aria-label*="Send" i]:not([disabled])') ||
                        document.querySelector('button[aria-label*="Gửi" i]:not([disabled])');

              if (!sendBtn) {
                // Find button with send icon (arrow) near bottom
                for (const btn of buttons) {
                  const rect = btn.getBoundingClientRect();
                  // Button should be visible and in lower half of screen
                  if (rect.width > 20 && rect.height > 20 && rect.top > window.innerHeight * 0.4) {
                    const svg = btn.querySelector('svg');
                    if (svg) {
                      sendBtn = btn;
                      console.log('[CW-Inject] Found button with SVG at bottom');
                      break;
                    }
                  }
                }
              }

              if (sendBtn) {
                console.log('[CW-Inject] Clicking send button');
                sendBtn.click();
              } else {
                console.log('[CW-Inject] No send button found');
              }
            }, 500);
          }

          return { success: true };
        },
        args: [text, autoEnter]
      });

      console.log('[Background] ExecuteScript results:', results);
      return results[0]?.result || { success: true };

    } catch (execError) {
      console.error('[Background] ExecuteScript error:', execError);
      return { success: false, error: 'Lỗi: ' + execError.message };
    }

  } catch (error) {
    console.error('[Background] handleInjectToGemini error:', error);
    return { success: false, error: 'Lỗi: ' + error.message };
  }
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
