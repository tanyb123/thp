# 🧪 Test Custom Icons với State-Aware

## ✅ **Đã implement:**

### **1. Build-time Custom Icons:**

- ✅ `laser_cutting` → `laser_17118713.png`
- ✅ `painting` → `paint-bucket_4228960.png` (empty) / `paint-bucket_4229235.png` (full)
- ✅ `son` → `paint-bucket_4228960.png` (empty) / `paint-bucket_4229235.png` (full)

### **2. State-Aware Logic:**

- ✅ **Chưa hoàn thành:** Hiển thị paint bucket empty
- ✅ **Đã hoàn thành:** Hiển thị paint bucket full + dấu tích xanh
- ✅ **Laser:** Luôn dùng cùng 1 icon (không thay đổi theo state)

## 🧪 **Cách test trong app:**

### **Bước 1: Tạo project test**

1. Mở app
2. Tạo project mới với tên "Test Custom Icons"
3. Thêm các stages với processKey:
   - `laser_cutting` (để test icon không đổi)
   - `painting` (để test state change)
   - `son` (để test state change)

### **Bước 2: Kiểm tra trạng thái chưa hoàn thành**

- ✅ `laser_cutting`: Thấy laser icon
- ✅ `painting`: Thấy paint bucket empty (không có sơn chảy)
- ✅ `son`: Thấy paint bucket empty (không có sơn chảy)

### **Bước 3: Đánh dấu hoàn thành**

1. Tap vào stage `painting` → Mark completed
2. Tap vào stage `son` → Mark completed
3. Kiểm tra:
   - ✅ `painting`: Paint bucket full (có sơn chảy) + dấu tích xanh
   - ✅ `son`: Paint bucket full (có sơn chảy) + dấu tích xanh
   - ✅ `laser_cutting`: Vẫn laser icon (không đổi) + dấu tích xanh nếu completed

## 🎯 **Kết quả mong đợi:**

| ProcessKey      | Chưa hoàn thành | Đã hoàn thành       |
| --------------- | --------------- | ------------------- |
| `laser_cutting` | 🔥 Laser icon   | 🔥 Laser icon + ✅  |
| `painting`      | 🪣 Empty bucket | 🎨 Full bucket + ✅ |
| `son`           | 🪣 Empty bucket | 🎨 Full bucket + ✅ |

## 🔧 **Troubleshooting:**

### **Nếu không thấy custom icons:**

1. Check console logs có lỗi không
2. Verify file paths trong `buildTimeIcons.js`
3. Restart Expo dev server
4. Clear cache: `npx expo start -c`

### **Nếu state không thay đổi:**

1. Check `getStageIcon()` có nhận đúng `isCompleted` không
2. Verify `getBuildTimeIconByState()` logic
3. Check `COMPLETED_STATE_ICONS` mapping

### **Nếu app crash:**

1. Check import paths
2. Verify PNG files tồn tại
3. Check file size không quá lớn

## 📱 **Test trên production build:**

```bash
# Build test APK
eas build --platform android --profile preview

# Install và test
# Verify custom icons có sẵn ngay khi install
# Không cần upload runtime
```

## 🎉 **Khi nào coi như thành công:**

- ✅ Custom icons hiển thị trong dev
- ✅ State change hoạt động đúng
- ✅ Dấu tích xanh vẫn hiển thị khi completed
- ✅ Fallback về Ionicons cho processKey khác
- ✅ Production build có custom icons sẵn

---

**🚀 Ready to test! Hãy mở app và thử nghiệm!**

































































































































