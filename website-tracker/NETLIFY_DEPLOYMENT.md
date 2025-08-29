# Hướng Dẫn Triển Khai Website Tracker Lên Netlify

## Bước 1: Chuẩn Bị GitHub Repository

### 1.1. Tạo Repository mới trên GitHub

1. Đăng nhập vào [GitHub](https://github.com)
2. Click "New repository"
3. Đặt tên: `thp-project-tracker` hoặc tên bạn muốn
4. Chọn "Public" hoặc "Private" (khuyến nghị Private)
5. Click "Create repository"

### 1.2. Push code lên GitHub

```bash
# Trong thư mục website-tracker
git init
git add .
git commit -m "Initial commit: THP Project Tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/thp-project-tracker.git
git push -u origin main
```

## Bước 2: Kết Nối Netlify với GitHub

### 2.1. Đăng nhập Netlify

1. Truy cập [Netlify](https://netlify.com)
2. Click "Sign up" hoặc "Log in"
3. Chọn "Sign up with GitHub" để kết nối trực tiếp

### 2.2. Tạo Site mới

1. Click "New site from Git"
2. Chọn "GitHub" làm Git provider
3. Chọn repository `thp-project-tracker`
4. Click "Deploy site"

## Bước 3: Cấu Hình Build Settings

### 3.1. Cấu hình Build Command

- **Build command**: `npm run build`
- **Publish directory**: `build`

### 3.2. Cấu hình Environment Variables (nếu cần)

Trong tab "Environment variables":

- `REACT_APP_API_URL`: URL của Cloud Function
- `REACT_APP_SITE_NAME`: Tên website

## Bước 4: Tùy Chỉnh Domain

### 4.1. Đổi tên miền phụ

1. Vào tab "Domain management"
2. Click "Change site name"
3. Đặt tên: `tanhoaphat` hoặc tên bạn muốn
4. URL sẽ là: `https://tanhoaphat.netlify.app`

### 4.2. Tùy chỉnh domain tùy chỉnh (tùy chọn)

1. Click "Add custom domain"
2. Nhập domain: `tracker.thp.com.vn`
3. Làm theo hướng dẫn cấu hình DNS

## Bước 5: Kiểm Tra và Test

### 5.1. Kiểm tra build

1. Vào tab "Deploys"
2. Kiểm tra build log có thành công không
3. Nếu có lỗi, sửa code và push lại

### 5.2. Test website

1. Mở URL: `https://tanhoaphat.netlify.app`
2. Test với token hợp lệ: `?token=test123`
3. Kiểm tra responsive trên mobile

## Bước 6: Cấu Hình Nâng Cao

### 6.1. Redirects (nếu cần)

Tạo file `public/_redirects`:

```
/*    /index.html   200
```

### 6.2. Headers bảo mật

Tạo file `public/_headers`:

```
/*
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
```

### 6.3. Analytics (tùy chọn)

1. Vào tab "Analytics"
2. Kích hoạt Netlify Analytics
3. Theo dõi traffic và performance

## Bước 7: Tự Động Hóa Deploy

### 7.1. Auto-deploy từ GitHub

- Mỗi khi push code lên `main` branch
- Netlify sẽ tự động build và deploy
- Có thể cấu hình preview deploy cho pull requests

### 7.2. Branch deploy

- Tạo branch mới để test tính năng
- Netlify sẽ tạo preview URL
- Merge vào main để deploy production

## Troubleshooting

### Lỗi Build

- Kiểm tra Node.js version trong `package.json`
- Kiểm tra dependencies có conflict không
- Xem build log chi tiết trong Netlify

### Lỗi CORS

- Kiểm tra Cloud Function có bật CORS không
- Kiểm tra domain trong CORS policy

### Lỗi API

- Kiểm tra URL Cloud Function có đúng không
- Kiểm tra Firebase Functions đã deploy chưa
- Test API trực tiếp với Postman

## Liên Hệ Hỗ Trợ

Nếu gặp vấn đề:

- Netlify Support: [support.netlify.com](https://support.netlify.com)
- GitHub Issues: Tạo issue trong repository
- THP Team: info@thp.com.vn

## Tài Liệu Tham Khảo

- [Netlify Docs](https://docs.netlify.com)
- [React Deployment](https://create-react-app.dev/docs/deployment)
- [Firebase Functions](https://firebase.google.com/docs/functions)
