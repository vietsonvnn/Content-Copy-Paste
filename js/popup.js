/**
 * Gemini Content Writer Assistant - Popup Script
 * Main logic for the extension popup
 */

// ========================================
// Toast Notifications (must be defined early)
// ========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '✕';
  else if (type === 'warning') icon = '⚠';

  toast.innerHTML = `<span class="toast-icon">${icon}</span>${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// ========================================
// State Management
// ========================================
const state = {
  totalTarget: 0,
  commands: [],
  currentCommandIndex: 0,
  parts: [],
  capturedContents: {}, // Store captured content for each part
  settings: {
    hotkey: { ctrl: true, shift: true, alt: false, key: 'C' },
    koreanCountMethod: 'words',
    showToast: true
  }
};

// ========================================
// DOM Elements
// ========================================
const elements = {
  // Header
  resetBtn: document.getElementById('resetBtn'),
  toastContainer: document.getElementById('toastContainer'),

  // Main Tab
  totalWritten: document.getElementById('totalWritten'),
  totalTarget: document.getElementById('totalTarget'),
  totalPercent: document.getElementById('totalPercent'),
  totalProgressBar: document.getElementById('totalProgressBar'),
  totalTargetInput: document.getElementById('totalTargetInput'),
  commandInput: document.getElementById('commandInput'),
  customCommandInput: document.getElementById('customCommandInput'),
  parseCommands: document.getElementById('parseCommands'),
  clearCommands: document.getElementById('clearCommands'),
  commandButtonsCard: document.getElementById('commandButtonsCard'),
  commandButtons: document.getElementById('commandButtons'),
  parsedCount: document.getElementById('parsedCount'),
  clipboardCard: document.getElementById('clipboardCard'),
  clipboardTableWrapper: document.getElementById('clipboardTableWrapper'),
  copyAllBtn: document.getElementById('copyAllBtn'),
  exportBtn: document.getElementById('exportBtn'),
  hotkeyHint: document.getElementById('hotkeyHint'),

  // Hotkey (inline)
  hotkeyRecorder: document.getElementById('hotkeyRecorder'),
  hotkeyDisplay: document.getElementById('hotkeyDisplay'),
  hotkeyRecording: document.getElementById('hotkeyRecording'),

  // Capture Modal
  captureModal: document.getElementById('captureModal'),
  modalPartLabel: document.getElementById('modalPartLabel'),
  closeModal: document.getElementById('closeModal'),
  cancelCapture: document.getElementById('cancelCapture'),
  toggleCapturedText: document.getElementById('toggleCapturedText'),
  modalCapturedContent: document.getElementById('modalCapturedContent'),
  capturedWords: document.getElementById('capturedWords'),
  targetWords: document.getElementById('targetWords'),
  captureProgressBar: document.getElementById('captureProgressBar'),
  captureDiff: document.getElementById('captureDiff'),
  modalTotalWritten: document.getElementById('modalTotalWritten'),
  modalTotalTarget: document.getElementById('modalTotalTarget'),
  modalTotalProgressBar: document.getElementById('modalTotalProgressBar'),
  actionContinue: document.getElementById('actionContinue'),
  actionRewrite: document.getElementById('actionRewrite'),
  actionDone: document.getElementById('actionDone'),

  // View Content Modal
  viewContentModal: document.getElementById('viewContentModal'),
  viewModalPartLabel: document.getElementById('viewModalPartLabel'),
  viewModalWordCount: document.getElementById('viewModalWordCount'),
  viewContentText: document.getElementById('viewContentText'),
  closeViewModal: document.getElementById('closeViewModal'),
  copyAll: document.getElementById('copyAll')
};

// ========================================
// Initialize
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // Check if running as popup window (not extension popup)
  const isPopupWindow = window.innerWidth > 350 || window.innerHeight > 450;
  if (isPopupWindow) {
    document.body.classList.add('popup-window');
  }

  loadState();
  setupEventListeners();
  setupMessageListener();
  renderAll();
});

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
  // Header buttons
  if (elements.resetBtn) {
    elements.resetBtn.addEventListener('click', handleReset);
  }

  // Main Tab
  elements.totalTargetInput.addEventListener('input', handleTotalTargetChange);
  elements.totalTargetInput.addEventListener('change', handleTotalTargetChange);
  elements.parseCommands.addEventListener('click', handleParseCommands);
  elements.clearCommands.addEventListener('click', handleClearCommands);
  elements.copyAllBtn.addEventListener('click', handleCopyAll);
  elements.exportBtn.addEventListener('click', handleExportData);

  // Hotkey (inline)
  if (elements.hotkeyRecorder) {
    elements.hotkeyRecorder.addEventListener('click', startHotkeyRecording);
  }

  // Capture Modal
  elements.closeModal.addEventListener('click', closeModal);
  elements.cancelCapture.addEventListener('click', closeModal);
  elements.captureModal.querySelector('.modal-overlay').addEventListener('click', closeModal);
  elements.toggleCapturedText.addEventListener('click', toggleCapturedTextCollapse);
  elements.actionContinue.addEventListener('click', handleActionContinue);
  elements.actionRewrite.addEventListener('click', handleActionRewrite);
  elements.actionDone.addEventListener('click', handleActionDone);

  // View Content Modal
  if (elements.closeViewModal) {
    elements.closeViewModal.addEventListener('click', closeViewModal);
  }
  if (elements.viewContentModal) {
    const overlay = elements.viewContentModal.querySelector('.modal-overlay');
    if (overlay) overlay.addEventListener('click', closeViewModal);
  }
  if (elements.copyAll) {
    elements.copyAll.addEventListener('click', copyContent);
  }
}

// ========================================
// Reset
// ========================================
function handleReset() {
  if (confirm('Bạn có chắc muốn bắt đầu bài mới? Tất cả dữ liệu hiện tại sẽ bị xóa.')) {
    // Reset state
    state.totalTarget = 0;
    state.commands = [];
    state.currentCommandIndex = 0;
    state.parts = [];
    state.capturedContents = {};

    // Clear form inputs
    elements.totalTargetInput.value = '';
    elements.commandInput.value = '';
    if (elements.customCommandInput) {
      elements.customCommandInput.value = '';
    }

    // Hide cards
    elements.commandButtonsCard.style.display = 'none';
    elements.clipboardCard.style.display = 'none';

    // Save and render
    saveState();
    renderAll();

    showToast('Đã reset! Sẵn sàng cho bài mới.', 'success');
  }
}

// ========================================
// Message Listener (from content script)
// ========================================
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TEXT_CAPTURED') {
      handleTextCaptured(message.text);
      sendResponse({ success: true });
    }
    return true;
  });

  // Also check for stored captured text (if popup was closed)
  chrome.storage.local.get(['lastCapturedText', 'lastCapturedTime'], (data) => {
    if (data.lastCapturedText && data.lastCapturedTime) {
      const timeDiff = Date.now() - data.lastCapturedTime;
      // If captured within last 30 seconds, show it
      if (timeDiff < 30000) {
        handleTextCaptured(data.lastCapturedText);
        // Clear it
        chrome.storage.local.remove(['lastCapturedText', 'lastCapturedTime']);
      }
    }
  });
}

// ========================================
// Commands Handlers
// ========================================
function handleTotalTargetChange(e) {
  state.totalTarget = parseInt(e.target.value) || 0;
  saveState();
  renderProgress();
}

function handleParseCommands() {
  const mainInput = elements.commandInput.value.trim();
  const customInput = elements.customCommandInput ? elements.customCommandInput.value.trim() : '';

  if (!mainInput && !customInput) {
    showToast('Vui lòng nhập ít nhất 1 lệnh!', 'warning');
    return;
  }

  // Sync totalTarget from input field before parsing
  const targetValue = parseInt(elements.totalTargetInput.value) || 0;
  if (targetValue > 0) {
    state.totalTarget = targetValue;
  }

  // Parse main commands
  const mainLines = mainInput ? mainInput.split('\n').filter(line => line.trim()) : [];
  // Parse custom commands (marked as custom)
  const customLines = customInput ? customInput.split('\n').filter(line => line.trim()) : [];

  // Create main commands
  const mainCommands = mainLines.map((line, index) => {
    // Extract part number (e.g., "1", "2", "3.1", "3.2")
    const partMatch = line.match(/phần\s*([\d.]+)/i) || line.match(/part\s*([\d.]+)/i);
    const partNum = partMatch ? partMatch[1] : String(index + 1);

    // Extract word count from command (e.g., "800 từ" or "800 words")
    const wordMatch = line.match(/(\d+)\s*(từ|words?|단어)/i);
    const targetWords = wordMatch ? parseInt(wordMatch[1]) : 500;

    return {
      id: partNum,
      text: line.trim(),
      targetWords: targetWords,
      actualWords: 0,
      status: 'pending',
      content: '',
      isCustom: false // Main command
    };
  });

  // Create custom commands (separate, with different styling)
  const customCommands = customLines.map((line, index) => {
    const wordMatch = line.match(/(\d+)\s*(từ|words?|단어)/i);
    const targetWords = wordMatch ? parseInt(wordMatch[1]) : 200;

    return {
      id: `C${index + 1}`, // Custom ID prefix
      text: line.trim(),
      targetWords: targetWords,
      actualWords: 0,
      status: 'pending',
      content: '',
      isCustom: true // Custom command marker
    };
  });

  // Combine: main commands first, then custom commands
  state.commands = [...mainCommands, ...customCommands];

  // Only main commands create parts for tracking
  state.parts = mainCommands.map(cmd => ({
    id: cmd.id,
    name: `Phần ${cmd.id}`,
    targetWords: cmd.targetWords,
    actualWords: 0,
    status: 'pending',
    content: ''
  }));

  // Set first command as current
  if (state.commands.length > 0) {
    state.currentCommandIndex = 0;
  }

  saveState();
  renderAll();
  showToast(`Đã tạo ${mainCommands.length} lệnh chính + ${customCommands.length} lệnh bổ sung`, 'success');
}

function handleClearCommands() {
  // Only clear command inputs and parsed commands, NOT the content data
  elements.commandInput.value = '';
  if (elements.customCommandInput) {
    elements.customCommandInput.value = '';
  }
  state.commands = [];
  state.currentCommandIndex = 0;
  elements.commandButtonsCard.style.display = 'none';
  // Keep clipboardCard visible if there's content
  // Keep state.parts and state.capturedContents intact
  saveState();
  showToast('Đã xóa danh sách lệnh', 'info');
}

// ========================================
// Command Button Actions
// ========================================
function handleCommandClick(index) {
  const command = state.commands[index];
  if (!command) return;

  state.currentCommandIndex = index;

  // Update command status
  if (command.status === 'pending') {
    command.status = 'in-progress';
    state.parts[index].status = 'in-progress';
  }

  saveState();
  renderCommandButtons();
  renderOutputTable();

  // Send command to content script with auto-enter
  sendCommandToGemini(command.text, true);
}

function sendCommandToGemini(text, autoEnter = true) {
  // Find active Gemini tab only
  chrome.tabs.query({ url: 'https://gemini.google.com/*', active: true }, (activeTabs) => {
    let targetTab = activeTabs && activeTabs.length > 0 ? activeTabs[0] : null;

    // If no active Gemini tab, find any Gemini tab
    if (!targetTab) {
      chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (allGeminiTabs) => {
        if (allGeminiTabs && allGeminiTabs.length > 0) {
          targetTab = allGeminiTabs[0];
          sendToTab(targetTab, text, autoEnter);
        } else {
          showToast('Vui lòng mở trang gemini.google.com trước!', 'warning');
        }
      });
    } else {
      sendToTab(targetTab, text, autoEnter);
    }
  });
}

function sendToTab(tab, text, autoEnter) {
  console.log('[Popup] Sending to tab:', tab.id, text.substring(0, 50));

  chrome.tabs.sendMessage(tab.id, {
    type: 'INJECT_COMMAND',
    text: text,
    autoEnter: autoEnter
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Popup] Error:', chrome.runtime.lastError.message);
      // Try injecting content script manually
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['js/content.js']
      }).then(() => {
        // Retry after injecting
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'INJECT_COMMAND',
            text: text,
            autoEnter: autoEnter
          });
          showToast('Đã gửi lệnh!', 'success');
        }, 500);
      }).catch(err => {
        showToast('Lỗi: Hãy refresh trang Gemini!', 'error');
      });
    } else {
      showToast('Đã gửi lệnh!', 'success');
    }
  });
}

// ========================================
// Text Capture Handler
// ========================================
let capturedText = '';
let capturedWordCount = 0;

function handleTextCaptured(text) {
  capturedText = text;
  capturedWordCount = countWords(text);

  const currentCommand = state.commands[state.currentCommandIndex];
  if (!currentCommand) {
    // No command selected, show toast with word count
    showToast(`Đã capture ${capturedWordCount} từ (chưa chọn phần)`, 'info');
    return;
  }

  // Update modal with captured text
  elements.modalPartLabel.textContent = `Phần ${currentCommand.id}`;
  elements.modalCapturedContent.textContent = text;
  elements.capturedWords.textContent = capturedWordCount;
  elements.targetWords.textContent = currentCommand.targetWords;

  const diff = capturedWordCount - currentCommand.targetWords;
  const diffPercent = ((diff / currentCommand.targetWords) * 100).toFixed(1);

  if (diff >= 0) {
    elements.captureDiff.textContent = `+${diff} từ (+${diffPercent}%)`;
    elements.captureDiff.className = 'capture-diff positive';
  } else {
    elements.captureDiff.textContent = `${diff} từ (${diffPercent}%)`;
    elements.captureDiff.className = 'capture-diff negative';
  }

  // Progress bar for this part
  const partProgress = Math.min((capturedWordCount / currentCommand.targetWords) * 100, 100);
  elements.captureProgressBar.style.width = `${partProgress}%`;

  // Total stats
  const currentTotal = calculateTotalWritten() + capturedWordCount - (currentCommand.actualWords || 0);
  elements.modalTotalWritten.textContent = currentTotal;
  elements.modalTotalTarget.textContent = state.totalTarget;

  const totalProgress = state.totalTarget > 0 ? Math.min((currentTotal / state.totalTarget) * 100, 100) : 0;
  elements.modalTotalProgressBar.style.width = `${totalProgress}%`;

  // Show modal
  openModal();
}

// ========================================
// Modal Actions
// ========================================
function openModal() {
  elements.captureModal.classList.add('active');
}

function closeModal() {
  elements.captureModal.classList.remove('active');
}

function toggleCapturedTextCollapse() {
  const content = elements.modalCapturedContent;
  const btn = elements.toggleCapturedText;

  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    btn.textContent = 'Thu gọn ▲';
  } else {
    content.classList.add('collapsed');
    btn.textContent = 'Mở rộng ▼';
  }
}

function handleActionContinue() {
  const currentCommand = state.commands[state.currentCommandIndex];
  if (!currentCommand) return;

  // Save captured content (accumulate)
  const existingContent = state.capturedContents[currentCommand.id] || '';
  state.capturedContents[currentCommand.id] = existingContent + (existingContent ? '\n\n' : '') + capturedText;

  // Update word count
  currentCommand.actualWords = (currentCommand.actualWords || 0) + capturedWordCount;
  state.parts[state.currentCommandIndex].actualWords = currentCommand.actualWords;
  state.parts[state.currentCommandIndex].content = state.capturedContents[currentCommand.id];

  // Generate continue command
  const remaining = currentCommand.targetWords - currentCommand.actualWords;
  const continueText = `Viết tiếp phần ${currentCommand.id}, bổ sung thêm ${Math.max(remaining, 100)} từ nữa bám sát outline`;

  saveState();
  closeModal();
  renderAll();

  // Send command with auto-enter
  sendCommandToGemini(continueText, true);
}

function handleActionRewrite() {
  const currentCommand = state.commands[state.currentCommandIndex];
  if (!currentCommand) return;

  closeModal();

  // Send original command without auto-enter (user will edit)
  sendCommandToGemini(currentCommand.text, false);
}

function handleActionDone() {
  const currentCommand = state.commands[state.currentCommandIndex];
  if (!currentCommand) return;

  // Save captured content
  const existingContent = state.capturedContents[currentCommand.id] || '';
  state.capturedContents[currentCommand.id] = existingContent + (existingContent ? '\n\n' : '') + capturedText;

  // Mark as done
  currentCommand.actualWords = (currentCommand.actualWords || 0) + capturedWordCount;
  currentCommand.status = 'done';
  currentCommand.content = state.capturedContents[currentCommand.id];

  state.parts[state.currentCommandIndex].actualWords = currentCommand.actualWords;
  state.parts[state.currentCommandIndex].status = 'done';
  state.parts[state.currentCommandIndex].content = state.capturedContents[currentCommand.id];

  // Move to next command
  const nextPendingIndex = state.commands.findIndex((cmd, i) => i > state.currentCommandIndex && cmd.status !== 'done');
  if (nextPendingIndex !== -1) {
    state.currentCommandIndex = nextPendingIndex;
  }

  saveState();
  closeModal();
  renderAll();

  // Show success toast
  showToast(`Phần ${currentCommand.id}: ${capturedWordCount} từ - Hoàn thành!`, 'success');
}

// ========================================
// View Content Modal
// ========================================
let currentViewPartIndex = -1;

function openViewModal(index) {
  const part = state.parts[index];
  if (!part || !part.content) return;

  currentViewPartIndex = index;

  elements.viewModalPartLabel.textContent = `Phần ${part.id}`;
  elements.viewModalWordCount.textContent = `${part.actualWords} từ`;
  // Display with highlighted special characters
  elements.viewContentText.innerHTML = highlightSpecialChars(part.content);

  elements.viewContentModal.classList.add('active');
}

function closeViewModal() {
  elements.viewContentModal.classList.remove('active');
  currentViewPartIndex = -1;
}

function copyContent() {
  const part = state.parts[currentViewPartIndex];
  if (!part || !part.content) return;

  navigator.clipboard.writeText(part.content).then(() => {
    showToast('Đã sao chép!', 'success');
  });
}

// ========================================
// Hotkey Recording
// ========================================
let isRecording = false;

function startHotkeyRecording() {
  if (isRecording) return;

  isRecording = true;
  elements.hotkeyRecorder.classList.add('recording');
  elements.hotkeyDisplay.style.display = 'none';
  elements.hotkeyRecording.style.display = 'flex';

  // Listen for keydown
  document.addEventListener('keydown', recordHotkey);
}

function recordHotkey(e) {
  e.preventDefault();

  // Ignore if only modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return;
  }

  // Check for blocked combinations
  const blockedCombos = [
    { ctrl: true, key: 'C' },
    { ctrl: true, key: 'V' },
    { ctrl: true, key: 'X' },
    { ctrl: true, shift: true, key: 'I' },
    { ctrl: true, shift: true, key: 'J' }
  ];

  const newHotkey = {
    ctrl: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: e.key.toUpperCase()
  };

  const isBlocked = blockedCombos.some(combo => {
    return (combo.ctrl === newHotkey.ctrl) &&
           (combo.shift === newHotkey.shift || !combo.shift) &&
           (combo.key === newHotkey.key);
  });

  if (isBlocked) {
    showToast('Tổ hợp phím này đã bị chặn!', 'error');
    stopRecording();
    return;
  }

  // Must have at least one modifier
  if (!newHotkey.ctrl && !newHotkey.shift && !newHotkey.alt) {
    showToast('Cần có ít nhất Ctrl, Shift hoặc Alt!', 'warning');
    stopRecording();
    return;
  }

  state.settings.hotkey = newHotkey;
  saveState();
  updateHotkeyDisplay();
  stopRecording();

  // Notify background/content script
  notifyHotkeyChange();
}

function stopRecording() {
  isRecording = false;
  elements.hotkeyRecorder.classList.remove('recording');
  elements.hotkeyDisplay.style.display = 'flex';
  elements.hotkeyRecording.style.display = 'none';
  document.removeEventListener('keydown', recordHotkey);
}

function resetHotkey() {
  state.settings.hotkey = { ctrl: true, shift: true, alt: false, key: 'C' };
  saveState();
  updateHotkeyDisplay();
  notifyHotkeyChange();
}

function updateHotkeyDisplay() {
  const { ctrl, shift, alt, key } = state.settings.hotkey;
  const keys = [];

  if (ctrl) keys.push('Ctrl');
  if (shift) keys.push('Shift');
  if (alt) keys.push('Alt');
  keys.push(key);

  // Update inline hotkey display
  if (elements.hotkeyDisplay) {
    elements.hotkeyDisplay.innerHTML = keys.map((k, i) => {
      const html = `<span class="hotkey-key">${k}</span>`;
      return i < keys.length - 1 ? html + '<span class="hotkey-plus">+</span>' : html;
    }).join('');
  }

  // Update hotkey hint in quick guide
  if (elements.hotkeyHint) {
    elements.hotkeyHint.textContent = keys.join('+');
  }
}

function notifyHotkeyChange() {
  chrome.runtime.sendMessage({
    type: 'HOTKEY_CHANGED',
    hotkey: state.settings.hotkey
  });
}

// ========================================
// Word Counting
// ========================================
function countWords(text) {
  if (!text || !text.trim()) return 0;

  // Detect language and count accordingly
  const koreanRegex = /[\uAC00-\uD7AF]/;
  const hasKorean = koreanRegex.test(text);

  if (hasKorean && state.settings.koreanCountMethod === 'chars') {
    // Count Korean characters
    const koreanChars = text.match(/[\uAC00-\uD7AF]/g) || [];
    const otherWords = text.replace(/[\uAC00-\uD7AF]/g, ' ').trim().split(/\s+/).filter(w => w.length > 0);
    return koreanChars.length + otherWords.length;
  } else {
    // Count by spaces (works for both Korean 어절 and other languages)
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

function calculateTotalWritten() {
  return state.parts.reduce((sum, part) => sum + (part.actualWords || 0), 0);
}

// ========================================
// Copy All / Export
// ========================================
function handleCopyAll() {
  // Copy only pure content, no headers or metadata
  const allContent = state.parts
    .filter(p => p.content)
    .map(p => p.content.trim())
    .join('\n\n');

  if (!allContent) {
    showToast('Chưa có nội dung để sao chép!', 'warning');
    return;
  }

  navigator.clipboard.writeText(allContent).then(() => {
    showToast('Đã sao chép tất cả!', 'success');
  });
}

// Settings are simplified - only hotkey matters now

function handleExportData() {
  // Export as plain text - only pure content, no headers or metadata
  const partsWithContent = state.parts.filter(p => p.content);

  if (partsWithContent.length === 0) {
    showToast('Chưa có nội dung để xuất!', 'warning');
    return;
  }

  // Build text content - only the actual content from each part
  const textContent = partsWithContent
    .map(part => part.content.trim())
    .join('\n\n');

  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `content-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();

  URL.revokeObjectURL(url);
  showToast('Đã xuất file!', 'success');
}

function handleResetAll() {
  if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu?')) {
    chrome.storage.local.clear(() => {
      location.reload();
    });
  }
}

// ========================================
// Rendering
// ========================================
function renderAll() {
  renderProgress();
  renderCommandButtons();
  renderClipboardTable();
  updateHotkeyDisplay();
}

function renderProgress() {
  const totalWritten = calculateTotalWritten();
  const totalTarget = state.totalTarget || 0;
  const percent = totalTarget > 0 ? Math.min((totalWritten / totalTarget) * 100, 100) : 0;

  elements.totalWritten.textContent = totalWritten.toLocaleString();
  elements.totalTarget.textContent = totalTarget.toLocaleString();
  elements.totalPercent.textContent = `${percent.toFixed(1)}%`;
  elements.totalProgressBar.style.width = `${percent}%`;
}

function renderCommandButtons() {
  if (state.commands.length === 0) {
    elements.commandButtonsCard.style.display = 'none';
    return;
  }

  elements.commandButtonsCard.style.display = 'block';

  // Separate main and custom commands
  const mainCommands = state.commands.filter(cmd => !cmd.isCustom);
  const customCommands = state.commands.filter(cmd => cmd.isCustom);

  elements.parsedCount.textContent = `${mainCommands.length} chính + ${customCommands.length} bổ sung`;

  // Render main commands
  const mainButtonsHTML = mainCommands.map((cmd, i) => {
    const index = state.commands.indexOf(cmd);
    return renderCommandButton(cmd, index);
  }).join('');

  // Render custom commands (with separator if exists)
  const customButtonsHTML = customCommands.length > 0 ? `
    <div class="cmd-separator">
      <span class="cmd-separator-text">✨ Bổ sung</span>
    </div>
    ${customCommands.map((cmd, i) => {
      const index = state.commands.indexOf(cmd);
      return renderCommandButton(cmd, index, true);
    }).join('')}
  ` : '';

  elements.commandButtons.innerHTML = mainButtonsHTML + customButtonsHTML;

  // Add click listeners
  elements.commandButtons.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleCommandClick(parseInt(btn.dataset.index));
    });
  });
}

// Helper function to render a single command button
function renderCommandButton(cmd, index, isCustom = false) {
  let statusClass = '';
  let statusIcon = '';

  if (cmd.status === 'done') {
    statusClass = 'done';
    statusIcon = '<span class="cmd-btn-status">✓</span>';
  } else if (cmd.status === 'in-progress') {
    statusClass = 'in-progress';
    statusIcon = '<span class="cmd-btn-status">◐</span>';
  }

  const isActive = index === state.currentCommandIndex ? 'active' : '';
  const customClass = isCustom ? 'cmd-btn-custom' : '';

  return `
    <button class="cmd-btn ${statusClass} ${isActive} ${customClass}" data-index="${index}" title="${cmd.text}">
      ${statusIcon}
      <span class="cmd-btn-num">${cmd.id}</span>
      <span class="cmd-btn-words">${cmd.targetWords}w</span>
    </button>
  `;
}

function renderClipboardTable() {
  if (state.parts.length === 0) {
    elements.clipboardCard.style.display = 'none';
    return;
  }

  elements.clipboardCard.style.display = 'block';

  // Generate tabs navigation
  const tabsNav = state.parts.map((part, index) => {
    let statusIcon = '○';
    let statusClass = 'pending';

    if (part.status === 'done') {
      statusIcon = '✓';
      statusClass = 'done';
    } else if (part.status === 'in-progress') {
      statusIcon = '◐';
      statusClass = 'in-progress';
    }

    const isActive = index === state.currentCommandIndex;
    const hasContent = part.content && part.content.length > 0;

    return `
      <button class="content-tab ${isActive ? 'active' : ''} ${statusClass}"
              data-index="${index}"
              title="Phần ${part.id} - ${part.actualWords || 0}/${part.targetWords} từ">
        <span class="tab-status">${statusIcon}</span>
        <span class="tab-label">${part.id}</span>
        ${hasContent ? '<span class="tab-dot"></span>' : ''}
      </button>
    `;
  }).join('');

  // Generate tab content for current part
  const currentPart = state.parts[state.currentCommandIndex];
  const hasContent = currentPart && currentPart.content && currentPart.content.length > 0;
  const wordDiff = hasContent ? currentPart.actualWords - currentPart.targetWords : 0;
  const diffClass = wordDiff >= 0 ? 'positive' : 'negative';
  const diffText = wordDiff >= 0 ? `+${wordDiff}` : `${wordDiff}`;

  const tabContent = currentPart ? `
    <div class="content-tab-panel">
      <div class="tab-panel-header">
        <div class="tab-panel-info">
          <span class="tab-panel-title">📝 Phần ${currentPart.id}</span>
          <span class="tab-panel-target">(Target: ${currentPart.targetWords} từ)</span>
        </div>
        <div class="tab-panel-stats">
          <span class="word-count ${hasContent ? diffClass : ''}">${currentPart.actualWords || 0}/${currentPart.targetWords}</span>
          ${hasContent ? `<span class="word-diff ${diffClass}">(${diffText})</span>` : ''}
          <button class="btn-icon-sm" data-action="copy" data-index="${state.currentCommandIndex}" title="Sao chép">📋</button>
        </div>
      </div>
      <div class="capture-indicator">
        <span class="capture-dot"></span>
        <span>Capture sẽ lưu vào phần này</span>
      </div>
      <textarea class="content-textarea" data-index="${state.currentCommandIndex}"
                placeholder="Nội dung phần ${currentPart.id} sẽ hiển thị ở đây...&#10;&#10;• Bôi đen text trên Gemini&#10;• Nhấn hotkey để capture&#10;• Hoặc paste trực tiếp vào đây">${escapeHtml(currentPart.content || '')}</textarea>
    </div>
  ` : '<div class="content-tab-panel-empty">Chọn một phần để xem nội dung</div>';

  elements.clipboardTableWrapper.innerHTML = `
    <div class="content-tabs-nav">${tabsNav}</div>
    ${tabContent}
  `;

  // Add event listeners
  setupClipboardTableListeners();
}

// Debounce helper
let saveDebounceTimers = {};

function setupClipboardTableListeners() {
  // Tab click - switch to different part
  elements.clipboardTableWrapper.querySelectorAll('.content-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const index = parseInt(tab.dataset.index);
      if (index !== state.currentCommandIndex) {
        state.currentCommandIndex = index;
        saveState();
        renderClipboardTable();
        renderCommandButtons();
        showToast(`Đã chuyển sang Phần ${state.parts[index].id}`, 'info');
      }
    });
  });

  // Copy button
  elements.clipboardTableWrapper.querySelectorAll('[data-action="copy"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      const part = state.parts[index];
      if (part && part.content) {
        navigator.clipboard.writeText(part.content).then(() => {
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = '📋', 1000);
          showToast('Đã sao chép!', 'success');
        });
      } else {
        showToast('Chưa có nội dung để sao chép', 'warning');
      }
    });
  });

  // Auto-save on textarea input (debounced)
  const textarea = elements.clipboardTableWrapper.querySelector('.content-textarea');
  if (textarea) {
    textarea.addEventListener('input', () => {
      const index = parseInt(textarea.dataset.index);

      // Clear existing timer
      if (saveDebounceTimers[index]) {
        clearTimeout(saveDebounceTimers[index]);
      }

      // Debounce save (500ms after user stops typing)
      saveDebounceTimers[index] = setTimeout(() => {
        const newContent = textarea.value;
        state.parts[index].content = newContent;
        state.parts[index].actualWords = countWords(newContent);
        state.capturedContents[state.parts[index].id] = newContent;
        saveState();

        // Update stats in header
        const panel = textarea.closest('.content-tab-panel');
        const wordCount = panel.querySelector('.word-count');
        const wordDiff = panel.querySelector('.word-diff');
        const diff = state.parts[index].actualWords - state.parts[index].targetWords;

        if (wordCount) {
          wordCount.textContent = `${state.parts[index].actualWords}/${state.parts[index].targetWords}`;
          wordCount.className = `word-count ${newContent ? (diff >= 0 ? 'positive' : 'negative') : ''}`;
        }

        if (wordDiff) {
          wordDiff.textContent = newContent ? `(${diff >= 0 ? '+' : ''}${diff})` : '';
          wordDiff.className = `word-diff ${diff >= 0 ? 'positive' : 'negative'}`;
        } else if (newContent && diff !== 0) {
          const stats = panel.querySelector('.tab-panel-stats');
          const diffSpan = document.createElement('span');
          diffSpan.className = `word-diff ${diff >= 0 ? 'positive' : 'negative'}`;
          diffSpan.textContent = `(${diff >= 0 ? '+' : ''}${diff})`;
          stats.insertBefore(diffSpan, stats.querySelector('[data-action="copy"]'));
        }

        // Update tab indicator
        const currentTab = elements.clipboardTableWrapper.querySelector(`.content-tab[data-index="${index}"]`);
        if (currentTab && newContent && !currentTab.querySelector('.tab-dot')) {
          const dot = document.createElement('span');
          dot.className = 'tab-dot';
          currentTab.appendChild(dot);
        }

        renderProgress();
      }, 500);
    });
  }
}

// Highlight special characters that cause voice reading errors
function highlightSpecialChars(text) {
  if (!text) return '';

  // Process character by character to avoid regex issues
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const escaped = char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char;

    // Error characters: 0, 1, ', ` (red bold)
    if (char === '0' || char === '1' || char === "'" || char === '`') {
      result += `<span class="char-error">${escaped}</span>`;
    }
    // Warning characters: ?, - (yellow)
    else if (char === '?' || char === '-') {
      result += `<span class="char-warning">${escaped}</span>`;
    }
    else {
      result += escaped;
    }
  }

  return result;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// renderSettings removed - simplified UI

// ========================================
// Storage
// ========================================
function saveState() {
  chrome.storage.local.set({
    totalTarget: state.totalTarget,
    commands: state.commands,
    currentCommandIndex: state.currentCommandIndex,
    parts: state.parts,
    capturedContents: state.capturedContents,
    settings: state.settings
  });
}

function loadState() {
  chrome.storage.local.get([
    'totalTarget',
    'commands',
    'currentCommandIndex',
    'parts',
    'capturedContents',
    'settings'
  ], (data) => {
    if (data.totalTarget !== undefined) state.totalTarget = data.totalTarget;
    if (data.commands) state.commands = data.commands;
    if (data.currentCommandIndex !== undefined) state.currentCommandIndex = data.currentCommandIndex;
    if (data.parts) state.parts = data.parts;
    if (data.capturedContents) state.capturedContents = data.capturedContents;
    if (data.settings) state.settings = { ...state.settings, ...data.settings };

    // Update form values from state
    elements.totalTargetInput.value = state.totalTarget || '';

    // Restore command input if commands exist
    if (state.commands.length > 0) {
      elements.commandInput.value = state.commands.map(cmd => cmd.text).join('\n');
    }

    // Sync input value to state if user already entered value before load
    const inputValue = parseInt(elements.totalTargetInput.value) || 0;
    if (inputValue > 0 && state.totalTarget === 0) {
      state.totalTarget = inputValue;
      saveState();
    }

    renderAll();
  });
}
