# Cập nhật Cấu trúc Dự án - Chức năng Ghi âm

## Files đã thêm/sửa đổi

### 1. Files mới

- `src/utils/audioPermissionHelper.js` - Helper xử lý quyền ghi âm
- `AUDIO_PERMISSION_GUIDE.md` - Hướng dẫn sử dụng chức năng ghi âm

### 2. Files đã cập nhật

#### `app.json`

- Thêm quyền `RECORD_AUDIO` cho Android
- Thêm `NSMicrophoneUsageDescription` cho iOS

#### `src/screens/StageDetailScreen.js`

- Cải thiện UX khi xin quyền ghi âm
- Thêm thông báo rõ ràng về quyền
- Sử dụng helper functions để xử lý quyền
- Thêm thông báo hướng dẫn cho người dùng

#### `README.md`

- Thêm thông tin về tính năng ghi âm mới
- Hướng dẫn sử dụng chức năng ghi âm

## Cấu trúc thư mục cập nhật

```
thpapp/
├── src/
│   ├── utils/
│   │   ├── audioPermissionHelper.js (MỚI)
│   │   └── taskHelpers.js
│   └── screens/
│       └── StageDetailScreen.js (ĐÃ CẬP NHẬT)
├── app.json (ĐÃ CẬP NHẬT)
├── README.md (ĐÃ CẬP NHẬT)
├── AUDIO_PERMISSION_GUIDE.md (MỚI)
└── PROJECT_STRUCTURE_UPDATE.md (MỚI)
```

## Chức năng mới

### Audio Permission Helper (`src/utils/audioPermissionHelper.js`)

- `requestAudioPermission()` - Xin quyền ghi âm với UX tốt
- `checkAudioPermission()` - Kiểm tra quyền hiện tại
- `setupAudioMode()` - Cấu hình audio mode cho ghi âm

### StageDetailScreen Updates

- Cải thiện xử lý quyền ghi âm
- Thông báo rõ ràng cho người dùng
- Hướng dẫn cách cấp quyền trong cài đặt
- Xử lý lỗi tốt hơn

## Quyền cần thiết

### Android

```json
"permissions": [
  "android.permission.RECORD_AUDIO"
]
```

### iOS

```json
"infoPlist": {
  "NSMicrophoneUsageDescription": "Ứng dụng cần quyền truy cập microphone để ghi âm hướng dẫn công việc"
}
```

## Testing

Để test chức năng ghi âm:

1. Build lại ứng dụng với quyền mới
2. Vào StageDetailScreen
3. Thử ghi âm lần đầu (sẽ xin quyền)
4. Kiểm tra phát lại audio
5. Test trên cả Android và iOS

## Lưu ý

- Cần build lại ứng dụng để áp dụng quyền mới
- Test kỹ trên cả Android và iOS
- Đảm bảo thông báo quyền rõ ràng cho người dùng
