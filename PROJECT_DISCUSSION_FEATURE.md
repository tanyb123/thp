# Tính năng Thảo luận Dự án

## Tổng quan

Tính năng thảo luận dự án cho phép các thành viên trong team thảo luận về dự án cụ thể và lưu trữ các cuộc trò chuyện trên Firestore. Tính năng này hỗ trợ gửi tin nhắn, file, ảnh và thu hồi tin nhắn giống như Messenger.

## Tính năng chính

### 1. Giao diện người dùng

- **Widget mới**: Nút "Thảo luận dự án" với icon chat và số lượng tin nhắn
- **Vị trí**: Hàng 3 trong grid layout của ProjectDetailScreen
- **Badge số**: Hiển thị số lượng tin nhắn trong cuộc thảo luận

### 2. Màn hình thảo luận

- **Real-time messaging**: Tin nhắn được cập nhật theo thời gian thực
- **Avatar và tên người gửi**: Hiển thị avatar từ UserManagement và tên người gửi
- **Chỉnh sửa tin nhắn**: Người dùng có thể chỉnh sửa tin nhắn của mình
- **Thu hồi tin nhắn**: Người dùng có thể thu hồi tin nhắn thay vì xóa hẳn
- **Gửi file**: Hỗ trợ gửi ảnh, PDF, và tài liệu như Messenger
- **Giao diện chat**: Thiết kế giống các ứng dụng chat hiện đại

### 3. Lưu trữ dữ liệu

- **Collection**: `projectDiscussions` trong Firestore
- **Storage**: Google Drive API cho file upload (sử dụng service account)
- **Cấu trúc dữ liệu**:
  ```javascript
  {
    projectId: string,
    message: string,
    userId: string,
    userName: string,
    userPhotoURL: string,
    messageType: 'text' | 'image' | 'pdf' | 'link',
    attachments: Array<{
      name: string,
      url: string,
      size: number,
      type: string
    }>,
    isRecalled: boolean,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  ```

## Cách sử dụng

### 1. Truy cập tính năng

1. Mở chi tiết dự án
2. Tìm nút "Thảo luận dự án" trong grid (hàng 3)
3. Nhấn vào nút để mở màn hình thảo luận

### 2. Gửi tin nhắn

1. Nhập tin nhắn vào ô input ở cuối màn hình
2. Nhấn nút gửi hoặc Enter để gửi tin nhắn

### 3. Chỉnh sửa tin nhắn

1. Nhấn vào icon bút chì bên cạnh tin nhắn của bạn
2. Chỉnh sửa nội dung
3. Nhấn ✓ để lưu hoặc ✗ để hủy

### 4. Thu hồi tin nhắn

1. Nhấn vào icon thu hồi (↶) bên cạnh tin nhắn của bạn
2. Xác nhận thu hồi tin nhắn
3. Tin nhắn sẽ hiển thị "Tin nhắn đã được thu hồi"

### 5. Gửi file

1. Nhấn vào nút "+" bên cạnh ô input
2. Chọn "Chọn ảnh" để gửi ảnh
3. Chọn "Chọn tài liệu" để gửi PDF hoặc tài liệu
4. File sẽ được upload lên Google Drive (sử dụng service account)
5. File được chia sẻ công khai để có thể xem được

## Cấu trúc code

### Files đã tạo/cập nhật:

1. **`src/api/projectDiscussionService.js`**

   - Service để tương tác với Firestore
   - Các hàm CRUD cho tin nhắn
   - Upload file lên Google Drive API
   - Real-time listener

2. **`src/screens/ProjectDiscussionScreen.js`**

   - Màn hình thảo luận chính
   - Giao diện chat với avatar
   - Xử lý tin nhắn real-time
   - Upload và hiển thị file

3. **`src/screens/ProjectDetailScreen.js`**

   - Thêm nút thảo luận vào grid
   - Hiển thị số lượng tin nhắn
   - Navigation đến màn hình thảo luận

4. **`src/navigation/AppNavigator.js`**
   - Thêm route cho ProjectDiscussionScreen

### Styles mới:

- `tileIconContainer`: Container cho icon và badge
- `discussionBadge`: Badge hiển thị số lượng tin nhắn
- `discussionBadgeText`: Text trong badge
- `avatar`, `avatarPlaceholder`: Avatar người dùng
- `attachmentsContainer`, `attachmentItem`: Container cho file đính kèm
- `attachmentMenu`, `attachmentOption`: Menu chọn loại file
- `imagePreviewOverlay`: Modal xem ảnh

## Bảo mật

- Chỉ người dùng đã đăng nhập mới có thể truy cập
- Người dùng chỉ có thể chỉnh sửa/thu hồi tin nhắn của mình
- File được lưu trữ an toàn trên Google Drive (sử dụng service account)
- Dữ liệu được lưu trữ an toàn trên Firestore

## Tương lai

- Thêm tính năng gửi link
- Thông báo push cho tin nhắn mới
- Tìm kiếm tin nhắn
- Phân trang tin nhắn cũ
- Tích hợp với Google Drive để lưu trữ file theo dự án
