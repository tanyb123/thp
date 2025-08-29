import { useState, useEffect, useCallback } from 'react';
import InventoryService from '../api/inventoryService';
import { firebase } from '../config/firebaseConfig';

/**
 * Hook quản lý các chức năng liên quan đến kho
 * @returns {Object} Các chức năng và dữ liệu kho
 */
const useInventory = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);

  /**
   * Lấy danh sách vật tư từ Firestore
   */
  const fetchInventoryItems = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      console.log('=== USEINVENTORY: BẮT ĐẦU FETCH INVENTORY ITEMS ===');

      // Khởi tạo truy vấn
      let query = firebase.firestore().collection('inventory');

      // Áp dụng bộ lọc nếu có
      if (filters.categoryId) {
        query = query.where('categoryId', '==', filters.categoryId);
      }

      if (filters.locationId) {
        query = query.where('locationId', '==', filters.locationId);
      }

      // Thực hiện truy vấn
      console.log('=== USEINVENTORY: THỰC HIỆN QUERY ===');
      const snapshot = await query.get();

      console.log('=== USEINVENTORY: KẾT QUẢ QUERY ===');
      console.log('Số lượng documents:', snapshot.docs.length);

      // Lấy dữ liệu từ kết quả
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log('=== USEINVENTORY: DỮ LIỆU ĐÃ PARSE ===');
      console.log('Số lượng items:', items.length);
      if (items.length > 0) {
        console.log('Item đầu tiên:', JSON.stringify(items[0], null, 2));
      }

      // Sắp xếp theo thời gian (mới nhất trước)
      const sortedItems = items.sort((a, b) => {
        // Ưu tiên lastUpdated, sau đó updatedAt, cuối cùng createdAt
        const aTime = a.lastUpdated || a.updatedAt || a.createdAt;
        const bTime = b.lastUpdated || b.updatedAt || b.createdAt;

        if (aTime && bTime) {
          return bTime.toDate().getTime() - aTime.toDate().getTime();
        }
        return 0;
      });

      console.log('=== USEINVENTORY: DỮ LIỆU ĐÃ SẮP XẾP ===');
      console.log('Số lượng items sau khi sắp xếp:', sortedItems.length);

      // Áp dụng bộ lọc tồn kho nếu có
      const filteredItems = filters.lowStock
        ? sortedItems.filter(
            (item) =>
              item.stockQuantity <= (item.minQuantity || 0) &&
              item.minQuantity > 0
          )
        : sortedItems;

      console.log('=== USEINVENTORY: DỮ LIỆU SAU KHI LỌC ===');
      console.log('Số lượng items sau khi lọc:', filteredItems.length);

      setInventoryItems(filteredItems);
    } catch (err) {
      console.error('=== USEINVENTORY: LỖI FETCH ===');
      console.error('Lỗi khi lấy danh sách vật tư:', err);
      console.error('Error details:', err.message, err.code);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Lấy danh sách danh mục vật tư
   */
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await firebase
        .firestore()
        .collection('inventory_categories')
        .get();
      const fetchedCategories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(fetchedCategories);
    } catch (err) {
      console.error('Lỗi khi lấy danh mục vật tư:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Lấy danh sách các vị trí kho
   */
  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const locations = await InventoryService.getAllLocations();
      setLocations(locations);
    } catch (err) {
      console.error('Lỗi khi lấy vị trí kho:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Thêm vật tư mới vào kho
   * @param {Object} itemData - Thông tin vật tư
   * @returns {Promise<Object>} - Kết quả thao tác
   */
  const addInventoryItem = async (itemData) => {
    setLoading(true);
    setError(null);
    try {
      console.log('=== USEINVENTORY: BẮT ĐẦU THÊM VẬT TƯ ===');
      console.log('itemData nhận được:', JSON.stringify(itemData, null, 2));

      const result = await InventoryService.addInventoryItem(itemData);
      console.log('=== USEINVENTORY: KẾT QUẢ TỪ INVENTORYSERVICE ===');
      console.log('result:', result);

      // Refresh danh sách nếu thành công
      console.log('=== USEINVENTORY: BẮT ĐẦU REFRESH DANH SÁCH ===');
      await fetchInventoryItems();
      console.log('=== USEINVENTORY: HOÀN THÀNH REFRESH DANH SÁCH ===');

      return result;
    } catch (err) {
      console.error('=== USEINVENTORY: LỖI KHI THÊM VẬT TƯ ===');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Error details:', err.details);
      console.error('=== END LỖI USEINVENTORY ===');

      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cập nhật thông tin vật tư
   * @param {string} itemId - ID vật tư
   * @param {Object} itemData - Thông tin cập nhật
   * @returns {Promise<Object>} - Kết quả thao tác
   */
  const updateInventoryItem = async (itemId, itemData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await InventoryService.updateInventoryItem(
        itemId,
        itemData
      );
      // Refresh danh sách nếu thành công
      await fetchInventoryItems();
      return result;
    } catch (err) {
      console.error('Lỗi khi cập nhật vật tư:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Tạo giao dịch nhập/xuất kho
   * @param {Object} transactionData - Thông tin giao dịch
   * @returns {Promise<Object>} - Kết quả thao tác
   */
  const createTransaction = async (transactionData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await InventoryService.createTransaction(transactionData);
      // Refresh danh sách nếu thành công
      await fetchInventoryItems();
      return result;
    } catch (err) {
      console.error('Lỗi khi tạo giao dịch kho:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lấy thống kê sử dụng vật tư theo dự án
   * @param {string} projectId - ID dự án
   * @param {Object} dateRange - Khoảng thời gian
   * @returns {Promise<Object>} - Kết quả thao tác
   */
  const getProjectMaterialUsage = async (projectId, dateRange = {}) => {
    setLoading(true);
    setError(null);
    try {
      return await InventoryService.getProjectMaterialUsage(
        projectId,
        dateRange.startDate,
        dateRange.endDate
      );
    } catch (err) {
      console.error('Lỗi khi lấy thống kê sử dụng vật tư:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Quản lý danh mục vật tư (thêm, sửa, xóa)
   * @param {string} action - Hành động: 'add', 'update', 'delete'
   * @param {Object} categoryData - Thông tin danh mục
   * @param {string} categoryId - ID danh mục (cho update/delete)
   * @returns {Promise<Object>} - Kết quả thao tác
   */
  const manageCategory = async (action, categoryData, categoryId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await InventoryService.manageCategory(
        action,
        categoryData,
        categoryId
      );
      // Refresh danh mục nếu thành công
      await fetchCategories();
      return result;
    } catch (err) {
      console.error('Lỗi khi quản lý danh mục:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lấy chi tiết vật tư
   * @param {string} itemId - ID vật tư
   * @returns {Promise<Object>} - Thông tin chi tiết vật tư
   */
  const getInventoryItemDetail = async (itemId) => {
    setLoading(true);
    setError(null);
    try {
      const itemDetail = await InventoryService.getItemById(itemId);
      const transactions = await InventoryService.getItemTransactions(itemId);

      // Nếu item có categoryId, lấy thông tin danh mục
      let category = null;
      if (itemDetail.categoryId) {
        const categoryDoc = await firebase
          .firestore()
          .collection('inventory_categories')
          .doc(itemDetail.categoryId)
          .get();

        if (categoryDoc.exists) {
          category = {
            id: categoryDoc.id,
            ...categoryDoc.data(),
          };
        }
      }

      return {
        ...itemDetail,
        category,
        transactions,
      };
    } catch (err) {
      console.error('Lỗi khi lấy chi tiết vật tư:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Nhập vật tư từ file Excel mới nhất trong Google Drive
   * @param {string} accessToken - Google access token
   * @param {string} folderId - ID của folder chứa file Excel
   * @returns {Promise<Object>} - Kết quả nhập vật tư
   */
  const importInventoryFromDrive = async (accessToken, folderId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await InventoryService.importInventoryFromDrive(
        accessToken,
        folderId
      );
      // Refresh danh sách nếu thành công
      await fetchInventoryItems();
      return result;
    } catch (err) {
      console.error('Lỗi khi nhập vật tư từ Google Drive:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Tìm vật tư tương tự trong kho
   * @param {Object} criteria - Tiêu chí tìm kiếm (tên, mã, đơn vị...)
   * @returns {Promise<Array>} - Danh sách vật tư tương tự
   */
  const findSimilarItems = useCallback(
    async (criteria) => {
      setLoading(true);
      setError(null);
      try {
        // Nếu chưa có dữ liệu, tải danh sách vật tư
        if (inventoryItems.length === 0) {
          await fetchInventoryItems();
        }

        // Tìm kiếm theo tên
        if (criteria.name) {
          const nameWords = criteria.name
            .toLowerCase()
            .split(' ')
            .filter((word) => word.length > 2);

          const matchedItems = inventoryItems.filter((item) => {
            const itemNameLower = item.name.toLowerCase();

            // Kiểm tra tên vật tư có chứa từ khóa tìm kiếm không
            const nameMatch = nameWords.some((word) =>
              itemNameLower.includes(word)
            );

            // Kiểm tra đơn vị tính nếu có
            const unitMatch =
              !criteria.unit ||
              (item.unit &&
                item.unit.toLowerCase() === criteria.unit.toLowerCase());

            // Kiểm tra chất liệu nếu có
            const materialMatch =
              !criteria.material ||
              (item.material &&
                item.material
                  .toLowerCase()
                  .includes(criteria.material.toLowerCase()));

            // Kiểm tra danh mục nếu có
            const categoryMatch =
              !criteria.categoryId || item.categoryId === criteria.categoryId;

            return nameMatch && unitMatch && materialMatch && categoryMatch;
          });

          return matchedItems;
        }

        // Nếu tìm theo mã vật tư
        if (criteria.code) {
          const codeLower = criteria.code.toLowerCase();

          return inventoryItems.filter(
            (item) => item.code && item.code.toLowerCase().includes(codeLower)
          );
        }

        // Nếu không có tiêu chí cụ thể, trả về danh sách trống
        return [];
      } catch (err) {
        console.error('Lỗi khi tìm vật tư tương tự:', err);
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [inventoryItems, fetchInventoryItems]
  );

  /**
   * Gán vật tư từ kho cho dự án
   * @param {string} inventoryItemId - ID vật tư trong kho
   * @param {string} projectId - ID dự án
   * @param {number} quantity - Số lượng cần gán
   * @param {Object} metadata - Thông tin bổ sung
   * @returns {Promise<Object>} - Kết quả thao tác
   */
  const assignInventoryItemToProject = async (
    inventoryItemId,
    projectId,
    quantity,
    metadata = {}
  ) => {
    setLoading(true);
    setError(null);
    try {
      // Tạo giao dịch xuất kho
      const transaction = {
        itemId: inventoryItemId,
        type: 'out',
        quantity,
        projectId,
        projectName: metadata.projectName || 'Dự án',
        reason: metadata.reason || 'Gán cho dự án',
        date: new Date(),
        createdBy: metadata.userId || 'unknown',
        createdByName: metadata.userName || 'Người dùng',
      };

      const result = await createTransaction(transaction);

      // Cập nhật lại danh sách vật tư
      await fetchInventoryItems();

      return result;
    } catch (err) {
      console.error('Lỗi khi gán vật tư cho dự án:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sử dụng useEffect để khởi tạo dữ liệu khi cần
  useEffect(() => {
    fetchCategories();
    fetchLocations();
    // Không tự động lấy danh sách vật tư ở đây để tránh truy vấn không cần thiết
  }, [fetchCategories, fetchLocations]);

  return {
    loading,
    error,
    inventoryItems,
    categories,
    locations,
    fetchInventoryItems,
    fetchCategories,
    fetchLocations,
    addInventoryItem,
    updateInventoryItem,
    createTransaction,
    getProjectMaterialUsage,
    manageCategory,
    getInventoryItemDetail,
    importInventoryFromDrive,
    findSimilarItems,
    assignInventoryItemToProject,
  };
};

export default useInventory;
