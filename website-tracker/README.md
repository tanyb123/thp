# THP Project Tracker - Website

Cổng thông tin theo dõi tiến độ dự án công khai cho khách hàng THP.

## Tính năng

- 🔍 Xem tiến độ dự án theo thời gian thực
- 📊 Timeline trực quan cho các công đoạn sản xuất
- 📱 Giao diện responsive, tương thích mọi thiết bị
- 🔐 Bảo mật cao, chỉ hiển thị thông tin an toàn
- 🌐 Không cần đăng nhập, chỉ cần token hợp lệ

## Cách sử dụng

### Cho khách hàng:

1. Nhận link theo dõi từ nhân viên THP
2. Mở link trong trình duyệt web
3. Xem tiến độ dự án và các công đoạn sản xuất

### Link theo dõi có dạng:

```
https://your-domain.com/track?token=abc123def456...
```

## Cài đặt và chạy

### Yêu cầu hệ thống

- Node.js 16+
- npm hoặc yarn

### Cài đặt dependencies

```bash
npm install
```

### Chạy development server

```bash
npm start
```

### Build production

```bash
npm run build
```

## Cấu trúc dự án

```
src/
├── components/
│   ├── TrackerPage.tsx    # Component chính hiển thị tiến độ
│   └── TrackerPage.css    # Styles cho TrackerPage
├── App.tsx                # Component gốc
└── App.css               # Styles chung
```

## API Endpoint

Website sử dụng Firebase Cloud Function `getProjectStatusByToken` để lấy dữ liệu:

- **URL**: `https://asia-southeast1-tanyb-fe4bf.cloudfunctions.net/getProjectStatusByToken`
- **Method**: GET
- **Parameter**: `token` (query string)
- **Response**: JSON chứa thông tin dự án an toàn

## Triển khai

### Netlify (Khuyến nghị)

1. Push code lên GitHub repository
2. Kết nối Netlify với GitHub
3. Cấu hình build command: `npm run build`
4. Cấu hình publish directory: `build`
5. Deploy

### Vercel

1. Push code lên GitHub repository
2. Kết nối Vercel với GitHub
3. Deploy tự động

## Bảo mật

- Chỉ hiển thị thông tin an toàn cho khách hàng
- Không bao giờ hiển thị dữ liệu nhạy cảm
- Token theo dõi được tạo tự động và duy nhất cho mỗi dự án
- API được bảo vệ bởi Firebase Security Rules

## Hỗ trợ

Nếu gặp vấn đề, vui lòng liên hệ:

- Email: info@thp.com.vn
- Hotline: 1900-xxxx

## License

© 2024 THP - Công Ty TNHH Thương Mại & Sản Xuất
