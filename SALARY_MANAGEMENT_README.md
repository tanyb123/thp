# Hệ Thống Quản Lý Lương - THP App

## Tổng Quan

Hệ thống quản lý lương được thiết kế đặc biệt cho role **Kế toán** (`ke_toan`), cung cấp đầy đủ chức năng để:

1. **Quản lý phí cố định** - Cài đặt BHXH, phụ cấp, khấu trừ cố định
2. **Tạo phiếu lương** - Tạo và quản lý phiếu lương cho từng nhân viên
3. **Xuất Excel** - Tự động xuất phiếu lương Excel vào Google Drive folder "PHIEU LUONG"

## Các Chức Năng Chính

### 🏢 **Quản Lý Phí Cố Định**

#### **Loại Phí Hỗ Trợ**

- **Khấu trừ** (`deduction`) - Các khoản khấu trừ từ lương
- **Phụ cấp** (`allowance`) - Các khoản phụ cấp thêm vào lương
- **Bảo hiểm** (`insurance`) - BHXH, BHYT, BHTN

#### **Tính Năng**

- ✅ Thêm/sửa/xóa loại phí
- ✅ Cài đặt số tiền cố định
- ✅ Bật/tắt trạng thái hoạt động
- ✅ Mô tả chi tiết cho từng loại phí
- ✅ Thống kê theo loại phí

### 📋 **Tạo Phiếu Lương**

#### **Thông Tin Tự Động**

- **Chọn nhân viên**: Từ danh sách nhân viên có sẵn trong hệ thống
- **Tháng/năm lương**: Chọn tháng/năm cần tính lương
- **Lương cơ bản**: Tự động lấy từ User Management
- **Số ngày làm việc**: Tự động lấy từ hệ thống chấm công
- **Giờ tăng ca**: Tự động lấy từ hệ thống chấm công

#### **Tính Toán Tự Động**

- **Lương theo ngày**: `Lương ngày × Số ngày làm việc`
- **Lương tăng ca**: `Lương ngày × 1.5 × Số giờ tăng ca`
- **Tổng lương gộp**: Lương theo ngày + Lương tăng ca + Phụ cấp + Thưởng
- **Lương thực nhận**: Tổng lương gộp - Khấu trừ - Ứng lương

**Ví dụ**: Lương ngày 300k, đi 30 buổi, tăng ca 10 giờ

- Lương theo ngày: 300k × 30 = 9M
- Lương tăng ca: 300k × 1.5 × 10 = 4.5M
- Tổng lương gộp: 9M + 4.5M = 13.5M

#### **Khấu Trừ & Phụ Cấp**

- **Khấu trừ**: Tự động lấy từ phí cố định + thêm thủ công
- **Phụ cấp**: Tự động lấy từ phí cố định + thêm thủ công
- **Thưởng**: Thêm thủ công theo từng trường hợp
- **Ứng lương**: Tự động lấy từ hệ thống ứng lương đã duyệt

#### **Tích Hợp Tự Động**

- **User Management**: Lấy thông tin nhân viên, lương cơ bản, role
- **Attendance System**: Lấy số ngày làm việc, giờ tăng ca
- **Advance Salary**: Lấy ứng lương đã duyệt trong tháng
- **Fixed Fees**: Áp dụng các loại phí cố định đã cài đặt

### 📊 **Xuất Excel Tự Động**

#### **Đích Xuất**

- **Folder**: `PHIEU LUONG` (tự động tạo nếu chưa có)
- **Vị trí**: Root folder Google Drive của công ty
- **Tên file**: `Phiếu lương - [Tên NV] - Tháng [X]-[Năm].xlsx`

#### **Nội Dung Excel**

- **Sheet 1**: Thông tin nhân viên và tháng lương
- **Sheet 2**: Chi tiết lương (cơ bản, tăng ca)
- **Sheet 3**: Phụ cấp và thưởng
- **Sheet 4**: Khấu trừ và ứng lương
- **Sheet 5**: Tổng kết lương

## Cách Sử Dụng

### 1. **Truy Cập Hệ Thống**

Chỉ role **Kế toán** (`ke_toan`) mới thấy menu quản lý lương trong HomeScreen:

```javascript
{
  isAccountant && (
    <>
      <TouchableOpacity
        onPress={() => navigation.navigate('FixedFeesManagement')}
      >
        <Text>Quản lý phí cố định</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('SalarySlipCreation')}
      >
        <Text>Tạo phiếu lương</Text>
      </TouchableOpacity>
    </>
  );
}
```

### 2. **Thiết Lập Phí Cố Định**

#### **Bước 1: Vào màn hình "Quản lý phí cố định"**

- Nhấn nút "+" để thêm loại phí mới
- Chọn loại phí: Khấu trừ, Phụ cấp, hoặc Bảo hiểm
- Nhập tên và số tiền
- Thêm mô tả (tùy chọn)
- Bật/tắt trạng thái hoạt động

#### **Ví dụ Thiết Lập**

```
Khấu trừ:
- Bảo hiểm xã hội: 8% lương cơ bản
- Bảo hiểm y tế: 1.5% lương cơ bản
- Bảo hiểm thất nghiệp: 1% lương cơ bản

Phụ cấp:
- Phụ cấp ăn trưa: 500,000 VNĐ/tháng
- Phụ cấp xăng xe: 300,000 VNĐ/tháng
- Phụ cấp điện thoại: 200,000 VNĐ/tháng
```

### 3. **Tạo Phiếu Lương**

#### **Bước 1: Chọn nhân viên**

- Nhấn vào "Chọn nhân viên"
- Chọn từ danh sách nhân viên có sẵn trong hệ thống
- Hệ thống tự động load thông tin lương và chấm công

#### **Bước 2: Chọn tháng/năm lương**

- Chọn tháng và năm cần tính lương
- Hệ thống tự động load thông tin chấm công của tháng/năm đó
- Hiển thị số ngày làm việc, giờ tăng ca tự động

#### **Bước 3: Thêm khấu trừ/phụ cấp**

- **Khấu trừ**: Nhấn nút "+" màu đỏ
- **Phụ cấp**: Nhấn nút "+" màu xanh
- **Thưởng**: Nhấn nút "+" màu cam

#### **Bước 4: Tạo phiếu lương**

- Nhấn "Tạo phiếu lương"
- Hệ thống tự động:
  - Lấy thông tin nhân viên từ User Management
  - Lấy thông tin chấm công từ Attendance System
  - Lấy ứng lương từ Advance Salary System
  - Tính toán lương theo công thức chuẩn
  - Lưu phiếu lương vào database
- Chọn có xuất Excel ngay hay không

### 4. **Xuất Excel**

#### **Tự Động Sau Khi Tạo**

- Sau khi tạo phiếu lương thành công
- Hệ thống hỏi có muốn xuất Excel không
- Chọn "Có" để xuất ngay

#### **Xuất Thủ Công**

- Vào danh sách phiếu lương
- Chọn phiếu cần xuất
- Nhấn nút "Xuất Excel"

## Cấu Trúc Dữ Liệu

### **FixedFees Collection**

```javascript
{
  id: "fee_id",
  name: "Bảo hiểm xã hội",
  type: "insurance", // deduction | allowance | insurance
  amount: 500000,
  description: "8% lương cơ bản",
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: "user_id"
}
```

### **SalarySlips Collection**

```javascript
{
  id: "salary_id",
  employeeId: "emp_id",
  employeeName: "Nguyễn Văn A",
  month: 12,
  year: 2024,
  basicSalary: 15000000,
  workingDays: 22,
  overtimeHours: 8,
  deductions: [
    { name: "BHXH", amount: 1200000 },
    { name: "BHYT", amount: 225000 }
  ],
  allowances: [
    { name: "Phụ cấp ăn trưa", amount: 500000 }
  ],
  bonuses: [
    { name: "Thưởng cuối năm", amount: 2000000 }
  ],
  advancePayments: [
    { reason: "Ứng lương tháng 11", amount: 3000000 }
  ],
  calculatedSalary: {
    dailySalary: 576923,
    salaryByDays: 12692306,
    overtimeSalary: 865385,
    totalAllowances: 500000,
    totalBonuses: 2000000,
    totalDeductions: 1425000,
    totalAdvancePayments: 3000000,
    grossSalary: 16057691,
    netSalary: 11632691
  },
  status: "pending", // pending | approved | paid | exported
  notes: "Phiếu lương tháng 12/2024",
  excelFileId: "drive_file_id",
  excelFileName: "Phiếu lương - Nguyễn Văn A - Tháng 12-2024.xlsx",
  excelFileUrl: "https://drive.google.com/...",
  exportedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: "user_id"
}
```

## Cloud Functions

### **exportSalarySlipToDrive**

- **Chức năng**: Xuất phiếu lương Excel vào Google Drive
- **Input**: `salarySlipId`, `accessToken`
- **Output**: File Excel trong folder "PHIEU LUONG"
- **Xử lý**: Tạo Excel với 5 sheet, upload vào Drive

### **exportMultipleSalarySlips**

- **Chức năng**: Xuất nhiều phiếu lương cùng lúc
- **Input**: `salarySlipIds[]`, `accessToken`, `month`, `year`
- **Output**: Nhiều file Excel
- **Xử lý**: Batch export cho từng phiếu lương

## Tích Hợp Google Drive

### **Folder Structure**

```
Root Folder (1Ci_BHZx0-Uhv2xg5IzwLPn05yPAUXOOU)
├── Thống kê vật tư/
├── PHIEU LUONG/          ← Tự động tạo
│   ├── Phiếu lương - NV A - Tháng 12-2024.xlsx
│   ├── Phiếu lương - NV B - Tháng 12-2024.xlsx
│   └── ...
└── ...
```

### **File Naming Convention**

```
Phiếu lương - [Tên Nhân Viên] - Tháng [X]-[Năm].xlsx

Ví dụ:
- Phiếu lương - Nguyễn Văn A - Tháng 12-2024.xlsx
- Phiếu lương - Trần Thị B - Tháng 1-2025.xlsx
```

## Quyền Truy Cập

### **Role-Based Access**

- **Kế toán** (`ke_toan`): Toàn quyền truy cập
- **Các role khác**: Không thấy menu quản lý lương

### **Google Drive Permissions**

- Cần đăng nhập Google Signin
- Cần access token để upload file
- Tự động tạo folder nếu chưa có

## Lợi Ích

### 1. **Tự Động Hóa**

- Tính toán lương tự động
- Xuất Excel tự động vào Drive
- Không cần copy/paste thủ công

### 2. **Chính Xác**

- Công thức tính lương chuẩn
- Tự động lấy ứng lương từ hệ thống
- Không có lỗi tính toán

### 3. **Quản Lý Tập Trung**

- Tất cả phí cố định ở một nơi
- Lịch sử phiếu lương đầy đủ
- Dễ dàng tra cứu và báo cáo

### 4. **Tích Hợp Hoàn Chỉnh**

- Kết nối với hệ thống chấm công
- Kết nối với hệ thống ứng lương
- Xuất Excel vào Google Drive

## Troubleshooting

### **Lỗi Thường Gặp**

#### **1. Không thể xuất Excel**

- Kiểm tra Google Signin đã đăng nhập chưa
- Kiểm tra quyền truy cập Google Drive
- Kiểm tra kết nối internet

#### **2. Tính lương sai**

- Kiểm tra lương cơ bản có đúng không
- Kiểm tra số ngày làm việc
- Kiểm tra các khoản khấu trừ/phụ cấp

#### **3. Không thấy menu quản lý lương**

- Kiểm tra role có phải `ke_toan` không
- Kiểm tra đã đăng nhập thành công chưa
- Refresh lại HomeScreen

### **Debug Tips**

```javascript
// Kiểm tra role user
console.log('User role:', user?.role);

// Kiểm tra quyền truy cập
console.log('Can access salary management:', isAccountant);

// Kiểm tra Google Signin
const tokens = await GoogleSignin.getTokens();
console.log('Google tokens:', tokens);
```

## Tương Lai

### **Tính Năng Có Thể Thêm**

1. **Batch Processing**: Xử lý hàng loạt phiếu lương
2. **Salary Templates**: Template sẵn có cho từng vị trí
3. **Auto Calculation**: Tự động tính lương theo thời gian
4. **Salary Reports**: Báo cáo tổng hợp lương
5. **Tax Calculation**: Tính thuế thu nhập cá nhân
6. **Bank Integration**: Chuyển lương tự động

### **Tích Hợp Nâng Cao**

1. **ERP Systems**: Kết nối với hệ thống ERP
2. **Accounting Software**: Tích hợp phần mềm kế toán
3. **Mobile App**: Ứng dụng mobile cho nhân viên
4. **API Integration**: API cho bên thứ 3

## Kết Luận

Hệ thống quản lý lương cung cấp giải pháp toàn diện cho kế toán:

- ✅ **Dễ sử dụng**: Giao diện thân thiện, thao tác đơn giản
- ✅ **Tự động hóa**: Tính toán và xuất Excel tự động
- ✅ **Chính xác**: Công thức tính lương chuẩn, không có lỗi
- ✅ **Tích hợp**: Kết nối với các hệ thống khác
- ✅ **Bảo mật**: Chỉ kế toán mới có quyền truy cập
- ✅ **Linh hoạt**: Tùy chỉnh theo nhu cầu công ty

Với hệ thống này, kế toán có thể quản lý lương một cách hiệu quả, chính xác và tiết kiệm thời gian đáng kể.
