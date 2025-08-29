# Hướng Dẫn Test Hệ Thống Theo Dõi Tiến Độ Dự Án

## Tổng Quan

Hướng dẫn này sẽ giúp bạn test toàn bộ hệ thống theo dõi tiến độ dự án từ đầu đến cuối, bao gồm Backend, Frontend và Mobile App.

## Chuẩn Bị

### 1. Kiểm tra dependencies

```bash
# Trong thư mục functions
cd functions
npm list uuid cors

# Trong thư mục website-tracker
cd ../website-tracker
npm list
```

### 2. Kiểm tra cấu hình Firebase

- Đảm bảo Firebase project đã được cấu hình đúng
- Kiểm tra service account credentials
- Verify Firestore rules cho phép read/write

## Bước 1: Test Backend (Firebase Cloud Functions)

### 1.1. Build và Deploy Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 1.2. Kiểm tra Functions đã deploy

```bash
firebase functions:list
```

### 1.3. Test API Endpoint trực tiếp

Sử dụng Postman hoặc curl để test:

```bash
# Test với token không hợp lệ
curl "https://asia-southeast1-tanyb-fe4bf.cloudfunctions.net/getProjectStatusByToken?token=invalid"

# Expected response: 404 Not Found
```

### 1.4. Kiểm tra logs

```bash
firebase functions:log --only getProjectStatusByToken
```

## Bước 2: Test Frontend (React Web App)

### 2.1. Chạy development server

```bash
cd website-tracker
npm start
```

### 2.2. Test với token giả

Mở browser và truy cập:

```
http://localhost:3000/?token=test123
```

**Expected behavior:**

- Hiển thị thông báo lỗi "Không tìm thấy dự án với token này"
- Error message rõ ràng và dễ hiểu

### 2.3. Test responsive design

- Resize browser window
- Sử dụng Chrome DevTools để test mobile view
- Kiểm tra timeline hiển thị đúng trên mọi kích thước

### 2.4. Test error handling

- Test với token rỗng: `http://localhost:3000/`
- Test với token null: `http://localhost:3000/?token=`
- Test với token quá dài

## Bước 3: Test Mobile App Integration

### 3.1. Chạy Mobile App

```bash
# Trong thư mục gốc
npx expo start
```

### 3.2. Test nút "Chia sẻ Link Theo dõi"

1. Mở một dự án có sẵn trong Mobile App
2. Kiểm tra xem dự án có `publicTrackingToken` không
3. Nhấn nút "Chia sẻ Link Theo dõi"
4. Verify Share dialog hiển thị đúng

### 3.3. Test với dự án không có token

1. Tạo dự án mới (nếu chưa có)
2. Kiểm tra xem `publicTrackingToken` có được tạo tự động không
3. Nhấn nút chia sẻ và verify alert message

## Bước 4: Test End-to-End

### 4.1. Tạo dự án mới

1. Trong Mobile App, tạo dự án mới
2. Điền đầy đủ thông tin cần thiết
3. Lưu dự án

### 4.2. Kiểm tra token được tạo

1. Vào Firebase Console > Firestore
2. Tìm dự án vừa tạo
3. Verify field `publicTrackingToken` có giá trị

### 4.3. Chia sẻ link theo dõi

1. Trong Mobile App, mở dự án vừa tạo
2. Nhấn nút "Chia sẻ Link Theo dõi"
3. Copy link được chia sẻ

### 4.4. Test website với token thật

1. Mở link vừa copy trong browser
2. Verify website load thành công
3. Kiểm tra thông tin dự án hiển thị đúng
4. Verify timeline các công đoạn (nếu có)

## Bước 5: Test Performance và Security

### 5.1. Performance Testing

```bash
# Test API response time
curl -w "@curl-format.txt" -o /dev/null -s "https://asia-southeast1-tanyb-fe4bf.cloudfunctions.net/getProjectStatusByToken?token=YOUR_TOKEN"
```

### 5.2. Security Testing

- Verify chỉ trả về dữ liệu an toàn
- Test với token không hợp lệ
- Kiểm tra CORS configuration
- Verify không có SQL injection vulnerabilities

### 5.3. Load Testing

- Test với nhiều request đồng thời
- Monitor Firebase Function logs
- Check memory usage và timeout

## Bước 6: Test Production Deployment

### 6.1. Deploy to Netlify

```bash
cd website-tracker
npm run build
git add .
git commit -m "Build for production"
git push origin main
```

### 6.2. Verify Netlify deployment

1. Kiểm tra build logs
2. Test website trên domain Netlify
3. Verify CORS hoạt động với domain mới

### 6.3. Update Mobile App URL

Nếu domain thay đổi, cập nhật URL trong Mobile App:

```javascript
const trackingUrl = `https://YOUR_NEW_DOMAIN/track?token=${project.publicTrackingToken}`;
```

## Bước 7: Test User Experience

### 7.1. Test với người dùng thật

1. Chia sẻ link theo dõi với khách hàng
2. Yêu cầu feedback về giao diện
3. Kiểm tra tính dễ hiểu và sử dụng

### 7.2. Test trên nhiều thiết bị

- Desktop (Chrome, Firefox, Safari, Edge)
- Mobile (iOS Safari, Chrome Mobile)
- Tablet (iPad, Android tablet)

### 7.3. Test accessibility

- Keyboard navigation
- Screen reader compatibility
- Color contrast
- Font size scaling

## Troubleshooting

### Lỗi thường gặp và cách khắc phục

#### 1. Cloud Function không deploy

```bash
# Kiểm tra logs
firebase functions:log

# Verify dependencies
npm list

# Check TypeScript compilation
npm run build
```

#### 2. CORS errors

- Verify CORS configuration trong Cloud Function
- Check domain trong CORS policy
- Test với Postman để isolate issue

#### 3. Website không load

- Check Netlify build logs
- Verify build command và publish directory
- Check domain configuration

#### 4. Mobile App lỗi

- Check console logs
- Verify Share API permissions
- Test với project có sẵn token

#### 5. Token không được tạo

- Check Cloud Function logs
- Verify uuid package đã được cài đặt
- Check Firestore permissions

## Checklist Test

### Backend

- [ ] Functions build thành công
- [ ] Functions deploy thành công
- [ ] API endpoint trả về dữ liệu đúng
- [ ] Error handling hoạt động
- [ ] CORS configuration đúng

### Frontend

- [ ] Website load thành công
- [ ] Responsive design hoạt động
- [ ] Error states hiển thị đúng
- [ ] Loading states hoạt động
- [ ] Timeline hiển thị đúng

### Mobile App

- [ ] Nút chia sẻ hiển thị đúng
- [ ] Share dialog hoạt động
- [ ] Token được đọc đúng
- [ ] Error handling hoạt động

### End-to-End

- [ ] Tạo dự án mới tạo token
- [ ] Chia sẻ link hoạt động
- [ ] Website hiển thị dữ liệu đúng
- [ ] Performance đáp ứng yêu cầu

## Monitoring và Logs

### 1. Firebase Console

- Functions logs
- Firestore data
- Authentication logs

### 2. Netlify

- Deploy logs
- Build logs
- Function logs

### 3. Mobile App

- Console logs
- Error reports
- Performance metrics

## Kết Luận

Sau khi hoàn thành tất cả các bước test trên, hệ thống theo dõi tiến độ dự án sẽ sẵn sàng cho production use. Đảm bảo:

1. **Backend**: Cloud Functions hoạt động ổn định
2. **Frontend**: Website responsive và user-friendly
3. **Mobile App**: Integration hoàn chỉnh
4. **Security**: Dữ liệu được bảo vệ đúng cách
5. **Performance**: Đáp ứng yêu cầu về tốc độ

Nếu có vấn đề gì, hãy kiểm tra logs và sử dụng troubleshooting guide để khắc phục.
