import { firebase, functions } from '../config/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import googleDriveService from './googleDriveService';

/**
 * Service API để tương tác với Cloud Functions Inventory
 */
const InventoryService = {
  /**
   * Thêm vật tư mới
   * @param {Object} itemData - Thông tin vật tư
   * @returns {Promise<Object>}
   */
  async addInventoryItem(itemData) {
    try {
      console.log('=== INVENTORYSERVICE: BẮT ĐẦU THÊM VẬT TƯ ===');
      console.log('itemData nhận được:', JSON.stringify(itemData, null, 2));

      const addInventoryItemFn = httpsCallable(functions, 'addInventoryItem');
      console.log('=== INVENTORYSERVICE: GỌI CLOUD FUNCTION ===');

      const result = await addInventoryItemFn(itemData);
      console.log('=== INVENTORYSERVICE: KẾT QUẢ TỪ CLOUD FUNCTION ===');
      console.log('result:', result);
      console.log('result.data:', result.data);

      return result.data;
    } catch (error) {
      console.error('=== INVENTORYSERVICE: LỖI THÊM VẬT TƯ ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      console.error('=== END LỖI INVENTORYSERVICE ===');

      throw error;
    }
  },

  /**
   * Cập nhật thông tin vật tư
   * @param {string} itemId - ID vật tư
   * @param {Object} itemData - Thông tin cập nhật
   * @returns {Promise<Object>}
   */
  async updateInventoryItem(itemId, itemData) {
    try {
      const updateInventoryItemFn = httpsCallable(
        functions,
        'updateInventoryItem'
      );
      const result = await updateInventoryItemFn({
        itemId,
        itemData,
      });
      return result.data;
    } catch (error) {
      console.error('Lỗi cập nhật vật tư:', error);
      throw error;
    }
  },

  /**
   * Tạo giao dịch nhập/xuất kho
   * @param {Object} transactionData - Thông tin giao dịch
   * @returns {Promise<Object>}
   */
  async createTransaction(transactionData) {
    try {
      const createInventoryTransactionFn = httpsCallable(
        functions,
        'createInventoryTransaction'
      );
      const result = await createInventoryTransactionFn(transactionData);
      return result.data;
    } catch (error) {
      console.error('Lỗi tạo giao dịch kho:', error);
      throw error;
    }
  },

  /**
   * Lấy báo cáo tồn kho
   * @param {Object} filters - Bộ lọc báo cáo
   * @returns {Promise<Object>}
   */
  async getInventoryReport(filters = {}) {
    try {
      const getInventoryReportFn = httpsCallable(
        functions,
        'getInventoryReport'
      );
      const result = await getInventoryReportFn(filters);
      return result.data;
    } catch (error) {
      console.error('Lỗi lấy báo cáo tồn kho:', error);
      throw error;
    }
  },

  /**
   * Quản lý danh mục vật tư
   * @param {string} action - Hành động: 'add', 'update', 'delete'
   * @param {Object} categoryData - Thông tin danh mục
   * @param {string} categoryId - ID danh mục (cho update/delete)
   * @returns {Promise<Object>}
   */
  async manageCategory(action, categoryData, categoryId) {
    try {
      const manageCategoryFn = httpsCallable(
        functions,
        'manageInventoryCategory'
      );
      const result = await manageCategoryFn({
        action,
        categoryData,
        categoryId,
      });
      return result.data;
    } catch (error) {
      console.error('Lỗi quản lý danh mục:', error);
      throw error;
    }
  },

  /**
   * Lấy thống kê sử dụng vật tư theo dự án
   * @param {string} projectId - ID dự án
   * @param {string} startDate - Ngày bắt đầu (tùy chọn)
   * @param {string} endDate - Ngày kết thúc (tùy chọn)
   * @returns {Promise<Object>}
   */
  async getProjectMaterialUsage(projectId, startDate, endDate) {
    try {
      const getMaterialUsageFn = httpsCallable(
        functions,
        'getProjectMaterialUsage'
      );
      const result = await getMaterialUsageFn({
        projectId,
        startDate,
        endDate,
      });
      return result.data;
    } catch (error) {
      console.error('Lỗi lấy thống kê sử dụng vật tư:', error);
      throw error;
    }
  },

  /**
   * Upload hình ảnh vật tư
   * @param {string} itemId - ID vật tư
   * @param {Blob} imageBlob - Dữ liệu hình ảnh
   * @returns {Promise<string>} - URL hình ảnh
   */
  async uploadItemImage(itemId, imageBlob) {
    try {
      const storage = getStorage();
      const imageName = `inventory_items/${itemId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, imageName);

      // Upload hình ảnh
      await uploadBytes(storageRef, imageBlob);

      // Lấy URL download
      const downloadUrl = await getDownloadURL(storageRef);

      // Cập nhật URL hình ảnh vào thông tin vật tư
      await this.updateInventoryItem(itemId, { imageUrl: downloadUrl });

      return downloadUrl;
    } catch (error) {
      console.error('Lỗi upload hình ảnh vật tư:', error);
      throw error;
    }
  },

  /**
   * Lấy danh sách giao dịch của một vật tư
   * @param {string} itemId - ID vật tư
   * @returns {Promise<Array>} - Danh sách giao dịch
   */
  async getItemTransactions(itemId) {
    try {
      const snapshot = await firebase
        .firestore()
        .collection('inventory_transactions')
        .where('itemId', '==', itemId)
        .orderBy('date', 'desc')
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Lỗi lấy giao dịch vật tư:', error);
      throw error;
    }
  },

  /**
   * Lấy thông tin chi tiết vật tư
   * @param {string} itemId - ID vật tư
   * @returns {Promise<Object>} - Thông tin vật tư
   */
  async getItemById(itemId) {
    try {
      const doc = await firebase
        .firestore()
        .collection('inventory')
        .doc(itemId)
        .get();

      if (!doc.exists) {
        throw new Error('Không tìm thấy vật tư');
      }

      return {
        id: doc.id,
        ...doc.data(),
      };
    } catch (error) {
      console.error('Lỗi lấy thông tin vật tư:', error);
      throw error;
    }
  },

  /**
   * Lấy thông tin chi tiết vật tư (alias cho getItemById)
   * @param {string} itemId - ID vật tư
   * @returns {Promise<Object>} - Thông tin vật tư
   */
  async getInventoryItemById(itemId) {
    return this.getItemById(itemId);
  },

  /**
   * Lấy danh sách tất cả vị trí kho
   * @returns {Promise<Array>} - Danh sách vị trí kho
   */
  async getAllLocations() {
    try {
      const snapshot = await firebase
        .firestore()
        .collection('inventory_locations')
        .where('isActive', '==', true)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Lỗi lấy danh sách vị trí kho:', error);
      throw error;
    }
  },

  /**
   * Nhập vật tư từ file Excel mới nhất trong Google Drive folder
   * @param {string} accessToken - Google access token
   * @param {string} folderId - ID của folder chứa file Excel
   * @returns {Promise<Object>} - Kết quả nhập vật tư
   */
  async importInventoryFromDrive(accessToken, folderId) {
    try {
      // Lấy file Excel mới nhất từ folder
      const excelData = await googleDriveService.getLatestExcelFromFolder(
        accessToken,
        folderId
      );

      console.log('Đang xử lý file Excel:', excelData.fileInfo.name);

      // Xử lý dữ liệu từ sheet đầu tiên
      const sheetData = excelData.data.firstSheet;

      // Tìm hàng tiêu đề (thường là hàng đầu tiên)
      const headerRow = sheetData[0];

      if (!headerRow) {
        throw new Error('File Excel không có dữ liệu');
      }

      // Ánh xạ tên cột với các trường dữ liệu
      const columnMap = {
        code: findColumnIndex(headerRow, ['Mã vật tư', 'Mã', 'Code']),
        name: findColumnIndex(headerRow, ['Tên vật tư', 'Tên', 'Name']),
        description: findColumnIndex(headerRow, ['Mô tả', 'Description']),
        category: findColumnIndex(headerRow, ['Danh mục', 'Category']),
        unit: findColumnIndex(headerRow, ['Đơn vị tính', 'Unit']),
        stockQuantity: findColumnIndex(headerRow, ['Số lượng', 'Quantity']),
        minQuantity: findColumnIndex(headerRow, [
          'Số lượng tối thiểu',
          'Min Quantity',
        ]),
        price: findColumnIndex(headerRow, ['Đơn giá', 'Price']),
        material: findColumnIndex(headerRow, ['Vật liệu', 'Material']),
        weight: findColumnIndex(headerRow, ['Khối lượng', 'Weight']),
      };

      // Nếu không tìm thấy các cột bắt buộc
      if (columnMap.code === -1 || columnMap.name === -1) {
        throw new Error(
          'File Excel không đúng định dạng. Cần có cột Mã vật tư và Tên vật tư'
        );
      }

      // Kết quả
      const result = {
        total: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      };

      // Lấy danh sách danh mục để ánh xạ tên với ID
      const categoriesSnapshot = await firebase
        .firestore()
        .collection('inventory_categories')
        .get();
      const categoriesMap = {};
      categoriesSnapshot.docs.forEach((doc) => {
        const category = doc.data();
        categoriesMap[category.name.toLowerCase()] = doc.id;
      });

      // Xử lý từng hàng dữ liệu (bỏ qua hàng đầu tiên là tiêu đề)
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];

        // Bỏ qua hàng trống
        if (!row || row.length === 0) continue;

        // Nếu không có mã hoặc tên, bỏ qua
        if (!row[columnMap.code] || !row[columnMap.name]) {
          result.skipped++;
          continue;
        }

        try {
          // Chuẩn bị dữ liệu vật tư
          const itemData = {
            code: row[columnMap.code]?.toString() || '',
            name: row[columnMap.name]?.toString() || '',
          };

          // Thêm các trường tùy chọn nếu có
          if (columnMap.description !== -1 && row[columnMap.description]) {
            itemData.description = row[columnMap.description].toString();
          }

          // Xử lý danh mục
          if (columnMap.category !== -1 && row[columnMap.category]) {
            const categoryName = row[columnMap.category]
              .toString()
              .toLowerCase();
            if (categoriesMap[categoryName]) {
              itemData.categoryId = categoriesMap[categoryName];
            }
          }

          if (columnMap.unit !== -1 && row[columnMap.unit]) {
            itemData.unit = row[columnMap.unit].toString();
          }

          if (columnMap.stockQuantity !== -1 && row[columnMap.stockQuantity]) {
            const quantity = parseFloat(row[columnMap.stockQuantity]);
            if (!isNaN(quantity)) {
              itemData.stockQuantity = quantity;
            }
          }

          if (columnMap.minQuantity !== -1 && row[columnMap.minQuantity]) {
            const minQty = parseFloat(row[columnMap.minQuantity]);
            if (!isNaN(minQty)) {
              itemData.minQuantity = minQty;
            }
          }

          if (columnMap.price !== -1 && row[columnMap.price]) {
            const price = parseFloat(row[columnMap.price]);
            if (!isNaN(price)) {
              itemData.price = price;
            }
          }

          if (columnMap.material !== -1 && row[columnMap.material]) {
            itemData.material = row[columnMap.material].toString();
          }

          if (columnMap.weight !== -1 && row[columnMap.weight]) {
            const weight = parseFloat(row[columnMap.weight]);
            if (!isNaN(weight)) {
              itemData.weight = weight;
            }
          }

          // Tính tổng giá trị nếu có số lượng và đơn giá
          if (itemData.stockQuantity && itemData.price) {
            itemData.totalPrice = itemData.stockQuantity * itemData.price;
          }

          // Kiểm tra xem vật tư đã tồn tại chưa dựa vào mã
          const existingItemsSnapshot = await firebase
            .firestore()
            .collection('inventory')
            .where('code', '==', itemData.code)
            .get();

          if (!existingItemsSnapshot.empty) {
            // Cập nhật vật tư đã tồn tại
            const docId = existingItemsSnapshot.docs[0].id;
            await firebase
              .firestore()
              .collection('inventory')
              .doc(docId)
              .update({
                ...itemData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
            result.updated++;
          } else {
            // Thêm vật tư mới
            await firebase
              .firestore()
              .collection('inventory')
              .add({
                ...itemData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
            result.added++;
          }

          result.total++;
        } catch (err) {
          console.error(`Lỗi khi xử lý hàng ${i}:`, err);
          result.errors.push({
            row: i,
            message: err.message,
          });
          result.skipped++;
        }
      }

      return result;
    } catch (error) {
      console.error('Lỗi khi nhập vật tư từ Google Drive:', error);
      throw error;
    }
  },
};

/**
 * Tìm chỉ mục cột dựa vào danh sách tên có thể có
 * @param {Array} headerRow - Hàng tiêu đề
 * @param {Array} possibleNames - Danh sách tên có thể có
 * @returns {number} - Chỉ mục cột, -1 nếu không tìm thấy
 */
function findColumnIndex(headerRow, possibleNames) {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (cell && typeof cell === 'string') {
      const cellValue = cell.toLowerCase();
      if (
        possibleNames.some((name) => cellValue.includes(name.toLowerCase()))
      ) {
        return i;
      }
    }
  }
  return -1;
}

export default InventoryService;
