# Materials Context Auto-Expansion for AI Chat

## Tổng quan

Hệ thống tự động mở rộng context cho AI Chat bằng cách lấy thông tin vật tư từ:

1. **Báo giá mới nhất** trong project hiện tại
2. **File Excel mới nhất** trong Google Drive folder "Thống kê vật tư"

## Các Function Chính

### 1. `getAutoMaterialsContext(project, accessToken)`

Function chính để tự động lấy context vật tư.

**Parameters:**

- `project`: Object thông tin dự án
- `accessToken`: Google access token (tùy chọn, sẽ tự động lấy nếu không có)

**Returns:**

```javascript
{
  materialsContext: string,      // Context đã format để gửi cho AI
  materialsSource: string,       // 'quotation' | 'excel' | 'none' | 'error'
  materialsData: object          // Dữ liệu chi tiết về vật tư
}
```

**Ví dụ sử dụng:**

```javascript
import { getAutoMaterialsContext } from '../api/aiChatService';

const materialsContext = await getAutoMaterialsContext(project);
console.log('Source:', materialsContext.materialsSource);
console.log('Context:', materialsContext.materialsContext);
```

### 2. `createProjectContextPrompt(project)` (Đã cập nhật)

Function tạo prompt context cho dự án, tự động bao gồm thông tin vật tư.

**Ví dụ sử dụng:**

```javascript
import { createProjectContextPrompt } from '../api/aiChatService';

const contextPrompt = await createProjectContextPrompt(project);
// Context này đã bao gồm thông tin vật tư tự động
```

## Hook React: `useMaterialsContext`

Hook tiện ích để sử dụng trong React components.

**Ví dụ sử dụng:**

```javascript
import { useMaterialsContext } from '../hooks/useMaterialsContext';

const MyComponent = ({ project }) => {
  const {
    materialsContext,
    isLoading,
    error,
    hasMaterialsContext,
    materialsSource,
    materialsCount,
    materialsList,
    fetchMaterialsContext,
    refreshContext,
    clearCache,
  } = useMaterialsContext(project);

  // Tự động fetch khi component mount
  useEffect(() => {
    if (project) {
      fetchMaterialsContext();
    }
  }, [project]);

  return (
    <View>
      {isLoading && <ActivityIndicator />}
      {error && <Text>Lỗi: {error}</Text>}
      {hasMaterialsContext && <Text>Vật tư từ: {materialsSource}</Text>}
    </View>
  );
};
```

## Cách Hoạt Động

### 1. Lấy từ Báo Giá (Ưu tiên cao nhất)

- Tìm báo giá mới nhất trong project
- Parse danh sách vật tư từ `materials` hoặc `items`
- Format thành context với thông tin chi tiết

### 2. Parse từ Google Drive (Fallback)

- Tìm folder "Thống kê vật tư" trong project hoặc folder gốc
- Lấy file Excel mới nhất
- Parse dữ liệu theo cấu trúc cột chuẩn
- Format thành context

### 3. Cấu trúc Context Output

```
**Vật tư từ báo giá mới nhất (BG-001):**
- Tổng số vật tư: 15
- Danh sách vật tư:
  1. Tấm thép SS400 - Số lượng: 10 tấm - Đơn giá: 25,000 VNĐ
  2. Ống thép phi 50 - Số lượng: 20 ống - Đơn giá: 15,000 VNĐ
  ...
- Tổng giá trị báo giá: 500,000 VNĐ
```

## Tích Hợp với AI Chat

### Tự động trong `askAboutProject`

```javascript
// Function này đã tự động sử dụng context vật tư
const response = await askAboutProject(question, project, chatHistory);
```

### Sử dụng thủ công

```javascript
import { getAutoMaterialsContext } from '../api/aiChatService';

// Lấy context vật tư
const materialsContext = await getAutoMaterialsContext(project);

// Thêm vào prompt
const fullPrompt = basePrompt + materialsContext.materialsContext;

// Gửi cho AI
const aiResponse = await sendMessageToAI([
  { role: 'user', content: fullPrompt },
]);
```

## Cấu Hình Google Drive

### Folder Structure

```
Project Root/
├── Thống kê vật tư/
│   ├── Báo cáo vật tư tháng 1.xlsx
│   ├── Báo cáo vật tư tháng 2.xlsx
│   └── ...
```

### Cột Excel Chuẩn

- **STT**: Số thứ tự
- **Tên vật tư**: Tên hoặc mô tả vật tư
- **Mã vật tư**: Mã hàng hóa
- **Đơn vị tính**: Đơn vị (tấm, ống, kg...)
- **Số lượng**: Số lượng cần thiết
- **Đơn giá**: Giá đơn vị

## Xử Lý Lỗi

### Các trường hợp lỗi thường gặp:

1. **Không có access token**: Tự động đăng nhập Google
2. **Không tìm thấy folder**: Tìm trong folder gốc
3. **File Excel không đọc được**: Bỏ qua và trả về thông báo
4. **Không có dữ liệu**: Trả về context rỗng

### Log và Debug:

```javascript
// Bật log để debug
console.log('Materials context result:', materialsContext);

// Kiểm tra source
if (materialsContext.materialsSource === 'error') {
  console.error('Error details:', materialsContext.error);
}
```

## Performance & Cache

### Cache Strategy:

- Context được cache trong 5 phút
- Có thể force refresh khi cần
- Tự động clear cache khi có lỗi

### Optimization:

- Chỉ parse 20 vật tư đầu tiên để tránh context quá dài
- Sử dụng async/await để không block UI
- Error handling graceful để không crash app

## Testing

### Component Demo:

```javascript
import MaterialsContextDemo from '../components/MaterialsContextDemo';

// Sử dụng trong screen
<MaterialsContextDemo project={currentProject} />;
```

### Test Cases:

1. Project có báo giá với vật tư
2. Project không có báo giá, có file Excel
3. Project không có gì
4. Lỗi Google Drive API
5. File Excel format không chuẩn

## Troubleshooting

### Vật tư không hiển thị:

1. Kiểm tra quyền truy cập Google Drive
2. Kiểm tra tên folder "Thống kê vật tư"
3. Kiểm tra format file Excel
4. Kiểm tra console log

### Context quá dài:

1. Giới hạn số lượng vật tư hiển thị
2. Sử dụng cache để tránh parse lại
3. Format gọn gàng, chỉ hiển thị thông tin cần thiết

## Tương Lai

### Tính năng có thể thêm:

1. **Real-time sync**: Tự động cập nhật khi có file mới
2. **Smart parsing**: AI để parse file Excel không chuẩn
3. **Multi-format**: Hỗ trợ PDF, Word documents
4. **Batch processing**: Xử lý nhiều file cùng lúc
5. **Analytics**: Thống kê sử dụng context

### Tích hợp với hệ thống khác:

1. **Inventory Management**: Đồng bộ với kho vật tư
2. **Purchase Orders**: Tự động tạo đơn hàng
3. **Cost Analysis**: Phân tích chi phí vật tư
4. **Supplier Management**: Quản lý nhà cung cấp




















































