# Hướng dẫn Quyền Ghi âm

## Tổng quan

Ứng dụng THPApp đã được cập nhật với chức năng ghi âm hướng dẫn công việc. Để sử dụng tính năng này, ứng dụng cần quyền truy cập microphone.

## Các thay đổi đã thực hiện

### 1. Cập nhật app.json

- Thêm quyền `RECORD_AUDIO` cho Android
- Thêm `NSMicrophoneUsageDescription` cho iOS

### 2. Tạo Audio Permission Helper

- File: `src/utils/audioPermissionHelper.js`
- Cung cấp các hàm helper để xử lý quyền ghi âm

### 3. Cập nhật StageDetailScreen

- Cải thiện UX khi xin quyền ghi âm
- Thêm thông báo rõ ràng về quyền
- Cải thiện xử lý lỗi

## Cách sử dụng

### Trong StageDetailScreen

1. Nhấn nút "Ghi âm" trong phần "Hướng dẫn bằng giọng nói"
2. Nếu chưa có quyền, ứng dụng sẽ hiển thị dialog xin quyền
3. Người dùng có thể chọn "Cài đặt" để mở cài đặt ứng dụng
4. Sau khi cấp quyền, có thể bắt đầu ghi âm

### Các hàm helper có sẵn

```javascript
import {
  requestAudioPermission,
  checkAudioPermission,
  setupAudioMode,
} from '../utils/audioPermissionHelper';

// Xin quyền ghi âm
const hasPermission = await requestAudioPermission();

// Kiểm tra quyền hiện tại
const isGranted = await checkAudioPermission();

// Cấu hình audio mode
const isSet = await setupAudioMode();
```

## Quyền cần thiết

### Android

- `android.permission.RECORD_AUDIO`

### iOS

- `NSMicrophoneUsageDescription` trong Info.plist

## Xử lý lỗi

- Kiểm tra quyền trước khi ghi âm
- Hiển thị thông báo rõ ràng khi không có quyền
- Cung cấp link đến cài đặt ứng dụng
- Xử lý các trường hợp lỗi khác nhau

## Lưu ý

- Quyền ghi âm chỉ được yêu cầu khi người dùng thực sự muốn ghi âm
- Thông báo rõ ràng về mục đích sử dụng microphone
- Cung cấp hướng dẫn cách cấp quyền trong cài đặt
