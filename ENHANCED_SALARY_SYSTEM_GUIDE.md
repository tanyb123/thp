# Hệ Thống Lương Cải Tiến - Hướng Dẫn Sử Dụng

## 🎯 **Các Cải Tiến Chính**

### ✅ **1. Bảo Hiểm Linh Hoạt Theo Phần Trăm**

- **Trước**: Chỉ nhập số tiền cố định (VD: 500,000 VNĐ)
- **Sau**: Hỗ trợ cả số tiền cố định và phần trăm theo lương (VD: 8%)

### ✅ **2. Tự Động Trừ Tạm Ứng Lương**

- **Trước**: Phải nhập thủ công tạm ứng
- **Sau**: Tự động lấy từ advanced requests đã được giám đốc duyệt

### ✅ **3. Giao Diện Phiếu Lương Đầy Đủ**

- **Trước**: Hiển thị rời rạc, không có tổng kết
- **Sau**: Hiển thị đầy đủ như template Excel thực tế

### ✅ **4. Quản Lý Cấu Hình Linh Hoạt**

- **Trước**: Hard-code BHXH 8%, BHYT 1.5%, BHTN 1%
- **Sau**: Cấu hình linh hoạt từ màn hình "Quản lý phí cố định"

---

## 🔧 **Hướng Dẫn Sử Dụng**

### **Bước 1: Cấu Hình Phí Cố Định**

1. **Vào màn hình "Quản lý phí cố định"**
2. **Thêm bảo hiểm theo phần trăm**:

```
Tên: BHXH
Loại: Bảo hiểm
Cách tính: Theo phần trăm lương
Phần trăm: 8%
Mô tả: Bảo hiểm xã hội

Tên: BHYT
Loại: Bảo hiểm
Cách tính: Theo phần trăm lương
Phần trăm: 1.5%
Mô tả: Bảo hiểm y tế

Tên: BHTN
Loại: Bảo hiểm
Cách tính: Theo phần trăm lương
Phần trăm: 1%
Mô tả: Bảo hiểm thất nghiệp
```

3. **Thêm phụ cấp cố định** (nếu có):

```
Tên: Phụ cấp ăn trưa
Loại: Phụ cấp
Cách tính: Số tiền cố định
Số tiền: 500,000 VNĐ
```

### **Bước 2: Tạo Phiếu Lương**

1. **Chọn nhân viên** từ danh sách
2. **Chọn tháng/năm** cần tính lương
3. **Hệ thống sẽ tự động**:

   - ✅ Lấy thông tin lương cơ bản từ User Management
   - ✅ Lấy số ngày công + tăng ca từ hệ thống chấm công
   - ✅ Lấy tạm ứng đã duyệt từ Advanced Requests
   - ✅ Tính bảo hiểm theo % đã cấu hình
   - ✅ Hiển thị tổng kết đầy đủ

4. **Thêm thủ công** (nếu cần):

   - Phụ cấp đặc biệt cho tháng này
   - Thưởng tháng/quý/năm
   - Khấu trừ đặc biệt (phạt, bồi thường...)

5. **Kiểm tra tổng kết** và **tạo phiếu lương**

---

## 📊 **Ví Dụ Cụ Thể**

### **Nhân Viên A - Tháng 8/2025:**

**📋 Thông Tin Cơ Bản:**

- Lương ngày: 500,000 VNĐ
- Số ngày công: 22 ngày
- Số ngày tăng ca: 3 ngày

**💰 Tính Lương:**

- Lương theo ngày: 500k × 22 = 11,000,000 VNĐ
- Lương tăng ca: 500k × 1.5 × 3 = 2,250,000 VNĐ
- **Tổng lương gộp**: 13,250,000 VNĐ

**➖ Khấu Trừ Tự Động:**

- BHXH (8%): 1,060,000 VNĐ
- BHYT (1.5%): 198,750 VNĐ
- BHTN (1%): 132,500 VNĐ
- **Tổng bảo hiểm**: 1,391,250 VNĐ

**💸 Tạm Ứng Đã Duyệt:**

- Ứng lương ngày 15/8: 2,000,000 VNĐ

**💵 Lương Thực Nhận:**

```
13,250,000 - 1,391,250 - 2,000,000 = 9,858,750 VNĐ
```

---

## 🔄 **Luồng Xử Lý Tạm Ứng**

### **1. Nhân Viên Gửi Yêu Cầu**

- Vào màn hình "Advance Salary"
- Nhập số tiền và lý do ứng lương
- Gửi yêu cầu → Status: `pending`

### **2. Giám Đốc Duyệt**

- Vào màn hình "Task Report" → Tab "Requests"
- Xem yêu cầu ứng lương
- Duyệt → Status: `approved`

### **3. Kế Toán Tạo Phiếu Lương**

- Hệ thống tự động lấy các request `approved` của tháng
- Tự động trừ vào phiếu lương
- Đánh dấu request đã được trừ: `salaryDeducted: true`

### **4. Tránh Trừ Trùng**

- Request đã trừ không xuất hiện ở tháng sau
- Chỉ lấy request chưa được trừ lương

---

## 🎨 **Giao Diện Mới**

### **Phiếu Lương Đầy Đủ:**

```
📋 THÔNG TIN NHÂN VIÊN
├── Tên: Nguyễn Văn A
├── Tháng: 8/2025
├── Lương ngày: 500,000 VNĐ
├── Số ngày công: 22 ngày
└── Số ngày tăng ca: 3 ngày

💰 TỔNG KẾT LƯƠNG
├── Lương theo ngày: 11,000,000 VNĐ
├── Lương tăng ca: 2,250,000 VNĐ
├── Tổng phụ cấp: 500,000 VNĐ
├── Tổng thưởng: 0 VNĐ
├── ━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Tổng lương gộp: 13,750,000 VNĐ
├──
├── Khấu trừ tự động: -1,391,250 VNĐ
├── Ứng lương trừ: -2,000,000 VNĐ
├── Khấu trừ khác: 0 VNĐ
└── ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    LƯƠNG THỰC NHẬN: 10,358,750 VNĐ
```

---

## ⚙️ **Cấu Hình Nâng Cao**

### **Thay Đổi Tỷ Lệ Bảo Hiểm:**

1. Vào "Quản lý phí cố định"
2. Tìm loại phí cần sửa (VD: BHXH)
3. Nhấn nút "Sửa"
4. Thay đổi phần trăm (VD: từ 8% thành 8.5%)
5. Lưu → Áp dụng cho phiếu lương sau

### **Thêm Loại Khấu Trừ Mới:**

```
Tên: Đoàn phí
Loại: Khấu trừ
Cách tính: Số tiền cố định
Số tiền: 50,000 VNĐ/tháng
```

### **Thêm Phụ Cấp Theo %:**

```
Tên: Phụ cấp hiệu suất
Loại: Phụ cấp
Cách tính: Theo phần trăm lương
Phần trăm: 5%
Mô tả: Thưởng theo hiệu suất làm việc
```

---

## 🚀 **Lợi Ích Của Hệ Thống Mới**

### **👩‍💼 Đối với Kế Toán:**

- ✅ Không cần nhập bảo hiểm thủ công
- ✅ Tự động trừ tạm ứng, tránh quên
- ✅ Giao diện đầy đủ, dễ kiểm tra
- ✅ Linh hoạt thay đổi tỷ lệ bảo hiểm theo năm

### **👷‍♂️ Đối với Nhân Viên:**

- ✅ Thấy rõ các khoản trừ (minh bạch)
- ✅ Không lo ứng lương bị quên trừ
- ✅ Phiếu lương chi tiết, dễ hiểu

### **👨‍💼 Đối với Giám Đốc:**

- ✅ Luồng duyệt ứng lương rõ ràng
- ✅ Tự động đồng bộ với phiếu lương
- ✅ Theo dõi được tình hình tài chính

---

## 📝 **Ghi Chú Quan Trọng**

### **⚠️ Cài Đặt Ban Đầu:**

1. **Phải cấu hình phí cố định trước** khi tạo phiếu lương
2. **Nên thử với 1 nhân viên** trước khi áp dụng hàng loạt
3. **Kiểm tra tỷ lệ bảo hiểm** theo quy định hiện hành

### **🔄 Backup Dữ Liệu:**

- Hệ thống sẽ tự động **đánh dấu** advance request đã trừ
- **Không thể trừ lặp lại** cùng một request
- Nếu có sai sót, cần **reset flag** `salaryDeducted = false` trong database

### **📊 Xuất Excel:**

- File Excel sẽ **bao gồm tất cả thông tin** mới
- **5 sheet** riêng biệt: Thông tin, Chi tiết, Phụ cấp, Khấu trừ, Tổng kết
- **Tự động upload** vào folder "PHIEU LUONG" trên Google Drive

---

_🎉 Hệ thống lương đã được cải tiến hoàn toàn để đáp ứng yêu cầu thực tế của doanh nghiệp!_

