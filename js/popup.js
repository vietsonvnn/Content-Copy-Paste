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
  totalTarget: 5000, // Default 5000 words
  numParts: 9, // Default 9 parts
  title: '',
  sampleContent: '', // Content from uploaded file
  sampleFileName: '', // Original file name
  currentFlowStep: 0,
  flowSteps: {}, // Track status of each step (pending, done)
  flowClickCounts: {}, // Track how many times each button was clicked
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
// Flow Commands Configuration
// ========================================
const FLOW_COMMANDS = {
  // Stage 1: Khởi đầu
  0: 'Xin chào bạn',

  // Stage 2: Setup bài viết
  1: 'Tôi có tiêu đề này: {TITLE}',
  2: 'trước khi bắt đầu viết tôi muốn bạn hãy dùng những nội dung chính trong bài viết sau để viết lại nội dung mới hay hơn, tạo sự cấp bách và thu hút khán giả có vấn đề đang mắc phải: "{SAMPLE_CONTENT}"',
  3: 'tôi chưa yêu cầu bạn viết, hãy làm lần lượt theo đúng yêu cầu của tôi, tôi muốn bạn đọc lại 1 lần nữa bài mẫu tôi vừa gửi và nắm trọn các ý chính',
  4: 'Cho tôi biết trước khi lập outline 9 phần thì nội dung trên bạn sẽ áp dụng văn phong và kỹ thuật viết dạng mấy? khung trắng 9 phần dạng mấy? và mở đầu dạng nào?',
  5: 'trong bài viết mẫu tôi gửi trên có nhắc đến tên bác sĩ hay tên nhân vật nào khác không. Nếu có hãy liệt kê tên bác sĩ: {DOCTOR_NAME}',

  // Stage 3: Outline
  6: 'ok, hãy lập outline 9 phần dựa trên tất cả những thông tin và kiến thức bạn có về nội dung trên và trong dự án này',
  7: 'Thêm cho tôi yếu tố {SEASON} vào bài viết trên',
  8: 'dựa vào Dàn Ý Kịch Bản Chi Tiết (Outline 9 Phần), gợi ý cho tôi số lượng từ mỗi phần tương ứng để tổng số lượng từ tiếng Hàn đạt {TOTAL} từ',

  // Stage 4: Viết nội dung (9-17 = Part 1-9)
  9: 'Viết phần 1 bám sát tài liệu bài viết mẫu bên trên. Viết đủ {WORDS_P1} từ có mở đầu tương tự bài viết mẫu bên trên. Nội dung được viết bằng tiếng Hàn, xưng hô "tôi" (저/제) và gọi khán giả là "bạn/các bạn" (여러분), phù hợp với văn hóa Hàn Quốc và các quy định của YouTube. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  10: 'Viết phần 2 bám sát tài liệu bài viết mẫu bên trên, viết đủ {WORDS_P2} từ. Không viết trên canvas. Tiếp nối phần 1, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  11: 'Viết phần 3 bám sát tài liệu bài viết mẫu bên trên, viết đủ {WORDS_P3} từ. Không viết trên canvas. Tiếp nối phần 2, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  12: 'Viết phần 4 bám sát tài liệu bài viết mẫu bên trên, viết đủ {WORDS_P4} từ. Không viết trên canvas. Tiếp nối phần 3, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  13: 'Viết phần 5 bám sát tài liệu bài viết mẫu bên trên, viết đủ {WORDS_P5} từ. Không viết trên canvas. Tiếp nối phần 4, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  14: 'Viết phần 6 bám sát tài liệu bài viết mẫu bên trên, viết đủ {WORDS_P6} từ. Không viết trên canvas. Tiếp nối phần 5, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  15: 'Viết phần 7 bám sát tài liệu bài viết mẫu bên trên, viết đủ {WORDS_P7} từ. Không viết trên canvas. Tiếp nối phần 6, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  16: 'Viết phần 8 bám sát tài liệu bài viết mẫu bên trên, viết đủ {WORDS_P8} từ. Không viết trên canvas. Tiếp nối phần 7, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',
  17: 'Viết phần 9 Kết thúc Part 9 thật trọn vẹn theo đúng outline (đóng vòng cung đầy đủ, đưa ra lời khuyên cuối cùng để câu chuyện khép lại xúc động) bám sát tài liệu bài viết mẫu bên trên đủ {WORDS_P9} từ không bao gồm dấu cách. Không viết trên canvas. Tiếp nối phần 8, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm',

  // Stage 5: Hoàn thành
  18: 'Kiểm tra lại xem toàn bộ nội dung của bài viết trên tính đồng nhất và liên kết mạch hay không? Có nội dung nào bất hợp lý phi thực tế không? Kiểm tra lại xem đã đúng ngữ pháp Hàn cho người nghe chưa? Nếu có đoạn nào bất hợp lí mà nội dung có sai sự thật hay đề xuất.'
};

// Default word counts for each part
const DEFAULT_WORD_COUNTS = {
  P1: 230,
  P2: 800,
  P3: 800,
  P4: 800,
  P5: 800,
  P6: 800,
  P7: 800,
  P8: 800,
  P9: 500
};

// Current word counts (can be modified by user)
let wordCounts = { ...DEFAULT_WORD_COUNTS };

// Current selected part for content clipboard (1-indexed)
let currentContentPart = 1;

// Step labels for editor
const STEP_LABELS = {
  0: 'Chào hỏi',
  1: 'Nhập tiêu đề',
  2: 'Bài mẫu đối thủ',
  3: 'Yêu cầu đọc lại',
  4: 'Hỏi văn phong',
  5: 'Hỏi tên bác sĩ',
  6: 'Lập outline',
  7: 'Thêm yếu tố mùa',
  8: 'Phân bổ số từ',
  9: 'Viết phần 1',
  10: 'Viết phần 2',
  11: 'Viết phần 3',
  12: 'Viết phần 4',
  13: 'Viết phần 5',
  14: 'Viết phần 6',
  15: 'Viết phần 7',
  16: 'Viết phần 8',
  17: 'Viết phần 9',
  18: 'Kiểm tra cuối'
};

// ========================================
// DOM Elements
// ========================================
const elements = {
  // Header
  popoutBtn: document.getElementById('popoutBtn'),
  resetBtn: document.getElementById('resetBtn'),
  toastContainer: document.getElementById('toastContainer'),

  // Main Tab
  totalWritten: document.getElementById('totalWritten'),
  totalTarget: document.getElementById('totalTarget'),
  totalPercent: document.getElementById('totalPercent'),
  totalProgressBar: document.getElementById('totalProgressBar'),
  totalTargetInput: document.getElementById('totalTargetInput'),
  numPartsInput: document.getElementById('numPartsInput'),
  titleInput: document.getElementById('titleInput'),

  // File Browse
  sampleFileInput: document.getElementById('sampleFileInput'),
  browseFileBtn: document.getElementById('browseFileBtn'),
  fileName: document.getElementById('fileName'),
  clearFileBtn: document.getElementById('clearFileBtn'),

  // Dynamic containers
  partButtonsContainer: document.getElementById('partButtonsContainer'),
  wordEditGrid: document.getElementById('wordEditGrid'),
  stage3Title: document.getElementById('stage3Title'),

  // Flow Commands
  flowCard: document.getElementById('flowCard'),
  flowStatus: document.getElementById('flowStatus'),

  // Command Editor
  commandEditorCard: document.getElementById('commandEditorCard'),
  editorStepLabel: document.getElementById('editorStepLabel'),
  commandEditor: document.getElementById('commandEditor'),
  closeEditor: document.getElementById('closeEditor'),
  resetCommand: document.getElementById('resetCommand'),
  sendCommand: document.getElementById('sendCommand'),

  // Legacy (for compatibility)
  clipboardCard: document.getElementById('clipboardCard'),
  clipboardTableWrapper: document.getElementById('clipboardTableWrapper'),
  copyAllBtn: document.getElementById('copyAllBtn'),
  exportBtn: document.getElementById('exportBtn'),
  hotkeyHint: document.getElementById('hotkeyHint'),

  // Hotkey (inline)
  hotkeyRecorder: document.getElementById('hotkeyRecorder'),
  hotkeyDisplay: document.getElementById('hotkeyDisplay'),
  hotkeyRecording: document.getElementById('hotkeyRecording'),

  // Word Count Summary & Modal
  wordsSummaryBar: document.getElementById('wordsSummaryBar'),
  wordsSummaryText: document.getElementById('wordsSummaryText'),
  wordsSummaryTotal: document.getElementById('wordsSummaryTotal'),
  wordCountModal: document.getElementById('wordCountModal'),
  closeWordCountModal: document.getElementById('closeWordCountModal'),
  cancelWordCount: document.getElementById('cancelWordCount'),
  saveWordCount: document.getElementById('saveWordCount'),
  wordEditTotal: document.getElementById('wordEditTotal'),

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
  copyAll: document.getElementById('copyAll'),

  // Content Clipboard Section
  contentClipboardCard: document.getElementById('contentClipboardCard'),
  partTabs: document.getElementById('partTabs'),
  contentEditorWrapper: document.getElementById('contentEditorWrapper'),
  editorPartLabel: document.getElementById('editorPartLabel'),
  editorWords: document.getElementById('editorWords'),
  editorTarget: document.getElementById('editorTarget'),
  editorDiff: document.getElementById('editorDiff'),
  contentEditorTextarea: document.getElementById('contentEditorTextarea'),

  // Full Screen Editor
  openFullscreenBtn: document.getElementById('openFullscreenBtn'),
  fullscreenEditorModal: document.getElementById('fullscreenEditorModal'),
  closeFullscreenEditor: document.getElementById('closeFullscreenEditor'),
  fsCopyAll: document.getElementById('fsCopyAll'),
  fsEditorTotalWritten: document.getElementById('fsEditorTotalWritten'),
  fsEditorTotalTarget: document.getElementById('fsEditorTotalTarget'),
  fsEditorPercent: document.getElementById('fsEditorPercent'),
  fsPartTabs: document.getElementById('fsPartTabs'),
  fsPartLabel: document.getElementById('fsPartLabel'),
  fsWords: document.getElementById('fsWords'),
  fsTarget: document.getElementById('fsTarget'),
  fsDiff: document.getElementById('fsDiff'),
  fsTextarea: document.getElementById('fsTextarea')
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
  if (elements.popoutBtn) {
    elements.popoutBtn.addEventListener('click', handlePopout);
  }
  if (elements.resetBtn) {
    elements.resetBtn.addEventListener('click', handleReset);
  }

  // Main Tab
  elements.totalTargetInput.addEventListener('input', handleTotalTargetChange);
  elements.totalTargetInput.addEventListener('change', handleTotalTargetChange);

  // Title input
  if (elements.titleInput) {
    elements.titleInput.addEventListener('input', handleTitleChange);
    elements.titleInput.addEventListener('change', handleTitleChange);
  }

  // Number of parts input
  if (elements.numPartsInput) {
    elements.numPartsInput.addEventListener('change', handleNumPartsChange);
  }

  // File browse
  if (elements.browseFileBtn) {
    elements.browseFileBtn.addEventListener('click', () => elements.sampleFileInput.click());
  }
  if (elements.sampleFileInput) {
    elements.sampleFileInput.addEventListener('change', handleFileSelect);
  }
  if (elements.clearFileBtn) {
    elements.clearFileBtn.addEventListener('click', handleFileClear);
  }

  // Accordion headers
  setupAccordionListeners();

  // Word count summary bar
  if (elements.wordsSummaryBar) {
    elements.wordsSummaryBar.addEventListener('click', openWordCountModal);
  }

  // Word count modal
  if (elements.closeWordCountModal) {
    elements.closeWordCountModal.addEventListener('click', closeWordCountModal);
  }
  if (elements.cancelWordCount) {
    elements.cancelWordCount.addEventListener('click', closeWordCountModal);
  }
  if (elements.saveWordCount) {
    elements.saveWordCount.addEventListener('click', saveWordCounts);
  }
  if (elements.wordCountModal) {
    elements.wordCountModal.querySelector('.modal-overlay').addEventListener('click', closeWordCountModal);
  }

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePreset(btn.dataset.preset));
  });

  // Flow buttons
  setupFlowButtonListeners();

  // Command Editor
  if (elements.closeEditor) {
    elements.closeEditor.addEventListener('click', closeCommandEditor);
  }
  if (elements.resetCommand) {
    elements.resetCommand.addEventListener('click', resetCurrentCommand);
  }
  if (elements.sendCommand) {
    elements.sendCommand.addEventListener('click', sendEditorCommand);
  }

  // Legacy handlers
  if (elements.copyAllBtn) elements.copyAllBtn.addEventListener('click', handleCopyAll);
  if (elements.exportBtn) elements.exportBtn.addEventListener('click', handleExportData);

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

  // Content Clipboard Editor
  setupContentEditorListeners();

  // Full Screen Editor
  if (elements.openFullscreenBtn) {
    elements.openFullscreenBtn.addEventListener('click', openFullscreenEditor);
  }
  if (elements.closeFullscreenEditor) {
    elements.closeFullscreenEditor.addEventListener('click', closeFullscreenEditor);
  }
  if (elements.fullscreenEditorModal) {
    const overlay = elements.fullscreenEditorModal.querySelector('.modal-overlay');
    if (overlay) overlay.addEventListener('click', closeFullscreenEditor);
  }
  if (elements.fsCopyAll) {
    elements.fsCopyAll.addEventListener('click', handleCopyAll);
  }
}

// ========================================
// Popout to Window
// ========================================
function handlePopout() {
  // Open popup.html in a new window
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 400,
    height: 700,
    focused: true
  }, () => {
    // Close current popup
    window.close();
  });
}

// ========================================
// Reset
// ========================================
function handleReset() {
  if (confirm('Bạn có chắc muốn bắt đầu bài mới? Tất cả dữ liệu hiện tại sẽ bị xóa.')) {
    // Reset state
    state.totalTarget = 5000;
    state.numParts = 9;
    state.title = '';
    state.sampleContent = '';
    state.sampleFileName = '';
    state.currentFlowStep = 0;
    state.flowSteps = {};
    state.flowClickCounts = {};
    state.commands = [];
    state.currentCommandIndex = 0;
    state.parts = [];
    state.capturedContents = {};

    // Reset word counts
    recalculateWordCounts();

    // Clear form inputs
    elements.totalTargetInput.value = '5000';
    if (elements.numPartsInput) elements.numPartsInput.value = '9';
    if (elements.titleInput) elements.titleInput.value = '';

    // Clear file input
    if (elements.sampleFileInput) elements.sampleFileInput.value = '';
    if (elements.fileName) {
      elements.fileName.textContent = 'Chưa chọn file';
      elements.fileName.classList.remove('has-file');
      elements.fileName.title = '';
    }
    if (elements.clearFileBtn) elements.clearFileBtn.style.display = 'none';

    // Hide cards
    if (elements.clipboardCard) elements.clipboardCard.style.display = 'none';

    // Reset stage classes
    document.querySelectorAll('.stage-accordion').forEach(el => {
      el.classList.remove('completed', 'expanded');
    });
    document.querySelectorAll('.stage-status-icon').forEach(el => {
      el.textContent = '○';
      el.classList.remove('done', 'in-progress');
    });
    document.querySelectorAll('.accordion-header').forEach(el => {
      el.classList.remove('active');
    });
    document.querySelectorAll('.accordion-content').forEach(el => {
      el.classList.remove('active');
    });

    // Expand stage 3 by default
    const stage3 = document.getElementById('stage3Accordion');
    const stage3Content = document.getElementById('stage3Content');
    const stage3Header = stage3?.querySelector('.accordion-header');
    if (stage3) stage3.classList.add('expanded');
    if (stage3Content) stage3Content.classList.add('active');
    if (stage3Header) stage3Header.classList.add('active');

    // Save and render
    saveState();
    renderAll();

    showToast('Đã reset! Sẵn sàng cho bài mới.', 'success');
  }
}

// ========================================
// Title Handler
// ========================================
function handleTitleChange(e) {
  state.title = e.target.value.trim();
  saveState();
}

// ========================================
// Number of Parts Handler
// ========================================
function handleNumPartsChange(e) {
  const newNumParts = parseInt(e.target.value) || 9;
  if (newNumParts < 3 || newNumParts > 20) {
    showToast('Số phần phải từ 3 đến 20', 'warning');
    e.target.value = state.numParts;
    return;
  }

  state.numParts = newNumParts;

  // Reset currentContentPart if it exceeds new number of parts
  if (currentContentPart > newNumParts) {
    currentContentPart = 1;
  }

  // Recalculate word counts for new number of parts
  recalculateWordCounts();

  // Regenerate UI
  renderPartButtons();
  updateWordsSummaryBar();
  updateStageProgress();
  renderContentClipboard(); // Update content clipboard tabs
  saveState();

  showToast(`Đã đổi thành ${newNumParts} phần`, 'success');
}

function recalculateWordCounts() {
  const total = state.totalTarget || 5000;
  const numParts = state.numParts || 9;

  // First and last parts get less, middle parts share equally
  const firstPartRatio = 0.05; // 5% for first part
  const lastPartRatio = 0.08; // 8% for last part
  const middleRatio = (1 - firstPartRatio - lastPartRatio) / (numParts - 2);

  wordCounts = {};
  for (let i = 1; i <= numParts; i++) {
    let ratio;
    if (i === 1) ratio = firstPartRatio;
    else if (i === numParts) ratio = lastPartRatio;
    else ratio = middleRatio;

    wordCounts[`P${i}`] = Math.round(total * ratio);
  }

  // Save to storage
  chrome.storage.local.set({ wordCounts: wordCounts, numParts: state.numParts });
}

// ========================================
// File Browse Handlers
// ========================================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.txt')) {
    showToast('Vui lòng chọn file .txt', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    state.sampleContent = event.target.result;
    state.sampleFileName = file.name;

    // Extract title from filename
    const extractedTitle = extractTitleFromFilename(file.name);
    if (extractedTitle) {
      state.title = extractedTitle;
      if (elements.titleInput) {
        elements.titleInput.value = extractedTitle;
      }
    }

    // Update UI
    elements.fileName.textContent = file.name.length > 25
      ? file.name.substring(0, 22) + '...'
      : file.name;
    elements.fileName.classList.add('has-file');
    elements.fileName.title = file.name;
    elements.clearFileBtn.style.display = 'flex';

    saveState();
    showToast('Đã tải file bài mẫu!', 'success');
  };

  reader.onerror = () => {
    showToast('Lỗi đọc file!', 'error');
  };

  reader.readAsText(file);
}

function handleFileClear() {
  state.sampleContent = '';
  state.sampleFileName = '';

  elements.sampleFileInput.value = '';
  elements.fileName.textContent = 'Chưa chọn file';
  elements.fileName.classList.remove('has-file');
  elements.fileName.title = '';
  elements.clearFileBtn.style.display = 'none';

  saveState();
  showToast('Đã xóa file bài mẫu', 'info');
}

function extractTitleFromFilename(filename) {
  // Remove file extension
  let title = filename.replace(/\.txt$/i, '');

  // Remove ALL prefix brackets like [Korean (auto-generated)] - greedy, multiple times
  while (title.match(/^\[.*?\]\s*/)) {
    title = title.replace(/^\[.*?\]\s*/, '');
  }

  // Remove ALL suffix brackets like [DownSub.com] - greedy, multiple times
  while (title.match(/\s*\[.*?\]$/)) {
    title = title.replace(/\s*\[.*?\]$/, '');
  }

  // Clean up extra whitespace
  title = title.trim();

  return title;
}

// ========================================
// Accordion Handlers
// ========================================
function setupAccordionListeners() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.target;
      const content = document.getElementById(targetId);
      const accordionItem = header.closest('.accordion-item');

      if (!content || !accordionItem) return;

      // Toggle current accordion
      const isExpanded = accordionItem.classList.contains('expanded');

      if (isExpanded) {
        accordionItem.classList.remove('expanded');
        header.classList.remove('active');
        content.classList.remove('active');
      } else {
        accordionItem.classList.add('expanded');
        header.classList.add('active');
        content.classList.add('active');
      }
    });
  });
}

// ========================================
// Word Count Modal Handlers
// ========================================
function renderWordEditGrid() {
  if (!elements.wordEditGrid) return;

  const numParts = state.numParts || 9;
  let html = '';

  for (let i = 1; i <= numParts; i++) {
    const value = wordCounts[`P${i}`] || Math.round((state.totalTarget || 5000) / numParts);
    html += `
      <div class="word-edit-row">
        <span class="word-edit-label">Phần ${i}</span>
        <input type="number" class="word-edit-input" id="wordInput${i}" value="${value}" min="50">
      </div>
    `;
  }

  elements.wordEditGrid.innerHTML = html;

  // Add event listeners
  for (let i = 1; i <= numParts; i++) {
    const input = document.getElementById(`wordInput${i}`);
    if (input) {
      input.addEventListener('input', updateWordCountTotal);
    }
  }
}

function openWordCountModal() {
  // Regenerate grid for current numParts
  renderWordEditGrid();
  updateWordCountTotal();
  elements.wordCountModal.classList.add('active');
}

function closeWordCountModal() {
  elements.wordCountModal.classList.remove('active');
}

function updateWordCountTotal() {
  const numParts = state.numParts || 9;
  let total = 0;

  for (let i = 1; i <= numParts; i++) {
    const input = document.getElementById(`wordInput${i}`);
    if (input) {
      total += parseInt(input.value) || 0;
    }
  }

  if (elements.wordEditTotal) {
    elements.wordEditTotal.textContent = total.toLocaleString() + ' từ';
  }
}

function saveWordCounts() {
  const numParts = state.numParts || 9;

  // Save values from inputs
  wordCounts = {};
  let total = 0;
  for (let i = 1; i <= numParts; i++) {
    const input = document.getElementById(`wordInput${i}`);
    if (input) {
      const value = parseInt(input.value) || Math.round((state.totalTarget || 5000) / numParts);
      wordCounts[`P${i}`] = value;
      total += value;
    }
  }

  // Also update totalTarget to match the new total
  state.totalTarget = total;
  if (elements.totalTargetInput) {
    elements.totalTargetInput.value = total;
  }

  // Update UI - call ALL update functions
  updateWordsSummaryBar();
  renderPartButtons();
  renderProgress();

  // Save to storage
  chrome.storage.local.set({ wordCounts: wordCounts, totalTarget: state.totalTarget });
  saveState();

  closeWordCountModal();
  showToast('Đã lưu số từ!', 'success');
}

function handlePreset(preset) {
  const numParts = state.numParts || 9;
  let targetTotal;

  switch (preset) {
    case '3000':
      targetTotal = 3000;
      break;
    case '5000':
      targetTotal = 5000;
      break;
    case '8000':
      targetTotal = 8000;
      break;
    case 'even':
      targetTotal = state.totalTarget || 5000;
      break;
    default:
      return;
  }

  // Distribute based on number of parts
  const firstPartRatio = 0.05;
  const lastPartRatio = 0.08;
  const middleRatio = (1 - firstPartRatio - lastPartRatio) / (numParts - 2);

  for (let i = 1; i <= numParts; i++) {
    let ratio;
    if (preset === 'even') {
      ratio = 1 / numParts;
    } else if (i === 1) {
      ratio = firstPartRatio;
    } else if (i === numParts) {
      ratio = lastPartRatio;
    } else {
      ratio = middleRatio;
    }

    const input = document.getElementById(`wordInput${i}`);
    if (input) {
      input.value = Math.round(targetTotal * ratio);
    }
  }

  updateWordCountTotal();
}

function updateWordsSummaryBar() {
  if (!elements.wordsSummaryText || !elements.wordsSummaryTotal) return;

  const numParts = state.numParts || 9;
  const p1 = wordCounts.P1 || 0;
  const pLast = wordCounts[`P${numParts}`] || 0;

  // Check if middle parts are the same
  let middleSame = true;
  const middleValue = wordCounts.P2;
  for (let i = 2; i < numParts; i++) {
    if (wordCounts[`P${i}`] !== middleValue) {
      middleSame = false;
      break;
    }
  }

  let summaryText;
  if (numParts <= 3) {
    // Show all parts for small numbers
    summaryText = Object.entries(wordCounts)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
  } else if (middleSame) {
    summaryText = `P1:${p1} P2-${numParts - 1}:${middleValue} P${numParts}:${pLast}`;
  } else {
    summaryText = `P1:${p1} ... P${numParts}:${pLast}`;
  }

  const total = Object.values(wordCounts).reduce((a, b) => a + b, 0);

  elements.wordsSummaryText.textContent = summaryText;
  elements.wordsSummaryTotal.textContent = `= ${total.toLocaleString()} từ`;
}

function renderPartButtons() {
  if (!elements.partButtonsContainer) return;

  const numParts = state.numParts || 9;
  let html = '';

  for (let i = 1; i <= numParts; i++) {
    const step = 8 + i; // Part 1 = step 9, Part 2 = step 10, etc.
    const words = wordCounts[`P${i}`] || Math.round((state.totalTarget || 5000) / numParts);
    const isDone = state.flowSteps[step] === 'done';

    html += `
      <button class="flow-btn flow-btn-write flow-btn-soft ${isDone ? 'done' : ''}"
              data-step="${step}" data-type="soft" data-part="${i}">
        <span class="flow-btn-num">P${i}</span>
        <span class="flow-btn-words">${words}w</span>
      </button>
    `;
  }

  elements.partButtonsContainer.innerHTML = html;

  // Update stage 3 title and progress
  if (elements.stage3Title) {
    elements.stage3Title.textContent = `Viết nội dung (${numParts})`;
  }
  const stage3Progress = document.getElementById('stage3Progress');
  if (stage3Progress) {
    const doneCount = countPartsDone();
    stage3Progress.textContent = `${doneCount}/${numParts}`;
  }

  // Re-attach click listeners
  setupFlowButtonListeners();
}

function countPartsDone() {
  const numParts = state.numParts || 9;
  let count = 0;
  for (let i = 1; i <= numParts; i++) {
    const step = 8 + i;
    if (state.flowSteps[step] === 'done') count++;
  }
  return count;
}

// ========================================
// Flow Button Handlers
// ========================================
let currentEditingStep = -1;

function setupFlowButtonListeners() {
  const flowButtons = document.querySelectorAll('.flow-btn');
  flowButtons.forEach(btn => {
    // Remove existing listener first to prevent duplicates
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      const step = parseInt(newBtn.dataset.step);
      const type = newBtn.dataset.type; // 'hard' or 'soft'
      handleFlowButtonClick(step, type);
    });
  });
}

function handleFlowButtonClick(step, type) {
  console.log('[Popup] Flow button clicked:', step, 'Type:', type);

  // Update current step
  state.currentFlowStep = step;

  // Increment click count for this step
  state.flowClickCounts[step] = (state.flowClickCounts[step] || 0) + 1;

  saveState();
  updateFlowButtonStates();

  if (type === 'hard') {
    // Hard button: send immediately
    const command = prepareCommand(step);
    if (command) {
      sendCommandToGemini(command, true);
    }
  } else {
    // Soft button: open editor
    openCommandEditor(step);
  }
}

function prepareCommand(step) {
  const numParts = state.numParts || 9;

  // For dynamic part steps (step > 8 and step <= 8 + numParts)
  if (step > 8 && step <= 8 + numParts) {
    const partNum = step - 8;
    return generatePartCommand(partNum);
  }

  // For steps beyond dynamic parts (final check)
  if (step === 8 + numParts + 1) {
    return FLOW_COMMANDS[18]; // Final check command
  }

  let command = FLOW_COMMANDS[step];
  if (!command) {
    showToast('Không tìm thấy lệnh cho bước này', 'error');
    return null;
  }

  // Replace placeholders with state values or defaults
  command = command.replace('{TITLE}', state.title || '[TIÊU ĐỀ]');
  command = command.replace('{TOTAL}', (state.totalTarget || 5000).toString());

  // Use uploaded sample content if available
  const sampleContent = state.sampleContent || '[DÁN NỘI DUNG BÀI MẪU VÀO ĐÂY]';
  command = command.replace('{SAMPLE_CONTENT}', sampleContent);

  command = command.replace('{DOCTOR_NAME}', '[TÊN BÁC SĨ]');
  command = command.replace('{SEASON}', 'mùa đông');

  // Update outline command to use dynamic numParts
  command = command.replace(/outline 9 phần/gi, `outline ${numParts} phần`);
  command = command.replace(/9 phần/gi, `${numParts} phần`);

  // Replace word count placeholders
  for (let i = 1; i <= numParts; i++) {
    const key = `WORDS_P${i}`;
    const count = wordCounts[`P${i}`] || Math.round((state.totalTarget || 5000) / numParts);
    command = command.replace(`{${key}}`, count.toString());
  }

  return command;
}

function generatePartCommand(partNum) {
  const numParts = state.numParts || 9;
  const words = wordCounts[`P${partNum}`] || Math.round((state.totalTarget || 5000) / numParts);

  if (partNum === 1) {
    return `Viết phần 1 bám sát tài liệu bài viết mẫu bên trên. Viết đủ ${words} từ có mở đầu tương tự bài viết mẫu bên trên. Nội dung được viết bằng tiếng Hàn, xưng hô "tôi" (저/제) và gọi khán giả là "bạn/các bạn" (여러분), phù hợp với văn hóa Hàn Quốc và các quy định của YouTube. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm`;
  } else if (partNum === numParts) {
    return `Viết phần ${partNum} Kết thúc Part ${partNum} thật trọn vẹn theo đúng outline (đóng vòng cung đầy đủ, đưa ra lời khuyên cuối cùng để câu chuyện khép lại xúc động) bám sát tài liệu bài viết mẫu bên trên đủ ${words} từ không bao gồm dấu cách. Không viết trên canvas. Tiếp nối phần ${partNum - 1}, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm`;
  } else {
    return `Viết phần ${partNum} bám sát tài liệu bài viết mẫu bên trên, viết đủ ${words} từ. Không viết trên canvas. Tiếp nối phần ${partNum - 1}, nhớ gắn kết bài viết thành 1 mạch xuyên suốt logic với nhau, tuyến thời gian sao cho phù hợp. CHÚ Ý Văn phong kỹ thuật viết trả lại kết quả để làm nội dung Youtube chứ không phải biên tập như đạo diễn. Viết bằng tiếng Hàn quốc, văn phong và tôn giáo sử dụng nhiều ở Hàn quốc. Tất cả số đều viết thành chữ cái, loại bỏ toàn bộ ký tự đặc biệt bao gồm loại bỏ "*" "**" ký tự đóng mở ngoặc đơn hoặc kép,.... Đặt dấu phẩy ngắt nghỉ câu, cuối câu có dấu chấm`;
  }
}

function openCommandEditor(step) {
  currentEditingStep = step;

  // Prepare command with placeholders replaced
  const command = prepareCommand(step);

  // Update editor UI
  if (elements.editorStepLabel) {
    elements.editorStepLabel.textContent = `Bước ${step}: ${STEP_LABELS[step] || ''}`;
  }
  if (elements.commandEditor) {
    elements.commandEditor.value = command || '';
    elements.commandEditor.focus();
  }

  // Show editor card
  if (elements.commandEditorCard) {
    elements.commandEditorCard.style.display = 'block';
  }

  // Mark current button as editing
  document.querySelectorAll('.flow-btn').forEach(btn => {
    btn.classList.remove('editing');
    if (parseInt(btn.dataset.step) === step) {
      btn.classList.add('editing');
    }
  });

  // Scroll to editor
  elements.commandEditorCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeCommandEditor() {
  currentEditingStep = -1;

  if (elements.commandEditorCard) {
    elements.commandEditorCard.style.display = 'none';
  }

  // Remove editing state from buttons
  document.querySelectorAll('.flow-btn').forEach(btn => {
    btn.classList.remove('editing');
  });
}

function resetCurrentCommand() {
  if (currentEditingStep >= 0 && elements.commandEditor) {
    const command = prepareCommand(currentEditingStep);
    elements.commandEditor.value = command || '';
    showToast('Đã reset lệnh về mặc định', 'info');
  }
}

function sendEditorCommand() {
  if (!elements.commandEditor || !elements.commandEditor.value.trim()) {
    showToast('Vui lòng nhập lệnh!', 'warning');
    return;
  }

  const command = elements.commandEditor.value.trim();
  sendCommandToGemini(command, true);

  // Close editor after sending
  closeCommandEditor();
}

function markFlowStepDone(step) {
  state.flowSteps[step] = 'done';
  saveState();
  updateFlowButtonStates();
  updateFlowStatus();
}

function updateFlowButtonStates() {
  const flowButtons = document.querySelectorAll('.flow-btn');
  flowButtons.forEach(btn => {
    const step = parseInt(btn.dataset.step);
    const clickCount = state.flowClickCounts[step] || 0;

    // Remove state classes (except editing)
    btn.classList.remove('active', 'done', 'used');

    // Add 'used' class if clicked at least once
    if (clickCount > 0) {
      btn.classList.add('used');
    }

    // Add appropriate class
    if (state.flowSteps[step] === 'done') {
      btn.classList.add('done');
    } else if (step === state.currentFlowStep && currentEditingStep !== step) {
      btn.classList.add('active');
    }

    // Add/update click count badge
    let badge = btn.querySelector('.click-count');
    if (clickCount > 1) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'click-count';
        btn.appendChild(badge);
      }
      badge.textContent = clickCount;
    } else if (badge) {
      badge.remove();
    }
  });
}

function updateFlowStatus() {
  const doneCount = Object.keys(state.flowSteps).filter(k => state.flowSteps[k] === 'done').length;
  if (elements.flowStatus) {
    elements.flowStatus.textContent = `Bước ${doneCount}/18`;
  }
}

// ========================================
// Message Listener (from content script)
// ========================================
// Track last processed capture to avoid duplicates
let lastProcessedCaptureTime = 0;
let lastProcessedText = '';
let messageListenerSetup = false;

function setupMessageListener() {
  // Prevent duplicate listener registration
  if (messageListenerSetup) {
    console.log('[Popup] Message listener already setup, skipping');
    return;
  }
  messageListenerSetup = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TEXT_CAPTURED') {
      // Check if this exact text was just processed (within 1 second)
      const now = Date.now();
      if (message.text === lastProcessedText && (now - lastProcessedCaptureTime) < 1000) {
        console.log('[Popup] Duplicate capture ignored');
        sendResponse({ success: true, duplicate: true });
        return true;
      }

      // Clear storage immediately to prevent double processing
      chrome.storage.local.remove(['lastCapturedText', 'lastCapturedTime', 'lastCapturedWordCount']);

      // Mark as processed
      lastProcessedCaptureTime = now;
      lastProcessedText = message.text;

      handleTextCaptured(message.text);
      sendResponse({ success: true });
    }
    return true;
  });

  // Also check for stored captured text (if popup was closed when capture happened)
  // Wait a bit to let message listener process first
  setTimeout(() => {
    chrome.storage.local.get(['lastCapturedText', 'lastCapturedTime', 'lastCapturedWordCount'], (data) => {
      if (data.lastCapturedText && data.lastCapturedTime) {
        const timeDiff = Date.now() - data.lastCapturedTime;
        const processedRecently = (Date.now() - lastProcessedCaptureTime) < 2000;
        const sameText = data.lastCapturedText === lastProcessedText;

        // If captured within last 60 seconds AND not already processed via message
        if (timeDiff < 60000 && !processedRecently && !sameText) {
          console.log('[Popup] Found stored capture from', timeDiff, 'ms ago:', data.lastCapturedWordCount, 'words');
          lastProcessedText = data.lastCapturedText;
          lastProcessedCaptureTime = Date.now();
          handleTextCaptured(data.lastCapturedText);
        }
        // Always clear stored capture data after checking
        chrome.storage.local.remove(['lastCapturedText', 'lastCapturedTime', 'lastCapturedWordCount']);
      }
    });
  }, 500);
}

// ========================================
// Commands Handlers
// ========================================
function handleTotalTargetChange(e) {
  state.totalTarget = parseInt(e.target.value) || 0;
  saveState();
  renderProgress();
}

// Legacy function - kept for compatibility but no longer used
function handleParseCommands() {
  // Now using preset flow buttons instead of manual command input
}

// Legacy function - kept for compatibility but no longer used
function handleClearCommands() {
  // Now using preset flow buttons instead of manual command input
}

// ========================================
// Command Button Actions
// ========================================
function handleCommandClick(index) {
  console.log('[Popup] ===== COMMAND BUTTON CLICKED =====');
  console.log('[Popup] Index:', index);

  const command = state.commands[index];
  if (!command) {
    console.error('[Popup] Command not found at index:', index);
    return;
  }

  console.log('[Popup] Command:', command.text.substring(0, 50));

  state.currentCommandIndex = index;

  // Update command status
  if (command.status === 'pending') {
    command.status = 'in-progress';
    if (state.parts[index]) {
      state.parts[index].status = 'in-progress';
    }
  }

  saveState();
  renderCommandButtons();
  renderClipboardTable();

  // Send command to content script with auto-enter
  console.log('[Popup] Calling sendCommandToGemini...');
  sendCommandToGemini(command.text, true);
}

function sendCommandToGemini(text, autoEnter = true) {
  console.log('[Popup] ========== SENDING COMMAND ==========');
  console.log('[Popup] Text:', text.substring(0, 50));
  console.log('[Popup] AutoEnter:', autoEnter);

  // Route through background script - it has full access to all windows/tabs
  chrome.runtime.sendMessage({
    type: 'INJECT_TO_GEMINI',
    text: text,
    autoEnter: autoEnter
  }, (response) => {
    console.log('[Popup] Response received:', response);
    if (chrome.runtime.lastError) {
      console.error('[Popup] Error:', chrome.runtime.lastError.message);
      showToast('Lỗi: ' + chrome.runtime.lastError.message, 'error');
    } else if (response && response.success) {
      console.log('[Popup] Success!');
      showToast('Đã gửi lệnh!', 'success');
    } else if (response && response.error) {
      console.log('[Popup] Error from background:', response.error);
      showToast(response.error, 'warning');
    } else {
      console.log('[Popup] Unknown response');
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

  // Use currentContentPart (the selected part in content clipboard)
  const partNum = currentContentPart;
  const targetWords = wordCounts[`P${partNum}`] || 0;

  // Append to existing content
  const existingContent = state.capturedContents[partNum] || '';
  const newContent = existingContent + (existingContent ? '\n\n' : '') + text;
  state.capturedContents[partNum] = newContent;

  // Update the content editor textarea if visible
  if (elements.contentEditorTextarea) {
    elements.contentEditorTextarea.value = newContent;
  }

  // Calculate new word count for this part
  const newWordCount = countWords(newContent);
  const diff = newWordCount - targetWords;

  // Update editor display
  if (elements.editorWords) {
    elements.editorWords.textContent = newWordCount;
  }
  if (elements.editorDiff) {
    elements.editorDiff.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
    elements.editorDiff.className = `editor-diff ${diff >= 0 ? 'positive' : 'negative'}`;
    elements.editorDiff.style.display = '';
  }

  // Update part tab indicator
  const tab = elements.partTabs?.querySelector(`[data-part="${partNum}"]`);
  if (tab) {
    tab.classList.add('has-content');
  }

  // Update progress
  renderProgress();

  // Save state
  saveState();

  // Show toast
  showToast(`Đã capture ${capturedWordCount} từ vào Phần ${partNum}!`, 'success');
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
  // Mark current flow step as done
  markFlowStepDone(state.currentFlowStep);

  const currentCommand = state.commands[state.currentCommandIndex];
  if (currentCommand) {
    // Save captured content
    const existingContent = state.capturedContents[currentCommand.id] || '';
    state.capturedContents[currentCommand.id] = existingContent + (existingContent ? '\n\n' : '') + capturedText;

    // Mark as done
    currentCommand.actualWords = (currentCommand.actualWords || 0) + capturedWordCount;
    currentCommand.status = 'done';
    currentCommand.content = state.capturedContents[currentCommand.id];

    if (state.parts[state.currentCommandIndex]) {
      state.parts[state.currentCommandIndex].actualWords = currentCommand.actualWords;
      state.parts[state.currentCommandIndex].status = 'done';
      state.parts[state.currentCommandIndex].content = state.capturedContents[currentCommand.id];
    }

    // Move to next command
    const nextPendingIndex = state.commands.findIndex((cmd, i) => i > state.currentCommandIndex && cmd.status !== 'done');
    if (nextPendingIndex !== -1) {
      state.currentCommandIndex = nextPendingIndex;
    }
  }

  saveState();
  closeModal();
  renderAll();

  // Show success toast
  showToast(`Bước ${state.currentFlowStep}: ${capturedWordCount} từ - Hoàn thành!`, 'success');
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

  // Update inline hotkey display (supports both old and new class names)
  if (elements.hotkeyDisplay) {
    // Check if using mini version
    const isMini = elements.hotkeyDisplay.classList.contains('hotkey-mini');
    const keyClass = isMini ? 'hotkey-key-mini' : 'hotkey-key';
    const plusClass = isMini ? 'hotkey-plus-mini' : 'hotkey-plus';

    elements.hotkeyDisplay.innerHTML = keys.map((k, i) => {
      const html = `<span class="${keyClass}">${k}</span>`;
      return i < keys.length - 1 ? html + `<span class="${plusClass}">+</span>` : html;
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
  // Calculate from capturedContents which is the primary source now
  let total = 0;
  const numParts = state.numParts || 9;

  for (let i = 1; i <= numParts; i++) {
    const content = state.capturedContents[i] || '';
    if (content) {
      total += countWords(content);
    }
  }

  // Also add from legacy state.parts if capturedContents is empty
  if (total === 0 && state.parts && state.parts.length > 0) {
    total = state.parts.reduce((sum, part) => sum + (part.actualWords || 0), 0);
  }

  return total;
}

// ========================================
// Copy All / Export
// ========================================
function handleCopyAll() {
  // Copy only pure content, no headers or metadata
  const numParts = state.numParts || 9;
  let allContent = '';

  // First try capturedContents (new format)
  for (let i = 1; i <= numParts; i++) {
    const content = state.capturedContents[i];
    if (content && content.trim()) {
      if (allContent) allContent += '\n\n';
      allContent += content.trim();
    }
  }

  // Fallback to legacy state.parts
  if (!allContent && state.parts && state.parts.length > 0) {
    allContent = state.parts
      .filter(p => p.content)
      .map(p => p.content.trim())
      .join('\n\n');
  }

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
  const numParts = state.numParts || 9;
  let textContent = '';

  // First try capturedContents (new format)
  for (let i = 1; i <= numParts; i++) {
    const content = state.capturedContents[i];
    if (content && content.trim()) {
      if (textContent) textContent += '\n\n';
      textContent += content.trim();
    }
  }

  // Fallback to legacy state.parts
  if (!textContent && state.parts && state.parts.length > 0) {
    const partsWithContent = state.parts.filter(p => p.content);
    textContent = partsWithContent
      .map(part => part.content.trim())
      .join('\n\n');
  }

  if (!textContent) {
    showToast('Chưa có nội dung để xuất!', 'warning');
    return;
  }

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
  renderPartButtons(); // Render dynamic part buttons
  updateFlowButtonStates();
  updateFlowStatus();
  updateWordsSummaryBar();
  updateStageProgress();
  renderClipboardTable();
  updateHotkeyDisplay();
  updateFileDisplay(); // Update file display if there's a file
  renderContentClipboard(); // Render content clipboard section
}

function updateFileDisplay() {
  if (state.sampleFileName && elements.fileName) {
    elements.fileName.textContent = state.sampleFileName.length > 25
      ? state.sampleFileName.substring(0, 22) + '...'
      : state.sampleFileName;
    elements.fileName.classList.add('has-file');
    elements.fileName.title = state.sampleFileName;
    if (elements.clearFileBtn) elements.clearFileBtn.style.display = 'flex';
  }
}

function updateStageProgress() {
  const numParts = state.numParts || 9;

  // Stage 1: Steps 0-5 (6 steps)
  const stage1Steps = [0, 1, 2, 3, 4, 5];
  const stage1Done = stage1Steps.filter(s => state.flowSteps[s] === 'done').length;
  const stage1El = document.getElementById('stage1Progress');
  const stage1Status = document.getElementById('stage1Status');
  if (stage1El) stage1El.textContent = `${stage1Done}/6`;
  if (stage1Status) {
    stage1Status.classList.remove('done', 'in-progress');
    if (stage1Done === 6) {
      stage1Status.textContent = '✓';
      stage1Status.classList.add('done');
      document.getElementById('stage1Accordion')?.classList.add('completed');
    } else if (stage1Done > 0) {
      stage1Status.textContent = '◐';
      stage1Status.classList.add('in-progress');
    } else {
      stage1Status.textContent = '○';
    }
  }

  // Stage 2: Steps 6-8 (3 steps)
  const stage2Steps = [6, 7, 8];
  const stage2Done = stage2Steps.filter(s => state.flowSteps[s] === 'done').length;
  const stage2El = document.getElementById('stage2Progress');
  const stage2Status = document.getElementById('stage2Status');
  if (stage2El) stage2El.textContent = `${stage2Done}/3`;
  if (stage2Status) {
    stage2Status.classList.remove('done', 'in-progress');
    if (stage2Done === 3) {
      stage2Status.textContent = '✓';
      stage2Status.classList.add('done');
      document.getElementById('stage2Accordion')?.classList.add('completed');
    } else if (stage2Done > 0) {
      stage2Status.textContent = '◐';
      stage2Status.classList.add('in-progress');
    } else {
      stage2Status.textContent = '○';
    }
  }

  // Stage 3: Dynamic parts (steps 9 to 8+numParts)
  const stage3Done = countPartsDone();
  const stage3El = document.getElementById('stage3Progress');
  const stage3Status = document.getElementById('stage3Status');
  if (stage3El) stage3El.textContent = `${stage3Done}/${numParts}`;
  if (stage3Status) {
    stage3Status.classList.remove('done', 'in-progress');
    if (stage3Done === numParts) {
      stage3Status.textContent = '✓';
      stage3Status.classList.add('done');
      document.getElementById('stage3Accordion')?.classList.add('completed');
    } else if (stage3Done > 0) {
      stage3Status.textContent = '◐';
      stage3Status.classList.add('in-progress');
    } else {
      stage3Status.textContent = '○';
    }
  }

  // Stage 4: Final check (step 8+numParts+1)
  const finalStep = 8 + numParts + 1;
  const stage4Done = state.flowSteps[finalStep] === 'done' ? 1 : 0;
  const stage4El = document.getElementById('stage4Progress');
  const stage4Status = document.getElementById('stage4Status');
  if (stage4El) stage4El.textContent = `${stage4Done}/1`;
  if (stage4Status) {
    stage4Status.classList.remove('done', 'in-progress');
    if (stage4Done === 1) {
      stage4Status.textContent = '✓';
      stage4Status.classList.add('done');
      document.getElementById('stage4Accordion')?.classList.add('completed');
    } else {
      stage4Status.textContent = '○';
    }
  }
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
  // Legacy function - now using flow buttons instead
  // Keep for compatibility with existing code
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

// ========================================
// Content Clipboard Section
// ========================================
function renderContentClipboard() {
  if (!elements.partTabs || !elements.contentEditorTextarea) return;

  const numParts = state.numParts || 9;

  // Render part tabs
  let tabsHtml = '';
  for (let i = 1; i <= numParts; i++) {
    const content = state.capturedContents[i] || '';
    const hasContent = content.length > 0;
    const isActive = i === currentContentPart;

    tabsHtml += `
      <button class="part-tab ${isActive ? 'active' : ''} ${hasContent ? 'has-content' : ''}"
              data-part="${i}">
        P${i}
      </button>
    `;
  }
  elements.partTabs.innerHTML = tabsHtml;

  // Attach tab click listeners
  elements.partTabs.querySelectorAll('.part-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const part = parseInt(tab.dataset.part);
      if (part !== currentContentPart) {
        // Save current content first
        saveCurrentContentPart();
        // Switch to new part
        currentContentPart = part;
        renderContentClipboard();
      }
    });
  });

  // Update editor content
  const content = state.capturedContents[currentContentPart] || '';
  const wordCount = countWords(content);
  const targetWords = wordCounts[`P${currentContentPart}`] || 0;
  const diff = wordCount - targetWords;

  elements.editorPartLabel.textContent = `Phần ${currentContentPart}`;
  elements.editorWords.textContent = wordCount;
  elements.editorTarget.textContent = targetWords;
  elements.contentEditorTextarea.value = content;

  // Update diff display
  if (content.length > 0) {
    elements.editorDiff.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
    elements.editorDiff.className = `editor-diff ${diff >= 0 ? 'positive' : 'negative'}`;
    elements.editorDiff.style.display = '';
  } else {
    elements.editorDiff.style.display = 'none';
  }
}

function saveCurrentContentPart() {
  if (!elements.contentEditorTextarea) return;

  const content = elements.contentEditorTextarea.value;
  state.capturedContents[currentContentPart] = content;
  saveState();
}

// Debounced auto-save for content editor
let contentSaveTimer = null;

function setupContentEditorListeners() {
  if (!elements.contentEditorTextarea) return;

  elements.contentEditorTextarea.addEventListener('input', () => {
    // Update live word count
    const content = elements.contentEditorTextarea.value;
    const wordCount = countWords(content);
    const targetWords = wordCounts[`P${currentContentPart}`] || 0;
    const diff = wordCount - targetWords;

    elements.editorWords.textContent = wordCount;

    if (content.length > 0) {
      elements.editorDiff.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
      elements.editorDiff.className = `editor-diff ${diff >= 0 ? 'positive' : 'negative'}`;
      elements.editorDiff.style.display = '';
    } else {
      elements.editorDiff.style.display = 'none';
    }

    // Debounced save
    if (contentSaveTimer) {
      clearTimeout(contentSaveTimer);
    }
    contentSaveTimer = setTimeout(() => {
      state.capturedContents[currentContentPart] = content;

      // Update part tabs to show has-content indicator
      const tab = elements.partTabs.querySelector(`[data-part="${currentContentPart}"]`);
      if (tab) {
        if (content.length > 0) {
          tab.classList.add('has-content');
        } else {
          tab.classList.remove('has-content');
        }
      }

      // Update total progress
      renderProgress();
      saveState();
    }, 500);
  });
}

// renderSettings removed - simplified UI

// ========================================
// Storage
// ========================================
function saveState() {
  chrome.storage.local.set({
    totalTarget: state.totalTarget,
    numParts: state.numParts,
    title: state.title,
    sampleContent: state.sampleContent,
    sampleFileName: state.sampleFileName,
    currentFlowStep: state.currentFlowStep,
    flowSteps: state.flowSteps,
    flowClickCounts: state.flowClickCounts,
    commands: state.commands,
    currentCommandIndex: state.currentCommandIndex,
    parts: state.parts,
    capturedContents: state.capturedContents,
    settings: state.settings,
    wordCounts: wordCounts,
    currentContentPart: currentContentPart
  });
}

function loadState() {
  chrome.storage.local.get([
    'totalTarget',
    'numParts',
    'title',
    'sampleContent',
    'sampleFileName',
    'currentFlowStep',
    'flowSteps',
    'flowClickCounts',
    'commands',
    'currentCommandIndex',
    'parts',
    'capturedContents',
    'settings',
    'wordCounts',
    'currentContentPart'
  ], (data) => {
    if (data.totalTarget !== undefined) state.totalTarget = data.totalTarget;
    if (data.numParts !== undefined) state.numParts = data.numParts;
    if (data.title !== undefined) state.title = data.title;
    if (data.sampleContent !== undefined) state.sampleContent = data.sampleContent;
    if (data.sampleFileName !== undefined) state.sampleFileName = data.sampleFileName;
    if (data.currentFlowStep !== undefined) state.currentFlowStep = data.currentFlowStep;
    if (data.flowSteps) state.flowSteps = data.flowSteps;
    if (data.flowClickCounts) state.flowClickCounts = data.flowClickCounts;
    if (data.commands) state.commands = data.commands;
    if (data.currentCommandIndex !== undefined) state.currentCommandIndex = data.currentCommandIndex;
    if (data.parts) state.parts = data.parts;
    if (data.capturedContents) state.capturedContents = data.capturedContents;
    if (data.settings) state.settings = { ...state.settings, ...data.settings };
    if (data.wordCounts) wordCounts = data.wordCounts;
    if (data.currentContentPart) currentContentPart = data.currentContentPart;

    // Update form values from state
    elements.totalTargetInput.value = state.totalTarget || 5000;
    if (elements.numPartsInput) elements.numPartsInput.value = state.numParts || 9;
    if (elements.titleInput) elements.titleInput.value = state.title || '';

    // Ensure default values
    if (!state.totalTarget) state.totalTarget = 5000;
    if (!state.numParts) state.numParts = 9;

    // If wordCounts is empty or doesn't match numParts, recalculate
    const wordCountKeys = Object.keys(wordCounts).length;
    if (wordCountKeys === 0 || wordCountKeys !== state.numParts) {
      recalculateWordCounts();
    }

    renderAll();
  });
}

// ========================================
// Full Screen Editor
// ========================================
let fsCurrentPart = 1;
let fsSaveTimer = null;

function openFullscreenEditor() {
  // Save current content first
  saveCurrentContentPart();

  // Set current part in fullscreen editor
  fsCurrentPart = currentContentPart;

  // Render fullscreen editor
  renderFullscreenEditor();

  // Show modal
  elements.fullscreenEditorModal.classList.add('active');

  // Setup textarea listener
  setupFullscreenTextareaListener();
}

function closeFullscreenEditor() {
  // Save current fullscreen content
  saveFullscreenContent();

  // Update main content clipboard to reflect changes
  renderContentClipboard();
  renderProgress();

  // Hide modal
  elements.fullscreenEditorModal.classList.remove('active');
}

function renderFullscreenEditor() {
  const numParts = state.numParts || 9;

  // Update total stats in header
  const totalWritten = calculateTotalWritten();
  const totalTarget = state.totalTarget || 5000;
  const percent = totalTarget > 0 ? Math.min((totalWritten / totalTarget) * 100, 100) : 0;

  elements.fsEditorTotalWritten.textContent = totalWritten.toLocaleString();
  elements.fsEditorTotalTarget.textContent = totalTarget.toLocaleString();
  elements.fsEditorPercent.textContent = `${percent.toFixed(1)}%`;

  // Render part tabs
  let tabsHtml = '';
  for (let i = 1; i <= numParts; i++) {
    const content = state.capturedContents[i] || '';
    const wordCount = countWords(content);
    const targetWords = wordCounts[`P${i}`] || 0;
    const diff = wordCount - targetWords;
    const hasContent = content.length > 0;
    const isActive = i === fsCurrentPart;

    tabsHtml += `
      <button class="fs-part-tab ${isActive ? 'active' : ''} ${hasContent ? 'has-content' : ''}"
              data-part="${i}">
        <span class="fs-tab-label">P${i}</span>
        <span class="fs-tab-words">${wordCount}/${targetWords}</span>
        ${hasContent ? `<span class="fs-tab-diff ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${diff}</span>` : ''}
      </button>
    `;
  }
  elements.fsPartTabs.innerHTML = tabsHtml;

  // Attach tab click listeners
  elements.fsPartTabs.querySelectorAll('.fs-part-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const part = parseInt(tab.dataset.part);
      if (part !== fsCurrentPart) {
        // Save current part first
        saveFullscreenContent();
        // Switch to new part
        fsCurrentPart = part;
        renderFullscreenEditorContent();
        updateFullscreenTabs();
      }
    });
  });

  // Render editor content
  renderFullscreenEditorContent();
}

function renderFullscreenEditorContent() {
  const content = state.capturedContents[fsCurrentPart] || '';
  const wordCount = countWords(content);
  const targetWords = wordCounts[`P${fsCurrentPart}`] || 0;
  const diff = wordCount - targetWords;

  elements.fsPartLabel.textContent = `Phần ${fsCurrentPart}`;
  elements.fsWords.textContent = wordCount;
  elements.fsTarget.textContent = targetWords;
  elements.fsTextarea.value = content;

  // Update diff display
  if (content.length > 0) {
    elements.fsDiff.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
    elements.fsDiff.className = `fs-diff ${diff >= 0 ? 'positive' : 'negative'}`;
    elements.fsDiff.style.display = '';
  } else {
    elements.fsDiff.style.display = 'none';
  }

  // Focus textarea
  elements.fsTextarea.focus();
}

function updateFullscreenTabs() {
  const numParts = state.numParts || 9;

  elements.fsPartTabs.querySelectorAll('.fs-part-tab').forEach(tab => {
    const part = parseInt(tab.dataset.part);
    const content = state.capturedContents[part] || '';
    const wordCount = countWords(content);
    const targetWords = wordCounts[`P${part}`] || 0;
    const diff = wordCount - targetWords;
    const hasContent = content.length > 0;
    const isActive = part === fsCurrentPart;

    // Update classes
    tab.classList.toggle('active', isActive);
    tab.classList.toggle('has-content', hasContent);

    // Update word count
    const wordsEl = tab.querySelector('.fs-tab-words');
    if (wordsEl) {
      wordsEl.textContent = `${wordCount}/${targetWords}`;
    }

    // Update diff
    let diffEl = tab.querySelector('.fs-tab-diff');
    if (hasContent) {
      if (!diffEl) {
        diffEl = document.createElement('span');
        diffEl.className = 'fs-tab-diff';
        tab.appendChild(diffEl);
      }
      diffEl.textContent = `${diff >= 0 ? '+' : ''}${diff}`;
      diffEl.className = `fs-tab-diff ${diff >= 0 ? 'positive' : 'negative'}`;
    } else if (diffEl) {
      diffEl.remove();
    }
  });

  // Update total stats
  const totalWritten = calculateTotalWritten();
  const totalTarget = state.totalTarget || 5000;
  const percent = totalTarget > 0 ? Math.min((totalWritten / totalTarget) * 100, 100) : 0;

  elements.fsEditorTotalWritten.textContent = totalWritten.toLocaleString();
  elements.fsEditorPercent.textContent = `${percent.toFixed(1)}%`;
}

function setupFullscreenTextareaListener() {
  if (!elements.fsTextarea) return;

  // Remove existing listener to avoid duplicates
  elements.fsTextarea.removeEventListener('input', handleFullscreenInput);
  elements.fsTextarea.addEventListener('input', handleFullscreenInput);
}

function handleFullscreenInput() {
  const content = elements.fsTextarea.value;
  const wordCount = countWords(content);
  const targetWords = wordCounts[`P${fsCurrentPart}`] || 0;
  const diff = wordCount - targetWords;

  // Update word stats
  elements.fsWords.textContent = wordCount;

  if (content.length > 0) {
    elements.fsDiff.textContent = diff >= 0 ? `+${diff}` : `${diff}`;
    elements.fsDiff.className = `fs-diff ${diff >= 0 ? 'positive' : 'negative'}`;
    elements.fsDiff.style.display = '';
  } else {
    elements.fsDiff.style.display = 'none';
  }

  // Debounced save
  if (fsSaveTimer) {
    clearTimeout(fsSaveTimer);
  }
  fsSaveTimer = setTimeout(() => {
    saveFullscreenContent();
    updateFullscreenTabs();
  }, 300);
}

function saveFullscreenContent() {
  if (!elements.fsTextarea) return;

  const content = elements.fsTextarea.value;
  state.capturedContents[fsCurrentPart] = content;
  saveState();
}
