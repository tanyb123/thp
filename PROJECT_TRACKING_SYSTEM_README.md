# Hệ Thống Theo Dõi Tiến Độ Dự Án THP

## Tổng Quan

Hệ thống theo dõi tiến độ dự án công khai cho phép khách hàng xem tiến độ các công đoạn sản xuất theo thời gian thực mà không cần đăng nhập. Hệ thống bao gồm 3 thành phần chính:

1. **Backend (Firebase Cloud Functions)**: API trung gian an toàn
2. **Frontend (React Web App)**: Giao diện web cho khách hàng
3. **Mobile App (React Native)**: Tích hợp nút chia sẻ link theo dõi

## Kiến Trúc Hệ Thống

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │    │  Cloud Function  │    │  React Web App  │
│  (React Native) │◄──►│  (Firebase)      │◄──►│  (Netlify)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chia sẻ       │    │   API Endpoint   │    │   Hiển thị      │
│   Link Theo dõi │    │   Công khai      │    │   Tiến độ       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Thành Phần 1: Backend - Firebase Cloud Functions

### 1.1. Cập nhật projectTriggers.ts

**File**: `functions/src/projectTriggers.ts`

**Thay đổi**: Thêm logic tạo `publicTrackingToken` tự động khi dự án mới được tạo.

```typescript
// Thêm import uuid
import { v4 as uuidv4 } from 'uuid';

// Trong hàm onProjectCreate, thêm:
const publicTrackingToken = uuidv4().replace(/-/g, '');
await db.collection('projects').doc(projectId).update({
  // ... existing fields
  publicTrackingToken: publicTrackingToken,
});
```

### 1.2. Tạo publicApi.ts

**File**: `functions/src/publicApi.ts`

**Chức năng**: API endpoint công khai để trả về dữ liệu tiến độ dự án.

```typescript
export const getProjectStatusByToken = onRequest(
  {
    region: 'asia-southeast1',
    cors: true,
  },
  async (request, response) => {
    // Logic xử lý request và trả về dữ liệu an toàn
  }
);
```

**Dữ liệu trả về an toàn**:

- `projectName`: Tên dự án
- `customerName`: Tên khách hàng
- `status`: Trạng thái dự án
- `startDate`, `endDate`: Ngày bắt đầu/kết thúc
- `workflowStages`: Mảng các công đoạn (chỉ `processName`, `status`, `order`)

### 1.3. Cập nhật index.ts

**File**: `functions/src/index.ts`

**Thay đổi**: Thêm export cho publicApi.

```typescript
export * from './publicApi';
```

## Thành Phần 2: Frontend - React Web App

### 2.1. Cấu trúc dự án

**Thư mục**: `website-tracker/`

```
website-tracker/
├── src/
│   ├── components/
│   │   ├── TrackerPage.tsx    # Component chính
│   │   └── TrackerPage.css    # Styles
│   ├── App.tsx                # App component
│   └── App.css               # App styles
├── package.json
└── README.md
```

### 2.2. TrackerPage Component

**Chức năng chính**:

- Đọc token từ URL parameters
- Gọi API để lấy dữ liệu dự án
- Hiển thị timeline tiến độ trực quan
- Responsive design cho mọi thiết bị

**Tính năng UI**:

- Header với thông tin công ty
- Card thông tin dự án
- Timeline các công đoạn sản xuất
- Icons và màu sắc theo trạng thái
- Loading states và error handling

### 2.3. Triển khai Netlify

**Bước 1**: Tạo GitHub repository

```bash
cd website-tracker
git init
git add .
git commit -m "Initial commit: THP Project Tracker"
git remote add origin https://github.com/YOUR_USERNAME/thp-project-tracker.git
git push -u origin main
```

**Bước 2**: Kết nối Netlify

1. Đăng nhập [Netlify](https://netlify.com)
2. "New site from Git" → Chọn GitHub
3. Chọn repository `thp-project-tracker`
4. Cấu hình build: `npm run build`, publish: `build`

**Bước 3**: Tùy chỉnh domain

- Đổi tên miền phụ: `tanhoaphat.netlify.app`
- Tùy chọn: Thêm domain tùy chỉnh `tracker.thp.com.vn`

## Thành Phần 3: Mobile App Integration

### 3.1. Cập nhật ProjectDetailScreen.js

**File**: `src/screens/ProjectDetailScreen.js`

**Thay đổi**: Thêm nút "Chia sẻ Link Theo dõi" vào Action Buttons.

```javascript
// Thêm import Share
import { Share } from 'react-native';

// Thêm nút mới vào Action Buttons
<TouchableOpacity
  style={styles.tileButton}
  onPress={async () => {
    // Logic chia sẻ link theo dõi
    const trackingUrl = `https://tanhoaphat.netlify.app/track?token=${project.publicTrackingToken}`;
    await Share.share({
      message: `Theo dõi tiến độ dự án "${project.name}"...`,
      title: `Theo dõi dự án: ${project.name}`,
      url: trackingUrl,
    });
  }}
>
  <Ionicons name="share-social-outline" size={22} color="#2E7D32" />
  <Text style={styles.tileLabel}>Chia sẻ Link Theo dõi</Text>
</TouchableOpacity>;
```

## Luồng Hoạt Động

### 1. Tạo dự án mới

1. Quản lý tạo dự án trong Mobile App
2. Cloud Function `onProjectCreate` tự động tạo `publicTrackingToken`
3. Token được lưu vào Firestore

### 2. Chia sẻ link theo dõi

1. Quản lý nhấn nút "Chia sẻ Link Theo dõi"
2. Mobile App tạo URL: `https://tanhoaphat.netlify.app/track?token=ABC123...`
3. Sử dụng Share API để chia sẻ qua Zalo, Email, v.v.

### 3. Khách hàng xem tiến độ

1. Khách hàng mở link được chia sẻ
2. React Web App đọc token từ URL
3. Gọi API `getProjectStatusByToken` với token
4. Hiển thị tiến độ dự án theo thời gian thực

## Bảo Mật

### 1. Dữ liệu an toàn

- Chỉ hiển thị thông tin công khai
- Không bao giờ trả về dữ liệu nhạy cảm
- Token theo dõi duy nhất cho mỗi dự án

### 2. API Protection

- Cloud Function được bảo vệ bởi Firebase Security Rules
- CORS được cấu hình đúng cách
- Rate limiting có thể được thêm nếu cần

### 3. Token Management

- Token được tạo tự động khi dự án mới
- Token không thể được thay đổi bởi người dùng
- Token có thể được reset bởi admin nếu cần

## Triển Khai và Testing

### 1. Deploy Backend

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 2. Deploy Frontend

```bash
cd website-tracker
npm run build
# Push to GitHub, Netlify sẽ auto-deploy
```

### 3. Test Mobile App

```bash
# Trong thư mục gốc
npx expo start
```

### 4. Test End-to-End

1. Tạo dự án mới trong Mobile App
2. Kiểm tra `publicTrackingToken` được tạo trong Firestore
3. Nhấn nút "Chia sẻ Link Theo dõi"
4. Mở link trong trình duyệt
5. Kiểm tra dữ liệu hiển thị đúng

## Monitoring và Maintenance

### 1. Logs

- Cloud Function logs trong Firebase Console
- Netlify deploy logs
- Mobile App crash reports

### 2. Performance

- Monitor API response time
- Check website loading speed
- Track user engagement

### 3. Updates

- Regular dependency updates
- Security patches
- Feature enhancements

## Troubleshooting

### 1. Token không được tạo

- Kiểm tra Cloud Function logs
- Verify uuid package đã được cài đặt
- Check Firestore permissions

### 2. API không hoạt động

- Verify Cloud Function đã deploy
- Check CORS configuration
- Test API trực tiếp với Postman

### 3. Website không load

- Check Netlify build logs
- Verify build command và publish directory
- Check domain configuration

### 4. Mobile App lỗi

- Check console logs
- Verify Share API permissions
- Test với project có sẵn token

## Tài Liệu Tham Khảo

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [React Native Share API](https://reactnative.dev/docs/share)
- [Netlify Deployment](https://docs.netlify.com)
- [Create React App](https://create-react-app.dev)

## Liên Hệ Hỗ Trợ

- **Backend Issues**: Firebase Console logs
- **Frontend Issues**: Netlify deploy logs
- **Mobile App Issues**: Expo/React Native logs
- **General Support**: info@thp.com.vn

---

© 2024 THP - Công Ty TNHH Thương Mại & Sản Xuất
Hệ thống theo dõi tiến độ dự án công khai
