# 📱 Hướng dẫn Custom Icons cho Production App

## ❌ **Vấn đề hiện tại:**

- Custom icons upload trong dev **KHÔNG** được giữ lại khi build app
- User tải app từ Google Play sẽ chỉ thấy default Ionicons
- AsyncStorage và DocumentDirectory chỉ tồn tại trên thiết bị dev

## ✅ **Giải pháp:**

### **Phương án 1: Build-time Custom Icons (Khuyến nghị)**

#### **Bước 1: Chuẩn bị icons**

1. Tạo/tìm icon cho từng processKey (PNG, 24x24px)
2. Đặt vào thư mục `src/assets/custom-icons/`
3. Đặt tên theo format: `{processKey}-icon.png`

```
src/assets/custom-icons/
├── milling-icon.png
├── welding-icon.png
├── laser-cutting-icon.png
└── assembly-icon.png
```

#### **Bước 2: Cập nhật buildTimeIcons.js**

```javascript
// src/utils/buildTimeIcons.js
const millingIcon = require('../assets/custom-icons/milling-icon.png');
const weldingIcon = require('../assets/custom-icons/welding-icon.png');

export const BUILD_TIME_CUSTOM_ICONS = {
  milling: millingIcon,
  welding: weldingIcon,
  laser_cutting: require('../assets/custom-icons/laser-cutting-icon.png'),
  // Thêm các processKey khác...
};
```

#### **Bước 3: Build và test**

```bash
# Build app với custom icons
expo build:android
# hoặc
eas build --platform android
```

#### **Kết quả:**

- ✅ Custom icons có sẵn cho tất cả users
- ✅ Không cần upload runtime
- ✅ Hiệu suất tốt hơn
- ✅ Đáng tin cậy

---

### **Phương án 2: Cloud Storage (Phức tạp hơn)**

#### **Cách hoạt động:**

1. Upload icons lên Firebase Storage/AWS S3
2. App tải icons từ cloud khi khởi động
3. Cache local để sử dụng offline

#### **Ưu điểm:**

- ✅ Có thể cập nhật icons mà không cần build lại app
- ✅ Quản lý tập trung

#### **Nhược điểm:**

- ❌ Phức tạp hơn nhiều
- ❌ Cần internet để tải icons
- ❌ Chi phí cloud storage

---

### **Phương án 3: Hybrid (Tốt nhất)**

#### **Cách hoạt động:**

1. **Build-time icons:** Các icon quan trọng, thường dùng
2. **Runtime upload:** Cho phép admin upload thêm icons mới
3. **Priority system:** Runtime > Build-time > Default

#### **Đã implement sẵn:**

```javascript
// Thứ tự ưu tiên trong getStageIcon():
// 1. Custom icons (runtime upload)
// 2. Build-time custom icons
// 3. Default Ionicons
```

---

## 🚀 **Hướng dẫn thực hiện cho dự án của bạn:**

### **Bước 1: Tạo icons cho các processKey quan trọng**

```
Cần icons cho:
- milling (phay)
- welding (hàn)
- laser_cutting (cắt laser)
- assembly (lắp ráp)
- inspection (kiểm tra)
```

### **Bước 2: Thêm vào buildTimeIcons.js**

```javascript
// Uncomment và thêm:
const millingIcon = require('../assets/custom-icons/milling-icon.png');

export const BUILD_TIME_CUSTOM_ICONS = {
  milling: millingIcon,
  // Thêm các processKey khác
};
```

### **Bước 3: Test trong dev**

1. Restart app
2. Kiểm tra processKey có hiển thị custom icon không
3. Verify trong StarboardScreen

### **Bước 4: Build production**

```bash
# Build với custom icons
eas build --platform android --profile production
```

### **Bước 5: Test production build**

1. Install APK trên thiết bị test
2. Kiểm tra custom icons có hiển thị không
3. Verify không có lỗi

---

## 📋 **Checklist trước khi publish:**

- [ ] Custom icons đã được thêm vào `src/assets/custom-icons/`
- [ ] `buildTimeIcons.js` đã được cập nhật
- [ ] Test trong dev environment
- [ ] Build production và test APK
- [ ] Verify icons hiển thị đúng trong StarboardScreen
- [ ] Không có lỗi console

---

## 🔧 **Troubleshooting:**

### **Icon không hiển thị:**

1. Check file path trong `require()`
2. Verify file tồn tại trong assets
3. Check console logs

### **App crash:**

1. Check import syntax
2. Verify file format (PNG)
3. Check file size không quá lớn

### **Performance issues:**

1. Optimize icon size (24x24px)
2. Use PNG với compression
3. Limit số lượng custom icons

---

## 💡 **Khuyến nghị:**

1. **Sử dụng Phương án 1** cho hầu hết trường hợp
2. **Giữ runtime upload** cho admin flexibility
3. **Optimize icon size** để app không quá nặng
4. **Test kỹ** trước khi publish lên Google Play

Với cách này, users tải app từ Google Play sẽ thấy custom icons mà bạn đã chuẩn bị sẵn! 🎉

































































































































