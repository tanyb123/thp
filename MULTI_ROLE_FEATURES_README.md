# Chức Năng Đa Role - THP App

## Tổng Quan

Đã mở rộng các chức năng cho công nhân, kỹ sư và kế toán trong màn hình Home Screen, bao gồm:

1. **Xem chấm công** - Xem lịch sử và thống kê chấm công
2. **Xin nghỉ phép** - Đăng ký và theo dõi đơn xin nghỉ phép
3. **Xin ứng lương** - Yêu cầu và theo dõi đơn xin ứng lương

## Các Role Được Hỗ Trợ

### 1. Công Nhân (`cong_nhan`)

- ✅ Chấm công vào/ra
- ✅ Xem chấm công
- ✅ Xin nghỉ phép
- ✅ Xin ứng lương
- ✅ Thêm giờ tăng ca

### 2. Kỹ Sư (`ky_su`)

- ✅ Chấm công vào/ra
- ✅ Xem chấm công
- ✅ Xin nghỉ phép
- ✅ Xin ứng lương
- ✅ Thêm giờ tăng ca

### 3. Kế Toán (`ke_toan`)

- ✅ Xem bảng chấm công (quản lý)
- ✅ Xem chấm công cá nhân
- ✅ Xin nghỉ phép
- ✅ Xin ứng lương

## Cách Hoạt Động

### Kiểm Tra Role

```javascript
// Trong HomeScreen.js
const isWorker = (user?.role || '').toLowerCase() === 'cong_nhan';
const isEngineer = (user?.role || '').toLowerCase() === 'ky_su';
const isAccountant = (user?.role || '').toLowerCase() === 'ke_toan';

// Các role có thể sử dụng chức năng chấm công, nghỉ phép, ứng lương
const canUseWorkerFeatures = isWorker || isEngineer || isAccountant;
```

### Hiển Thị Menu Chức Năng

```javascript
{
  /* Menu chức năng cho công nhân, kỹ sư, kế toán */
}
{
  canUseWorkerFeatures && (
    <WorkerFeaturesMenu
      userRole={user?.role}
      onNavigate={(screen) => navigation.navigate(screen)}
    />
  );
}
```

### Component WorkerFeaturesMenu

Component mới tự động hiển thị:

- **Icon và màu sắc** phù hợp với từng role
- **Tiêu đề** tương ứng với role
- **3 chức năng chính** giống nhau cho tất cả role

## Chức Năng Chấm Công

### Công Nhân & Kỹ Sư

- Chấm công vào/ra bình thường
- Thêm giờ tăng ca
- Xem thông tin chấm công hiện tại

### Kế Toán

- Chỉ xem bảng chấm công (quản lý)
- Không thể chấm công vào/ra
- Có thể xem chấm công cá nhân qua menu

## Cấu Trúc Component

### WorkerFeaturesMenu.js

```javascript
const WorkerFeaturesMenu = ({
  userRole, // Role của user
  onNavigate, // Function navigation
  style = {}, // Style tùy chỉnh
}) => {
  // Tự động xác định role và hiển thị phù hợp
  const getRoleTitle = () => {
    if (isWorker) return 'Chức năng công nhân';
    if (isEngineer) return 'Chức năng kỹ sư';
    if (isAccountant) return 'Chức năng kế toán';
    return 'Chức năng nhân viên';
  };

  const getRoleIcon = () => {
    if (isWorker) return 'construct-outline';
    if (isEngineer) return 'school-outline';
    if (isAccountant) return 'calculator-outline';
    return 'person-outline';
  };

  const getRoleColor = () => {
    if (isWorker) return '#4CAF50'; // Green
    if (isEngineer) return '#2196F3'; // Blue
    if (isAccountant) return '#FF9800'; // Orange
    return '#9C27B0'; // Purple
  };
};
```

## Menu Items

### 1. Xem Chấm Công

- **Icon**: `time-outline`
- **Màu**: `#4CAF50` (Green)
- **Màn hình**: `WorkerAttendance`
- **Chức năng**: Xem lịch sử và thống kê chấm công

### 2. Xin Nghỉ Phép

- **Icon**: `calendar-outline`
- **Màu**: `#FF9800` (Orange)
- **Màn hình**: `LeaveRequest`
- **Chức năng**: Đăng ký và theo dõi đơn xin nghỉ phép

### 3. Xin Ứng Lương

- **Icon**: `cash-outline`
- **Màu**: `#2196F3` (Blue)
- **Màn hình**: `AdvanceSalary`
- **Chức năng**: Yêu cầu và theo dõi đơn xin ứng lương

## Tích Hợp với HomeScreen

### Import Component

```javascript
import WorkerFeaturesMenu from '../components/WorkerFeaturesMenu';
```

### Sử Dụng

```javascript
{
  canUseWorkerFeatures && (
    <WorkerFeaturesMenu
      userRole={user?.role}
      onNavigate={(screen) => navigation.navigate(screen)}
    />
  );
}
```

### Thay Thế Code Cũ

Đã thay thế toàn bộ code menu cũ bằng component mới:

- Code gọn gàng hơn
- Dễ bảo trì và mở rộng
- Tự động thích ứng với role

## Cập Nhật Chấm Công

### Role Check

```javascript
const ROLE_CAN_ATTEND = ['ke_toan', 'cong_nhan', 'ky_su'];
```

### Hiển Thị Role Cụ Thể

```javascript
<Text>
  Chấm Công -{' '}
  {isWorker
    ? 'Công nhân'
    : isEngineer
    ? 'Kỹ sư'
    : isAccountant
    ? 'Kế toán'
    : 'Nhân viên'}
</Text>
```

### Logic Chấm Công

- **Kế toán**: Chỉ xem bảng chấm công
- **Kỹ sư**: Chấm công bình thường như công nhân
- **Công nhân**: Chấm công bình thường

## Lợi Ích

### 1. **Tính Nhất Quán**

- Tất cả role có giao diện giống nhau
- Trải nghiệm người dùng thống nhất
- Dễ dàng sử dụng

### 2. **Dễ Bảo Trì**

- Code tập trung trong một component
- Thay đổi một chỗ, áp dụng cho tất cả
- Giảm duplicate code

### 3. **Mở Rộng Dễ Dàng**

- Thêm role mới chỉ cần cập nhật component
- Thêm chức năng mới cho tất cả role
- Linh hoạt trong việc tùy chỉnh

### 4. **Giao Diện Đẹp**

- Icon và màu sắc phù hợp với từng role
- Layout responsive và thân thiện
- Thông tin bổ sung hữu ích

## Cách Sử Dụng

### 1. **Tự Động**

- Component tự động nhận diện role
- Hiển thị phù hợp với từng user
- Không cần cấu hình thêm

### 2. **Tùy Chỉnh**

```javascript
<WorkerFeaturesMenu
  userRole={user?.role}
  onNavigate={(screen) => navigation.navigate(screen)}
  style={{ marginBottom: 30 }} // Tùy chỉnh style
/>
```

### 3. **Mở Rộng**

```javascript
// Thêm role mới
const isNewRole = userRole?.toLowerCase() === 'new_role';

// Thêm chức năng mới
const newMenuItem = {
  id: 'new_feature',
  title: 'Chức năng mới',
  description: 'Mô tả chức năng',
  icon: 'new-icon',
  iconColor: '#FF5722',
  screen: 'NewFeatureScreen',
};
```

## Testing

### Test Cases

1. **Công nhân**: Tất cả chức năng hoạt động bình thường
2. **Kỹ sư**: Chấm công và menu chức năng hoạt động
3. **Kế toán**: Xem chấm công quản lý và menu chức năng
4. **Role khác**: Không hiển thị menu chức năng

### Kiểm Tra

- [ ] Menu hiển thị đúng cho từng role
- [ ] Icon và màu sắc phù hợp
- [ ] Navigation hoạt động chính xác
- [ ] Chấm công hoạt động theo role
- [ ] Giao diện responsive

## Troubleshooting

### Menu Không Hiển Thị

1. Kiểm tra `user?.role` có đúng không
2. Kiểm tra `canUseWorkerFeatures` có true không
3. Kiểm tra component có được import đúng không

### Chấm Công Không Hoạt Động

1. Kiểm tra role có trong `ROLE_CAN_ATTEND` không
2. Kiểm tra `canUseAttendance` có true không
3. Kiểm tra logic chấm công theo role

### Navigation Lỗi

1. Kiểm tra `onNavigate` function có được truyền đúng không
2. Kiểm tra screen name có tồn tại trong navigation không
3. Kiểm tra console log để debug

## Tương Lai

### Tính Năng Có Thể Thêm

1. **Role-based permissions**: Quyền khác nhau cho từng role
2. **Custom menu items**: Menu tùy chỉnh theo role
3. **Role switching**: Chuyển đổi role trong app
4. **Multi-role support**: User có thể có nhiều role

### Tích Hợp

1. **Admin panel**: Quản lý quyền role
2. **Audit log**: Ghi lại hoạt động theo role
3. **Role templates**: Template sẵn có cho role mới
4. **Dynamic permissions**: Quyền động theo context




















































