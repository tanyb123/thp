import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { CallableContext } from 'firebase-functions/v1/https';

// Interface định nghĩa cấu trúc vật tư trong kho
export interface InventoryItem {
  id?: string;
  name: string;
  code: string;
  description?: string;
  categoryId: string;
  unit: string;
  stockQuantity: number;
  minQuantity?: number;
  price?: number;
  lastUpdated: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp; // Thêm field này để tương thích
  createdAt?: admin.firestore.Timestamp; // Thêm field này để tương thích
  locationId?: string;
  weight?: number; // Khối lượng (kg)
  material?: string; // Vật liệu
  imageUrl?: string; // URL hình ảnh
  imageBase64?: string; // Base64 data của hình ảnh
  supplier?: string; // Nhà cung cấp chính
  properties?: { [key: string]: any }; // Thuộc tính tuỳ chỉnh
}

// Interface định nghĩa giao dịch nhập/xuất kho
export interface InventoryTransaction {
  id?: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER'; // Loại giao dịch
  itemId: string;
  quantity: number;
  date: admin.firestore.Timestamp;
  note?: string;
  documentNumber?: string; // Số phiếu/chứng từ
  projectId?: string; // ID dự án (nếu xuất cho dự án)
  supplierId?: string; // ID nhà cung cấp (nếu nhập từ NCC)
  price?: number; // Giá tại thời điểm giao dịch
  userId: string; // Người tạo giao dịch
  locationId?: string; // Vị trí kho
  destinationLocationId?: string; // Vị trí đích (nếu chuyển kho)
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  approvedBy?: string; // Người phê duyệt
  attachmentUrls?: string[]; // Tài liệu đính kèm
}

// Interface định nghĩa danh mục vật tư
export interface InventoryCategory {
  id?: string;
  name: string;
  description?: string;
  parentId?: string; // Danh mục cha (nếu có)
}

// Interface định nghĩa vị trí kho
export interface InventoryLocation {
  id?: string;
  name: string;
  address?: string;
  description?: string;
  isActive: boolean;
}

/**
 * Thêm vật tư mới vào kho
 */
export const addInventoryItem = functions
  .region('asia-southeast1')
  .https.onCall(async (data: InventoryItem, context: CallableContext) => {
    console.log('=== CLOUD FUNCTION: BẮT ĐẦU THÊM VẬT TƯ ===');
    console.log('data nhận được:', JSON.stringify(data, null, 2));
    console.log('context.auth:', context.auth);

    // Kiểm tra xác thực
    if (!context.auth) {
      console.error('=== CLOUD FUNCTION: LỖI XÁC THỰC ===');
      console.error('User chưa đăng nhập');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập để thực hiện chức năng này.'
      );
    }

    try {
      console.log('=== CLOUD FUNCTION: KIỂM TRA DỮ LIỆU ===');
      // Kiểm tra dữ liệu đầu vào
      if (!data.name || !data.code || !data.categoryId || !data.unit) {
        console.error('=== CLOUD FUNCTION: LỖI DỮ LIỆU ===');
        console.error('Thiếu thông tin bắt buộc:');
        console.error('name:', data.name);
        console.error('code:', data.code);
        console.error('categoryId:', data.categoryId);
        console.error('unit:', data.unit);

        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu thông tin vật tư bắt buộc.'
        );
      }

      console.log('=== CLOUD FUNCTION: KIỂM TRA MÃ VẬT TƯ TRÙNG ===');
      // Kiểm tra mã vật tư đã tồn tại chưa
      const codeSnapshot = await admin
        .firestore()
        .collection('inventory')
        .where('code', '==', data.code)
        .get();

      if (!codeSnapshot.empty) {
        console.error('=== CLOUD FUNCTION: MÃ VẬT TƯ ĐÃ TỒN TẠI ===');
        console.error('Mã vật tư:', data.code, 'đã tồn tại');
        throw new functions.https.HttpsError(
          'already-exists',
          'Mã vật tư đã tồn tại trong hệ thống.'
        );
      }

      console.log('=== CLOUD FUNCTION: CHUẨN BỊ DỮ LIỆU ===');
      // Chuẩn bị dữ liệu để lưu
      const newItem: InventoryItem = {
        ...data,
        stockQuantity: data.stockQuantity || 0,
        lastUpdated: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(), // Thêm field này để tương thích
      };
      console.log('newItem chuẩn bị lưu:', JSON.stringify(newItem, null, 2));

      console.log('=== CLOUD FUNCTION: LƯU VÀO FIRESTORE ===');
      // Lưu vào Firestore
      const docRef = await admin
        .firestore()
        .collection('inventory')
        .add(newItem);

      console.log('=== CLOUD FUNCTION: ĐÃ LƯU THÀNH CÔNG ===');
      console.log('Document ID:', docRef.id);

      // Nếu có số lượng ban đầu > 0, tạo giao dịch nhập kho
      if (data.stockQuantity > 0) {
        console.log('=== CLOUD FUNCTION: TẠO GIAO DỊCH NHẬP KHO ===');
        await admin.firestore().collection('inventory_transactions').add({
          type: 'IN',
          itemId: docRef.id,
          quantity: data.stockQuantity,
          date: admin.firestore.Timestamp.now(),
          note: 'Nhập kho ban đầu',
          userId: context.auth.uid,
          status: 'COMPLETED',
        });
        console.log('=== CLOUD FUNCTION: ĐÃ TẠO GIAO DỊCH NHẬP KHO ===');
      }

      const result = {
        success: true,
        id: docRef.id,
        message: 'Thêm vật tư thành công',
      };

      console.log('=== CLOUD FUNCTION: TRẢ VỀ KẾT QUẢ ===');
      console.log('result:', JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      console.error('=== CLOUD FUNCTION: LỖI CHUNG ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('=== END LỖI CLOUD FUNCTION ===');

      throw new functions.https.HttpsError(
        'internal',
        `Lỗi thêm vật tư: ${error.message}`
      );
    }
  });

/**
 * Cập nhật thông tin vật tư
 */
export const updateInventoryItem = functions
  .region('asia-southeast1')
  .https.onCall(
    async (
      data: { itemId: string; itemData: Partial<InventoryItem> },
      context: CallableContext
    ) => {
      // Kiểm tra xác thực
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để thực hiện chức năng này.'
        );
      }

      try {
        const { itemId, itemData } = data;

        // Kiểm tra dữ liệu đầu vào
        if (!itemId) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Thiếu ID vật tư cần cập nhật.'
          );
        }

        // Không cho phép cập nhật số lượng trực tiếp
        if ('stockQuantity' in itemData) {
          delete itemData.stockQuantity;
        }

        // Cập nhật thời gian
        const updateData = {
          ...itemData,
          lastUpdated: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(), // Thêm field này để tương thích
        };

        // Cập nhật vào Firestore
        await admin
          .firestore()
          .collection('inventory')
          .doc(itemId)
          .update(updateData);

        return {
          success: true,
          message: 'Cập nhật vật tư thành công',
        };
      } catch (error: any) {
        console.error('Lỗi cập nhật vật tư:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi cập nhật vật tư: ${error.message}`
        );
      }
    }
  );

/**
 * Tạo giao dịch nhập/xuất kho
 */
export const createInventoryTransaction = functions
  .region('asia-southeast1')
  .https.onCall(
    async (data: InventoryTransaction, context: CallableContext) => {
      // Kiểm tra xác thực
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để thực hiện chức năng này.'
        );
      }

      // Bắt đầu transaction để đảm bảo tính nhất quán dữ liệu
      const db = admin.firestore();

      try {
        return await db.runTransaction(async (transaction) => {
          // Kiểm tra dữ liệu đầu vào
          if (
            !data.itemId ||
            !data.quantity ||
            !data.type ||
            data.quantity <= 0
          ) {
            throw new functions.https.HttpsError(
              'invalid-argument',
              'Dữ liệu giao dịch không hợp lệ.'
            );
          }

          // Lấy thông tin vật tư hiện tại
          const itemRef = db.collection('inventory').doc(data.itemId);
          const itemDoc = await transaction.get(itemRef);

          if (!itemDoc.exists) {
            throw new functions.https.HttpsError(
              'not-found',
              'Không tìm thấy vật tư trong kho.'
            );
          }

          const currentItem = itemDoc.data() as InventoryItem;
          let newQuantity = currentItem.stockQuantity;

          // Tính toán số lượng mới dựa trên loại giao dịch
          if (data.type === 'IN') {
            newQuantity += data.quantity;
          } else if (data.type === 'OUT') {
            if (currentItem.stockQuantity < data.quantity) {
              throw new functions.https.HttpsError(
                'failed-precondition',
                'Số lượng trong kho không đủ để xuất.'
              );
            }
            newQuantity -= data.quantity;
          } else if (data.type === 'ADJUST') {
            newQuantity = data.quantity; // Điều chỉnh trực tiếp
          } else if (data.type === 'TRANSFER') {
            // Đối với chuyển kho, số lượng không đổi tổng nhưng cần kiểm tra
            if (!data.destinationLocationId) {
              throw new functions.https.HttpsError(
                'invalid-argument',
                'Thiếu thông tin vị trí kho đích.'
              );
            }

            if (currentItem.stockQuantity < data.quantity) {
              throw new functions.https.HttpsError(
                'failed-precondition',
                'Số lượng trong kho không đủ để chuyển.'
              );
            }
            // Số lượng xử lý trong các bước tiếp theo
          }

          // Chuẩn bị dữ liệu giao dịch để lưu
          const transactionData: InventoryTransaction = {
            ...data,
            userId: context.auth.uid,
            date: data.date || admin.firestore.Timestamp.now(),
            status: data.status || 'COMPLETED',
          };

          // Lưu giao dịch vào Firestore
          const transactionRef = db.collection('inventory_transactions').doc();
          transaction.set(transactionRef, transactionData);

          // Cập nhật số lượng trong kho (trừ trường hợp chuyển kho)
          if (data.type !== 'TRANSFER') {
            transaction.update(itemRef, {
              stockQuantity: newQuantity,
              lastUpdated: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now(), // Thêm field này để tương thích
            });
          } else {
            // Xử lý chuyển kho - logic phức tạp hơn có thể thêm sau
            console.log('Xử lý chuyển kho - cần bổ sung logic');
          }

          return {
            success: true,
            transactionId: transactionRef.id,
            message: 'Giao dịch kho thành công',
            newQuantity,
          };
        });
      } catch (error: any) {
        console.error('Lỗi tạo giao dịch kho:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi tạo giao dịch kho: ${error.message}`
        );
      }
    }
  );

/**
 * Lấy báo cáo tồn kho
 */
export const getInventoryReport = functions
  .region('asia-southeast1')
  .https.onCall(
    async (
      data: {
        categoryId?: string;
        locationId?: string;
        lowStock?: boolean;
      },
      context: CallableContext
    ) => {
      // Kiểm tra xác thực
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để thực hiện chức năng này.'
        );
      }

      try {
        // Tạo truy vấn cơ bản
        let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
          admin.firestore().collection('inventory');

        // Áp dụng các bộ lọc
        if (data.categoryId) {
          query = query.where('categoryId', '==', data.categoryId);
        }

        if (data.locationId) {
          query = query.where('locationId', '==', data.locationId);
        }

        const snapshot = await query.get();
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Lọc hàng tồn thấp nếu yêu cầu
        let result = items;
        if (data.lowStock) {
          result = items.filter((item) => {
            const typedItem = item as unknown as InventoryItem;
            return typedItem.stockQuantity <= (typedItem.minQuantity || 0);
          });
        }

        return {
          success: true,
          items: result,
        };
      } catch (error: any) {
        console.error('Lỗi lấy báo cáo tồn kho:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi lấy báo cáo tồn kho: ${error.message}`
        );
      }
    }
  );

/**
 * Quản lý danh mục vật tư
 */
export const manageInventoryCategory = functions
  .region('asia-southeast1')
  .https.onCall(
    async (
      data: {
        action: 'add' | 'update' | 'delete';
        categoryData?: InventoryCategory;
        categoryId?: string;
      },
      context: CallableContext
    ) => {
      // Kiểm tra xác thực
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để thực hiện chức năng này.'
        );
      }

      try {
        const { action, categoryData, categoryId } = data;
        const db = admin.firestore();

        if (action === 'add' && categoryData) {
          // Thêm danh mục mới
          const docRef = await db
            .collection('inventory_categories')
            .add(categoryData);
          return {
            success: true,
            id: docRef.id,
            message: 'Thêm danh mục thành công',
          };
        } else if (action === 'update' && categoryData && categoryId) {
          // Cập nhật danh mục
          // Chuyển đổi categoryData thành object với các cặp key-value thông thường
          const updateData: { [key: string]: any } = {};

          if (categoryData.name !== undefined)
            updateData.name = categoryData.name;
          if (categoryData.description !== undefined)
            updateData.description = categoryData.description;
          if (categoryData.parentId !== undefined)
            updateData.parentId = categoryData.parentId;

          await db
            .collection('inventory_categories')
            .doc(categoryId)
            .update(updateData);
          return {
            success: true,
            message: 'Cập nhật danh mục thành công',
          };
        } else if (action === 'delete' && categoryId) {
          // Kiểm tra xem danh mục có đang được sử dụng không
          const itemsUsingCategory = await db
            .collection('inventory')
            .where('categoryId', '==', categoryId)
            .limit(1)
            .get();

          // Kiểm tra xem có danh mục con nào không
          const childCategories = await db
            .collection('inventory_categories')
            .where('parentId', '==', categoryId)
            .limit(1)
            .get();

          if (!itemsUsingCategory.empty) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              'Không thể xóa danh mục đang có vật tư sử dụng.'
            );
          }

          if (!childCategories.empty) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              'Không thể xóa danh mục có chứa danh mục con.'
            );
          }

          // Xóa danh mục
          await db.collection('inventory_categories').doc(categoryId).delete();
          return {
            success: true,
            message: 'Xóa danh mục thành công',
          };
        } else {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Dữ liệu đầu vào không hợp lệ.'
          );
        }
      } catch (error: any) {
        console.error('Lỗi quản lý danh mục:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi quản lý danh mục: ${error.message}`
        );
      }
    }
  );

/**
 * Thống kê sử dụng vật tư theo dự án
 */
export const getProjectMaterialUsage = functions
  .region('asia-southeast1')
  .https.onCall(
    async (
      data: {
        projectId: string;
        startDate?: string;
        endDate?: string;
      },
      context: CallableContext
    ) => {
      // Kiểm tra xác thực
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để thực hiện chức năng này.'
        );
      }

      try {
        const { projectId, startDate, endDate } = data;
        if (!projectId) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Thiếu ID dự án.'
          );
        }

        // Tạo truy vấn cơ bản - chỉ lấy giao dịch xuất kho cho dự án
        let query = admin
          .firestore()
          .collection('inventory_transactions')
          .where('type', '==', 'OUT')
          .where('projectId', '==', projectId);

        // Áp dụng lọc ngày nếu có
        if (startDate) {
          const startTimestamp = admin.firestore.Timestamp.fromDate(
            new Date(startDate)
          );
          query = query.where('date', '>=', startTimestamp);
        }

        if (endDate) {
          const endTimestamp = admin.firestore.Timestamp.fromDate(
            new Date(endDate)
          );
          query = query.where('date', '<=', endTimestamp);
        }

        // Thực hiện truy vấn
        const snapshot = await query.get();
        const transactions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Nhóm theo vật tư và tính tổng
        const materialUsage: Record<string, any> = {};
        for (const transaction of transactions) {
          const typedTrans = transaction as unknown as InventoryTransaction;
          if (!materialUsage[typedTrans.itemId]) {
            // Lấy thông tin chi tiết về vật tư
            const itemDoc = await admin
              .firestore()
              .collection('inventory')
              .doc(typedTrans.itemId)
              .get();

            if (!itemDoc.exists) continue;

            const itemData = itemDoc.data() as InventoryItem;
            materialUsage[typedTrans.itemId] = {
              itemId: typedTrans.itemId,
              name: itemData.name,
              code: itemData.code,
              unit: itemData.unit,
              material: itemData.material,
              totalQuantity: 0,
              totalCost: 0,
              transactions: [],
            };
          }

          // Cộng số lượng và chi phí
          materialUsage[typedTrans.itemId].totalQuantity +=
            typedTrans.quantity || 0;
          materialUsage[typedTrans.itemId].totalCost +=
            (typedTrans.price || 0) * (typedTrans.quantity || 0);

          // Thêm giao dịch vào danh sách
          materialUsage[typedTrans.itemId].transactions.push({
            id: typedTrans.id,
            date: typedTrans.date,
            quantity: typedTrans.quantity,
            price: typedTrans.price,
            note: typedTrans.note,
          });
        }

        return {
          success: true,
          projectId,
          materials: Object.values(materialUsage),
        };
      } catch (error: any) {
        console.error('Lỗi thống kê sử dụng vật tư:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi thống kê sử dụng vật tư: ${error.message}`
        );
      }
    }
  );
