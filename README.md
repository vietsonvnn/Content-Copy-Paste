# Gemini Content Writer Assistant

Chrome Extension hỗ trợ viết content với Gemini - Quản lý commands và word count.

## Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **Command Buttons** | Click để paste + auto Enter vào Gemini |
| **Hotkey Capture** | Tự chọn hotkey (mặc định `Ctrl+Shift+C`) |
| **Word Count** | Đếm từ tiếng Hàn và tiếng Việt |
| **Output Table** | Bảng quản lý với nút Xem/Copy cho từng phần |
| **Progress Tracking** | Theo dõi tiến độ từng phần và tổng bài viết |
| **Import từ Excel/Sheets** | Paste nhiều dòng command |
| **Sub-parts** | Hỗ trợ phần 3.1, 3.2, 5.1, 5.2... |

## Cài đặt

1. Mở Chrome, vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Click **Load unpacked**
4. Chọn thư mục `gemini-content-writer-extension`

## Cách sử dụng

### 1. Setup Commands

1. Mở extension popup
2. Nhập tổng số từ target (VD: 3000)
3. Paste danh sách commands (từ Excel/Sheets hoặc nhập tay):
   ```
   Viết phần 1 với 300 từ bám sát outline
   Viết phần 2 với 400 từ bám sát outline
   Viết phần 3.1 với 500 từ bám sát outline
   Viết phần 3.2 với 500 từ bám sát outline
   ```
4. Click **Parse Commands**

### 2. Viết Content

1. Mở trang Gemini (gemini.google.com)
2. Click button số (1, 2, 3.1...) để gửi command
3. Gemini sẽ generate content
4. Bôi đen phần content cần đếm
5. Nhấn hotkey (mặc định `Ctrl+Shift+C`) để capture

### 3. Xử lý kết quả

Sau khi capture, popup hiện 3 options:
- **Viết tiếp**: Gửi lệnh viết thêm (Paste + Auto Enter)
- **Viết lại**: Chỉ paste lệnh gốc, bạn tự chỉnh và Enter
- **Done**: Đánh dấu hoàn thành phần này

### 4. Xem & Copy nội dung

- Trong bảng Output, click **👁️** để xem full content
- Click **📋** để copy nhanh
- Có thể copy riêng tiếng Hàn hoặc tiếng Việt

## Cấu hình Hotkey

1. Mở tab **Settings** trong popup
2. Click vào ô hiển thị hotkey
3. Nhấn tổ hợp phím mới (VD: `Ctrl+Alt+S`)
4. Hotkey sẽ được lưu tự động

**Lưu ý**: Tránh dùng `Ctrl+C`, `Ctrl+V`, `Ctrl+Shift+I`

## Cấu trúc thư mục

```
gemini-content-writer-extension/
├── manifest.json       # Extension config
├── popup.html          # Popup UI
├── css/
│   ├── popup.css       # Popup styles
│   └── content.css     # Injected styles
├── js/
│   ├── popup.js        # Popup logic
│   ├── content.js      # Content script (inject vào Gemini)
│   └── background.js   # Service worker
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Click Button│────▶│ Gemini Gen  │────▶│ Select Text │
│ (1, 2, 3.1) │     │   Content   │     │ + Hotkey    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
            ┌─────────────────┐
            │ Popup hiện lên  │
            │ 3 options:      │
            │ • Viết tiếp     │
            │ • Viết lại      │
            │ • Done          │
            └─────────────────┘
```

## Notes

- Extension chỉ hoạt động trên `gemini.google.com`
- Dữ liệu được lưu local trong Chrome storage
- Có thể export data ra JSON để backup
