# THP App - Quản lý Dự án và Khách hàng

Ứng dụng di động THP App được xây dựng bằng React Native và Expo, giúp quản lý khách hàng, dự án và báo giá cho công ty Tân Hòa Phát.

## Cấu trúc Thư mục

```
thpapp/
├── src/                         # Mã nguồn chính
│   ├── api/                     # Các dịch vụ API và tương tác với Firebase
│   │   ├── customerService.js   # Quản lý dữ liệu khách hàng
│   │   ├── projectService.js    # Quản lý dữ liệu dự án
│   │   ├── quotationService.js  # Xử lý báo giá
│   │   ├── taskService.js       # Quản lý các công việc trong dự án
│   │   └── googleDriveService.js # Tích hợp với Google Drive
│   │
│   ├── components/              # Các component tái sử dụng
│   │   ├── StatusIndicator.js   # Hiển thị trạng thái
│   │   └── StyledTextInput.js   # Input tùy chỉnh
│   │
│   ├── config/                  # Cấu hình ứng dụng
│   │   ├── authConfig.js        # Cấu hình xác thực
│   │   ├── colors.js            # Bảng màu ứng dụng
│   │   ├── firebaseConfig.js    # Cấu hình Firebase
│   │   └── quotationHtmlTemplate.js # Mẫu HTML cho báo giá
│   │
│   ├── contexts/                # Context API React
│   │   ├── AuthContext.js       # Quản lý xác thực người dùng
│   │   └── ThemeContext.js      # Quản lý theme ứng dụng
│   │
│   ├── navigation/              # Cấu hình điều hướng
│   │   └── AppNavigator.js      # Quản lý điều hướng ứng dụng
│   │
│   └── screens/                 # Các màn hình ứng dụng
│       ├── AccountScreen.js     # Màn hình tài khoản
│       ├── AddCustomerScreen.js # Thêm khách hàng mới
│       ├── AddProjectScreen.js  # Thêm dự án mới
│       ├── CustomerDetailScreen.js # Chi tiết khách hàng
│       ├── CustomerManagementScreen.js # Quản lý khách hàng
│       ├── EditCustomerScreen.js # Chỉnh sửa khách hàng
│       ├── EditProjectScreen.js # Chỉnh sửa dự án
│       ├── FinalizeQuotationScreen.js # Hoàn tất báo giá
│       ├── HomeScreen.js        # Màn hình chính
│       ├── LoginScreen.js       # Đăng nhập
│       ├── ProjectDetailScreen.js # Chi tiết dự án
│       ├── ProjectManagementScreen.js # Quản lý dự án
│       └── ProjectsScreen.js    # Danh sách dự án
│
├── assets/                      # Tài nguyên tĩnh (hình ảnh, font)
├── android/                     # Cấu hình Android
├── node_modules/                # Thư viện npm
├── .expo/                       # Cấu hình Expo
├── App.js                       # Điểm vào ứng dụng
├── app.json                     # Cấu hình ứng dụng Expo
├── eas.json                     # Cấu hình EAS Build
├── babel.config.js              # Cấu hình Babel
├── metro.config.js              # Cấu hình Metro
├── package.json                 # Quản lý phụ thuộc npm
└── package-lock.json            # Lock file npm
```

## Chức năng Chính

### 1. Quản lý Xác thực
- Đăng nhập/Đăng ký tài khoản
- Phân quyền người dùng
- Quên mật khẩu
- Hỗ trợ chế độ offline

### 2. Quản lý Khách hàng
- Xem danh sách khách hàng
- Thêm khách hàng mới
- Xem chi tiết khách hàng
- Chỉnh sửa thông tin khách hàng
- Tìm kiếm khách hàng

### 3. Quản lý Dự án
- Xem danh sách dự án
- Thêm dự án mới
- Xem chi tiết dự án
- Chỉnh sửa thông tin dự án
- Tìm kiếm dự án
- Lọc dự án theo trạng thái
- Xem dự án theo khách hàng

### 4. Quản lý Tiến độ Dự án
- Theo dõi tiến độ dự án qua các giai đoạn:
  - Báo giá
  - Phân tách vật liệu
  - Cắt vật liệu
  - Lắp ráp
  - Sơn
  - Vận chuyển
  - Các công việc tùy chỉnh khác
- Cập nhật trạng thái từng công đoạn

### 5. Quản lý Báo giá
- Tạo báo giá mới
- Thêm các mục vào báo giá
- Tính toán tổng chi phí
- Xuất báo giá sang PDF
- Chia sẻ báo giá

### 6. Tích hợp Google Drive
- Lưu trữ và chia sẻ tài liệu
- Quản lý tệp tin dự án

### 7. Tùy chỉnh Giao diện
- Hỗ trợ chế độ sáng/tối (Dark mode)
- Giao diện thân thiện với người dùng

## Công nghệ Sử dụng

- **React Native**: Framework phát triển ứng dụng di động
- **Expo**: Nền tảng phát triển React Native
- **Firebase**:
  - Authentication: Xác thực người dùng
  - Firestore: Cơ sở dữ liệu NoSQL
  - Storage: Lưu trữ tệp tin
- **React Navigation**: Điều hướng trong ứng dụng
- **React Native Community Components**: DateTimePicker, NetInfo
- **Expo Libraries**: FileSystem, MailComposer, Sharing, WebBrowser
- **XLSX**: Xử lý tệp Excel
- **Google Drive API**: Tích hợp lưu trữ đám mây

## Cài đặt và Chạy

### Yêu cầu hệ thống
- Node.js (>= 14.0.0)
- npm hoặc yarn
- Expo CLI
- Android Studio (cho máy ảo Android) hoặc thiết bị Android/iOS

### Cài đặt
```bash
# Clone repository
git clone https://github.com/your-username/thpapp.git
cd thpapp

# Cài đặt các phụ thuộc
npm install

# Chạy ứng dụng
npx expo start
```

### Build ứng dụng
```bash
# Build cho Android
eas build --platform android --profile production

# Build cho iOS
eas build --platform ios --profile production
```

