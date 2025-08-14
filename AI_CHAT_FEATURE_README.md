# AI Chat với File Đính Kèm - Hướng Dẫn Sử Dụng

## Tổng Quan

Chức năng AI Chat với file đính kèm cho phép người dùng gửi ảnh và tài liệu kèm theo tin nhắn để AI có thể phân tích và đưa ra lời khuyên phù hợp.

## Tính Năng Chính

### 1. Hỗ Trợ File Đính Kèm

- **Ảnh**: JPG, PNG, GIF (từ thư viện ảnh)
- **Tài liệu**: PDF, DOC, XLS, TXT và các định dạng khác
- **Preview**: Hiển thị preview file trước khi gửi
- **Quản lý**: Thêm, xóa từng file hoặc xóa tất cả

### 2. Xử Lý AI Thông Minh

- AI tự động nhận diện loại file đính kèm
- Tạo mô tả chi tiết về file để AI hiểu
- Kết hợp thông tin file với câu hỏi của người dùng
- Đưa ra lời khuyên dựa trên nội dung file

### 3. Giao Diện Thân Thiện

- Nút đính kèm file dễ sử dụng
- Menu lựa chọn loại file (ảnh/tài liệu)
- Hiển thị file đính kèm trong tin nhắn
- Responsive design cho mọi kích thước màn hình

## Cách Sử Dụng

### Bước 1: Mở AI Chat

1. Vào màn hình AI Chat từ menu chính
2. Chọn chế độ chat (chung hoặc theo dự án)

### Bước 2: Đính Kèm File

1. Nhấn nút đính kèm (📎) bên cạnh ô nhập tin nhắn
2. Chọn loại file muốn đính kèm:
   - **Chọn ảnh**: Mở thư viện ảnh
   - **Chọn tài liệu**: Mở file manager

### Bước 3: Xem Preview

- File đã chọn sẽ hiển thị trong phần preview
- Có thể xóa từng file hoặc xóa tất cả
- Kiểm tra tên file và kích thước

### Bước 4: Gửi Tin Nhắn

1. Nhập câu hỏi hoặc để trống (chỉ gửi file)
2. Nhấn nút gửi (➤)
3. AI sẽ xử lý và trả lời về file đính kèm

## Ví Dụ Sử Dụng

### Ví Dụ 1: Phân Tích Ảnh Sản Phẩm

```
Người dùng: "Đây là ảnh sản phẩm mới, bạn thấy có vấn đề gì không?"
File đính kèm: [Ảnh sản phẩm.jpg]

AI trả lời: "Tôi thấy sản phẩm có vẻ ổn, nhưng cần kiểm tra:
- Chất lượng bề mặt
- Độ chính xác kích thước
- Màu sắc có đúng yêu cầu không"
```

### Ví Dụ 2: Phân Tích Tài Liệu Kỹ Thuật

```
Người dùng: "Kiểm tra bản vẽ kỹ thuật này"
File đính kèm: [Bản vẽ kỹ thuật.pdf]

AI trả lời: "Dựa trên bản vẽ kỹ thuật, tôi thấy:
- Các kích thước được ghi rõ ràng
- Cần lưu ý về dung sai ±0.1mm
- Gợi ý sử dụng máy CNC để đảm bảo độ chính xác"
```

### Ví Dụ 3: Hỏi Về Dự Án với File Đính Kèm

```
Người dùng: "Dự án này đang gặp vấn đề gì?"
File đính kèm: [Báo cáo tiến độ.xlsx, Ảnh công trường.jpg]

AI trả lời: "Dựa trên báo cáo và ảnh công trường:
- Tiến độ chậm 15% so với kế hoạch
- Cần tăng cường nhân lực cho giai đoạn sản xuất
- Đề xuất làm thêm giờ để bù đắp thời gian"
```

## Cấu Trúc Kỹ Thuật

### 1. Components

- `AIChatComponent.js`: Component chính xử lý chat
- `AIChatTestComponent.js`: Component test chức năng

### 2. Services

- `aiChatService.js`: Xử lý API AI và file đính kèm
- Hỗ trợ Gemini API và OpenRouter fallback

### 3. Hooks & Contexts

- `useAIChat`: Quản lý state chat
- `AIChatContext`: Context cho AI chat

### 4. File Processing

- `processAttachments()`: Xử lý file đính kèm
- `createAttachmentPrompt()`: Tạo prompt cho AI

## Quyền Truy Cập

### Android

- `READ_EXTERNAL_STORAGE`: Đọc file từ thiết bị
- `CAMERA`: Chụp ảnh mới (nếu cần)

### iOS

- `NSPhotoLibraryUsageDescription`: Truy cập thư viện ảnh
- `NSDocumentsFolderUsageDescription`: Truy cập thư mục tài liệu

## Xử Lý Lỗi

### 1. Lỗi Chọn File

- Kiểm tra quyền truy cập
- Đảm bảo file không bị hỏng
- Kiểm tra kích thước file (giới hạn 10MB)

### 2. Lỗi Kết Nối

- Kiểm tra kết nối mạng
- Thử lại sau vài giây
- Sử dụng fallback API nếu cần

### 3. Lỗi AI Processing

- Kiểm tra API key
- Đảm bảo file format được hỗ trợ
- Thử gửi lại tin nhắn

## Giới Hạn

### 1. Kích Thước File

- **Ảnh**: Tối đa 5MB
- **Tài liệu**: Tối đa 10MB
- **Tổng cộng**: Tối đa 20MB mỗi tin nhắn

### 2. Số Lượng File

- Tối đa 5 file mỗi tin nhắn
- Hỗ trợ mix ảnh và tài liệu

### 3. Định Dạng Hỗ Trợ

- **Ảnh**: JPG, PNG, GIF, WebP
- **Tài liệu**: PDF, DOC, DOCX, XLS, XLSX, TXT, RTF

## Tối Ưu Hóa

### 1. Performance

- Nén ảnh tự động (quality: 0.8)
- Cache file tạm thời
- Lazy loading cho preview

### 2. UX

- Loading indicator khi xử lý
- Error handling thân thiện
- Auto-scroll đến tin nhắn mới

### 3. AI Response

- Context-aware responses
- Fallback cho API lỗi
- Rate limiting để tránh spam

## Testing

### 1. Unit Tests

- Test file processing functions
- Test API integration
- Test error handling

### 2. Integration Tests

- Test end-to-end flow
- Test file upload/download
- Test AI response generation

### 3. Manual Testing

- Test với các loại file khác nhau
- Test với kích thước file lớn
- Test với kết nối mạng yếu

## Troubleshooting

### 1. File Không Hiển Thị

- Kiểm tra quyền truy cập
- Restart app
- Clear cache

### 2. AI Không Trả Lời

- Kiểm tra kết nối mạng
- Kiểm tra API key
- Thử gửi lại tin nhắn

### 3. App Bị Crash

- Kiểm tra phiên bản React Native
- Kiểm tra Expo SDK version
- Clear app data

## Roadmap

### Phase 1 (Hiện tại)

- ✅ Hỗ trợ ảnh và tài liệu cơ bản
- ✅ AI processing đơn giản
- ✅ UI cơ bản

### Phase 2 (Tương lai)

- 🔄 OCR cho tài liệu
- 🔄 AI vision cho ảnh
- 🔄 Batch file processing

### Phase 3 (Dài hạn)

- 📋 Multi-language support
- 📋 Advanced AI models
- 📋 Cloud storage integration

## Liên Hệ Hỗ Trợ

Nếu gặp vấn đề hoặc cần hỗ trợ:

- Email: support@thpapp.com
- Hotline: 1900-xxxx
- Documentation: https://docs.thpapp.com

---

**Lưu ý**: Chức năng này yêu cầu kết nối internet ổn định và API key hợp lệ để hoạt động tốt nhất.
