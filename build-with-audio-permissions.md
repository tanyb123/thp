# Hướng dẫn Build lại ứng dụng với quyền ghi âm

## Vấn đề

Ứng dụng hiện tại chỉ có quyền Camera, chưa có quyền Microphone. Điều này xảy ra vì:

1. Quyền `RECORD_AUDIO` mới được thêm vào `app.json`
2. Cần build lại ứng dụng để áp dụng quyền mới

## Các bước thực hiện

### 1. Đã hoàn thành

- ✅ Thêm quyền `RECORD_AUDIO` vào `app.json`
- ✅ Thêm quyền `MODIFY_AUDIO_SETTINGS` cho Android
- ✅ Thêm `NSMicrophoneUsageDescription` cho iOS
- ✅ Cài đặt `expo-av`
- ✅ Thêm plugin `expo-av` vào `app.json`
- ✅ Tạo script build `build-audio-app.bat`

### 2. Build lại ứng dụng

#### Cách 1: Sử dụng EAS Build (Khuyến nghị)

```bash
# Build cho Android
npx eas build --platform android

# Build cho iOS
npx eas build --platform ios
```

#### Cách 2: Sử dụng Expo Development Build

```bash
# Tạo development build
npx expo run:android
# hoặc
npx expo run:ios
```

#### Cách 3: Sử dụng Expo Go (Chỉ test)

```bash
npx expo start
```

#### Cách 4: Sử dụng script tự động

```bash
# Chạy file batch (Windows)
build-audio-app.bat
```

### 3. Kiểm tra quyền sau khi build

Sau khi build xong, vào:

1. **Android**: Settings > Apps > thpapp > Permissions
2. **iOS**: Settings > Privacy & Security > Microphone > thpapp

Bạn sẽ thấy quyền Microphone xuất hiện.

### 4. Test chức năng ghi âm

1. Mở ứng dụng
2. Vào StageDetailScreen
3. Cuộn xuống phần "Hướng dẫn bằng giọng nói"
4. Nhấn "Ghi âm"
5. Ứng dụng sẽ xin quyền Microphone
6. Cấp quyền và test ghi âm

## Lưu ý quan trọng

- **Phải build lại** ứng dụng để quyền mới có hiệu lực
- Không thể test quyền microphone trong Expo Go
- Cần có tài khoản EAS để build production
- Test trên thiết bị thật, không phải simulator

## Troubleshooting

Nếu vẫn không thấy quyền Microphone:

1. Kiểm tra `app.json` có đúng quyền không
2. Đảm bảo đã build lại ứng dụng
3. Gỡ cài đặt và cài lại ứng dụng
4. Kiểm tra log để xem lỗi
