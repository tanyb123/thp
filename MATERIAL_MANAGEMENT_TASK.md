# TASK: Quản lý vật liệu và lưu giá phụ kiện

## Ngày tạo: 2024-12-19

## Mô tả

Hoàn thành tính năng quản lý vật liệu và sửa lỗi giá phụ kiện không được lưu trong ExpenseListScreen.

## Các thay đổi đã thực hiện

### 1. Tạo MaterialService (src/api/materialService.js)

- ✅ Thêm các function CRUD cho vật liệu:
  - `getMaterials()` - Lấy danh sách vật liệu
  - `getMaterialById()` - Lấy vật liệu theo ID
  - `addMaterial()` - Thêm vật liệu mới
  - `updateMaterial()` - Cập nhật vật liệu
  - `deleteMaterial()` - Xóa vật liệu
  - `getMaterialPriceByName()` - Lấy giá theo tên vật liệu
  - `getAllMaterialPrices()` - Lấy tất cả giá vật liệu

### 2. Cập nhật ProjectService (src/api/projectService.js)

- ✅ Thêm function lưu và lấy giá phụ kiện:
  - `saveProjectAccessoryPrice()` - Lưu giá phụ kiện cho project
  - `getProjectAccessoryPrice()` - Lấy giá phụ kiện đã lưu

### 3. Tạo MaterialManagementScreen (src/screens/MaterialManagementScreen.js)

- ✅ Màn hình quản lý vật liệu với các tính năng:
  - Hiển thị danh sách vật liệu
  - Thêm vật liệu mới
  - Sửa vật liệu
  - Xóa vật liệu
  - Kiểm tra quyền truy cập (thuong_mai, giam_doc, ke_toan)
  - UI responsive và thân thiện

### 4. Cập nhật ExpenseListScreen (src/screens/ExpenseListScreen.js)

- ✅ Sửa lỗi giá phụ kiện không được lưu:

  - Thêm state `savingAccessoryPrice` để hiển thị loading
  - Tạo function `handleAccessoryPriceChange()` để lưu giá khi thay đổi
  - Lấy giá phụ kiện đã lưu khi load màn hình
  - Hiển thị indicator khi đang lưu

- ✅ Cập nhật logic tính toán vật liệu:
  - Sử dụng giá từ database thay vì hardcode
  - Thêm state `materialPrices` để lưu giá từ database
  - Cập nhật function `getRateByMaterial()` để ưu tiên giá từ database
  - Thêm useEffect để tính toán lại khi giá thay đổi

### 5. Cập nhật Navigation (src/navigation/AppNavigator.js)

- ✅ Thêm route cho MaterialManagementScreen
- ✅ Import MaterialManagementScreen

### 6. Cập nhật HomeScreen (src/screens/HomeScreen.js)

- ✅ Thêm nút "Quản lý vật liệu" vào menu
- ✅ Chỉ hiển thị cho các role: thuong_mai, giam_doc, ke_toan
- ✅ Icon và mô tả phù hợp

## Cấu trúc Database

### Collection: materials

```javascript
{
  id: "auto-generated",
  name: "SUS304", // Tên vật liệu
  pricePerKg: 55000, // Giá/kg
  description: "Thép không gỉ SUS304", // Mô tả
  createdAt: timestamp,
  createdBy: "user_id",
  updatedAt: timestamp,
  updatedBy: "user_id"
}
```

### Collection: projects (cập nhật)

```javascript
{
  // ... existing fields
  accessoryPrice: 100000, // Giá phụ kiện đã lưu
  updatedAt: timestamp
}
```

## Quyền truy cập

- **Quản lý vật liệu**: thuong_mai, giam_doc, ke_toan
- **Xem chi phí dự án**: Tất cả role

## Tính năng đã hoàn thành

1. ✅ Lưu giá phụ kiện vào database
2. ✅ Lấy giá phụ kiện đã lưu khi vào màn hình
3. ✅ Hiển thị loading khi đang lưu
4. ✅ Tạo màn hình quản lý vật liệu
5. ✅ Sử dụng giá vật liệu từ database
6. ✅ Thêm nút điều hướng vào menu chính
7. ✅ Kiểm tra quyền truy cập

## Lưu ý

- Giá vật liệu từ database sẽ ưu tiên hơn giá hardcode
- Nếu không có giá trong database, sẽ sử dụng giá mặc định (SUS304: 55k/kg, SS400: 17k/kg)
- Giá phụ kiện được lưu theo từng project riêng biệt
- Màn hình quản lý vật liệu chỉ hiển thị cho các role có quyền

## Trạng thái

✅ HOÀN THÀNH

















