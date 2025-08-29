# Chức Năng Cho Công Nhân - THP App

## Tổng Quan

Đã thêm các chức năng mới cho role `cong_nhan` trong màn hình Home Screen, bao gồm:

1. **Xem chấm công** - Xem lịch sử và thống kê chấm công
2. **Xin nghỉ phép** - Đăng ký và theo dõi đơn xin nghỉ phép
3. **Xin ứng lương** - Yêu cầu và theo dõi đơn xin ứng lương

## Cách Sử Dụng

### 1. Xem Chấm Công

- **Màn hình**: `WorkerAttendanceScreen`
- **Chức năng**:
  - Xem thống kê tổng quan theo tháng (ngày làm việc, giờ làm việc, giờ tăng ca)
  - Chọn tháng/năm để xem lịch sử
  - Hiển thị chi tiết từng ngày chấm công
  - Tính toán giờ làm việc tự động

### 2. Xin Nghỉ Phép

- **Màn hình**: `LeaveRequestScreen`
- **Chức năng**:
  - Đăng ký nghỉ phép với các loại: nghỉ phép năm, nghỉ ốm, việc riêng, thai sản
  - Chọn ngày bắt đầu và kết thúc
  - Nhập lý do nghỉ phép
  - Xem lịch sử đơn xin nghỉ và trạng thái duyệt

### 3. Xin Ứng Lương

- **Màn hình**: `AdvanceSalaryScreen`
- **Chức năng**:
  - Đăng ký ứng lương với số tiền và lý do
  - Chọn ngày yêu cầu và dự kiến chi
  - Xem lịch sử đơn xin ứng lương và trạng thái duyệt
  - Thống kê tổng quan theo trạng thái

## Cấu Trúc Dữ Liệu

### Attendance (Chấm Công)

```javascript
{
  id: "userId_YYYY-MM-DD",
  userId: "user123",
  date: "2024-01-15",
  clockIn: Timestamp,
  clockOut: Timestamp,
  overtime: 2,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Leave Request (Đơn Xin Nghỉ)

```javascript
{
  id: "request123",
  userId: "user123",
  type: "annual", // annual, sick, personal, maternity
  startDate: Date,
  endDate: Date,
  reason: "Lý do nghỉ phép",
  status: "pending", // pending, approved, rejected
  submittedAt: Date
}
```

### Advance Salary Request (Đơn Xin Ứng Lương)

```javascript
{
  id: "advance123",
  userId: "user123",
  amount: 2000000,
  reason: "Lý do ứng lương",
  requestDate: Date,
  expectedPaymentDate: Date,
  status: "pending", // pending, approved, rejected
  submittedAt: Date
}
```

## API Functions

### Attendance Service

- `getAttendance(userId, dateStr)` - Lấy thông tin chấm công theo ngày
- `getAttendanceHistory(userId, year, month)` - Lấy lịch sử chấm công theo tháng
- `getAttendanceSummary(userId, year, month)` - Lấy thống kê chấm công theo tháng
- `clockIn(userId, timestamp)` - Chấm công vào
- `clockOut(userId, timestamp)` - Chấm công ra
- `addOvertime(userId, hours)` - Thêm giờ tăng ca

## Navigation

Các màn hình mới đã được thêm vào `AppNavigator.js`:

```javascript
// Worker Screens
<Stack.Screen
  name="WorkerAttendance"
  component={WorkerAttendanceScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="LeaveRequest"
  component={LeaveRequestScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="AdvanceSalary"
  component={AdvanceSalaryScreen}
  options={{ headerShown: false }}
/>
```

## Home Screen Integration

Trong `HomeScreen.js`, đã thêm menu chức năng cho công nhân:

```javascript
{
  /* Menu chức năng cho công nhân */
}
{
  isWorker && (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      <Text style={styles.sectionTitle}>Chức năng công nhân</Text>
      <View style={styles.workerMenuGrid}>{/* Các nút chức năng */}</View>
    </View>
  );
}
```

## Lưu Ý Quan Trọng

1. **Role Check**: Chỉ hiển thị cho user có role `cong_nhan`
2. **Data Loading**: Sử dụng real-time data từ Firestore
3. **Error Handling**: Có xử lý lỗi và loading states
4. **Responsive Design**: Giao diện thân thiện với mobile
5. **Theme Support**: Hỗ trợ cả light và dark theme

## Cài Đặt

Không cần cài đặt thêm packages, chỉ cần:

1. Đảm bảo Firebase đã được cấu hình
2. Có quyền truy cập Firestore
3. User có role `cong_nhan` trong hệ thống

## Troubleshooting

### Lỗi thường gặp:

1. **"getAttendanceHistory is not a function"** - Kiểm tra import từ attendanceService
2. **Không load được dữ liệu** - Kiểm tra kết nối Firebase và quyền truy cập
3. **UI không hiển thị** - Kiểm tra role của user và điều kiện render

### Debug:

- Sử dụng console.log để kiểm tra data loading
- Kiểm tra Firestore rules
- Xác nhận user.uid tồn tại


