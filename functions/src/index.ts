//functions/src/index.ts
/* eslint-disable max-len */
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

// Initialize Firebase Admin FIRST
admin.initializeApp({
  storageBucket: 'tanyb-fe4bf.appspot.com',
});

// Export functions from other files
export * from './materialImporter';
export * from './customerImporter';
export * from './projectTriggers';
export * from './taskTriggers';
// Loại bỏ export từ excelGenerator vì đang xung đột với quotationExcelGenerator
// export * from './excelGenerator';
export * from './pdfGenerator';
export * from './contractGenerator';
export * from './financialProcessor';
export * from './scheduledFunctions';
export * from './poExcelGenerator';
export * from './poReceiptConfirmation';
export * from './savePOReceiptConfirmation';
export * from './createProjectFolders';
export * from './deliveryNoteExcelGenerator';
// Export trực tiếp từ quotationExcelGenerator
export * from './quotationExcelGenerator';
export * from './attendanceExcelGenerator';
export * from './salaryExcelGenerator';
export * from './processWorkAllocations';
export * from './aggregateMonthlyReport';
export * from './notificationTriggers';
export * from './publicApi';

// Không export từ excelGenerator nữa vì đã có export từ quotationExcelGenerator

// Import và export các hàm quản lý kho
export * from './inventoryManager';

// Thêm importInventoryFromExcel
export const importInventoryFromExcel = functions
  .region('asia-southeast1')
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Người dùng cần đăng nhập để sử dụng chức năng này.'
      );
    }

    const { driveFileId, accessToken } = data;
    if (!driveFileId || !accessToken) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu file ID hoặc access token.'
      );
    }

    try {
      // 1. Khởi tạo Google API client
      const { google } = require('googleapis');
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // 2. Tải file từ Google Drive
      const response = await drive.files.get(
        { fileId: driveFileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      // 3. Parse file Excel với XLSX
      const XLSX = require('xlsx');
      const workbook = XLSX.read(Buffer.from(response.data), {
        type: 'buffer',
      });

      // Lấy sheet đầu tiên
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
      });

      // 4. Tìm hàng tiêu đề (thường là hàng đầu tiên)
      let headerRow = rawData[0];
      let startRow = 1;

      // Nếu hàng đầu không có dữ liệu đúng, thử tìm hàng tiêu đề hợp lệ
      if (!headerRow || headerRow.length < 2) {
        for (let i = 0; i < 5; i++) {
          if (rawData[i] && rawData[i].length >= 2) {
            headerRow = rawData[i];
            startRow = i + 1;
            break;
          }
        }
      }

      if (!headerRow) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Không tìm thấy hàng tiêu đề trong file Excel.'
        );
      }

      // 5. Ánh xạ các cột dựa trên tiêu đề
      const findColumnIndex = (names: string[]) => {
        for (let i = 0; i < headerRow.length; i++) {
          const cell = headerRow[i];
          if (cell && typeof cell === 'string') {
            const cellValue = cell.toLowerCase();
            if (names.some((name) => cellValue.includes(name.toLowerCase()))) {
              return i;
            }
          }
        }
        return -1;
      };

      const columnMap = {
        code: findColumnIndex(['Mã vật tư', 'Mã', 'Code']),
        name: findColumnIndex(['Tên vật tư', 'Tên', 'Name']),
        description: findColumnIndex(['Mô tả', 'Description']),
        category: findColumnIndex(['Danh mục', 'Category']),
        unit: findColumnIndex(['Đơn vị tính', 'Unit']),
        stockQuantity: findColumnIndex(['Số lượng', 'Quantity']),
        minQuantity: findColumnIndex(['Số lượng tối thiểu', 'Min Quantity']),
        price: findColumnIndex(['Đơn giá', 'Price']),
        material: findColumnIndex(['Vật liệu', 'Material']),
        weight: findColumnIndex(['Khối lượng', 'Weight']),
      };

      // 6. Chuẩn bị kết quả
      const result = {
        total: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: [] as Array<{ row: number; message: string }>,
      };

      // 7. Lấy danh sách danh mục để ánh xạ
      const categoriesSnapshot = await admin
        .firestore()
        .collection('inventory_categories')
        .get();

      const categoriesMap: Record<string, string> = {};
      categoriesSnapshot.docs.forEach((doc) => {
        const category = doc.data();
        if (category.name) {
          categoriesMap[category.name.toLowerCase()] = doc.id;
        }
      });

      // 8. Xử lý từng hàng dữ liệu
      for (let i = startRow; i < rawData.length; i++) {
        const row = rawData[i];

        // Bỏ qua hàng trống
        if (!row || row.length === 0) continue;

        // Kiểm tra code và name
        const code = row[columnMap.code];
        const name = row[columnMap.name];

        if (!code || !name) {
          result.skipped++;
          continue;
        }

        try {
          // Chuẩn bị dữ liệu vật tư
          const itemData: any = {
            code: String(code),
            name: String(name),
          };

          // Thêm các trường tùy chọn nếu có
          if (columnMap.description !== -1 && row[columnMap.description]) {
            itemData.description = String(row[columnMap.description]);
          }

          // Xử lý danh mục
          if (columnMap.category !== -1 && row[columnMap.category]) {
            const categoryName = String(row[columnMap.category]).toLowerCase();
            if (categoriesMap[categoryName]) {
              itemData.categoryId = categoriesMap[categoryName];
            }
          }

          if (columnMap.unit !== -1 && row[columnMap.unit]) {
            itemData.unit = String(row[columnMap.unit]);
          }

          if (
            columnMap.stockQuantity !== -1 &&
            row[columnMap.stockQuantity] !== null
          ) {
            const quantity = parseFloat(String(row[columnMap.stockQuantity]));
            if (!isNaN(quantity)) {
              itemData.stockQuantity = quantity;
            }
          }

          if (
            columnMap.minQuantity !== -1 &&
            row[columnMap.minQuantity] !== null
          ) {
            const minQty = parseFloat(String(row[columnMap.minQuantity]));
            if (!isNaN(minQty)) {
              itemData.minQuantity = minQty;
            }
          }

          if (columnMap.price !== -1 && row[columnMap.price] !== null) {
            const price = parseFloat(String(row[columnMap.price]));
            if (!isNaN(price)) {
              itemData.price = price;
            }
          }

          if (columnMap.material !== -1 && row[columnMap.material]) {
            itemData.material = String(row[columnMap.material]);
          }

          if (columnMap.weight !== -1 && row[columnMap.weight] !== null) {
            const weight = parseFloat(String(row[columnMap.weight]));
            if (!isNaN(weight)) {
              itemData.weight = weight;
            }
          }

          // Tính tổng giá trị nếu có số lượng và đơn giá
          if (itemData.stockQuantity && itemData.price) {
            itemData.totalPrice = itemData.stockQuantity * itemData.price;
          }

          // 9. Kiểm tra vật tư đã tồn tại chưa
          const db = admin.firestore();
          const querySnapshot = await db
            .collection('inventory')
            .where('code', '==', itemData.code)
            .get();

          if (!querySnapshot.empty) {
            // Cập nhật vật tư đã tồn tại
            const docId = querySnapshot.docs[0].id;
            await db
              .collection('inventory')
              .doc(docId)
              .update({
                ...itemData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            result.updated++;
          } else {
            // Thêm vật tư mới
            await db.collection('inventory').add({
              ...itemData,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            result.added++;
          }

          result.total++;
        } catch (err: any) {
          console.error(`Lỗi khi xử lý hàng ${i}:`, err);
          result.errors.push({
            row: i + 1,
            message: err.message || 'Lỗi không xác định',
          });
          result.skipped++;
        }
      }

      return result;
    } catch (error: any) {
      console.error('Error importing inventory from Excel:', error);

      if (error.code === 401 || error.code === 403) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Token truy cập Google Drive không hợp lệ hoặc đã hết hạn.'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        'Lỗi khi xử lý file Excel.',
        error.message
      );
    }
  });

// Loại bỏ export trùng lặp vì đã có export từ './quotationExcelGenerator' ở trên
export { generateDeliveryNoteExcel } from './deliveryNoteExcelGenerator';
export { exportSheetToPdf } from './pdfGenerator';
export { generateExcelQuotation } from './excelGenerator';
