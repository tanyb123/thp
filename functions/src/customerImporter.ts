import * as functions from 'firebase-functions/v1';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';

// Khởi tạo Firestore
const admin = require('firebase-admin');
const db = admin.firestore();

interface CustomerData {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
}

export const importCustomersFromExcel = functions
  .region('asia-southeast1')
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      // Kiểm tra quyền truy cập
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Yêu cầu đăng nhập'
        );
      }

      const { driveFileId, accessToken } = data;
      if (!driveFileId || !accessToken) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu file ID hoặc access token.'
        );
      }

      console.log('🔍 Bắt đầu import khách hàng từ file:', driveFileId);

      // 1. Setup Google API client với OAuth2
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // 2. Tải và parse file
      const response = await drive.files.get(
        { fileId: driveFileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      if (!response.data) {
        throw new functions.https.HttpsError(
          'not-found',
          'Không tìm thấy file'
        );
      }

      // 3. Đọc file Excel
      const workbook = XLSX.read(Buffer.from(response.data as any), {
        type: 'buffer',
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 4. Chuyển đổi thành JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      console.log('📊 Dữ liệu Excel:', jsonData.length, 'dòng');

      // 5. Xử lý dữ liệu (bỏ qua header)
      const customers: CustomerData[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row && row.length >= 4) {
          const customer: CustomerData = {
            companyName: String(row[0] || '').trim(),
            taxCode: String(row[1] || '').trim(),
            address: String(row[2] || '').trim(),
            email: String(row[3] || '').trim(),
          };

          // Chỉ thêm nếu có tên công ty
          if (customer.companyName) {
            customers.push(customer);
          }
        }
      }

      console.log('✅ Đã parse được', customers.length, 'khách hàng');

      // 6. Lưu vào Firestore
      const batch = db.batch();
      let successCount = 0;
      let errorCount = 0;

      for (const customer of customers) {
        try {
          const customerRef = db.collection('customers').doc();
          batch.set(customerRef, {
            // Lưu đồng nhất cả name và companyName để UI hiện đúng
            name: customer.companyName,
            companyName: customer.companyName,
            taxCode: customer.taxCode,
            address: customer.address,
            email: customer.email,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: context.auth.uid,
          });
          successCount++;
        } catch (error) {
          console.error(
            '❌ Lỗi khi lưu khách hàng:',
            customer.companyName,
            error
          );
          errorCount++;
        }
      }

      // Commit batch
      await batch.commit();

      console.log('💾 Đã lưu thành công:', successCount, 'khách hàng');
      if (errorCount > 0) {
        console.log('⚠️ Lỗi:', errorCount, 'khách hàng');
      }

      return {
        success: true,
        totalProcessed: customers.length,
        successCount,
        errorCount,
        customers: customers.slice(0, 10), // Trả về 10 khách hàng đầu để preview
      };
    } catch (error: any) {
      console.error('❌ Lỗi import khách hàng:', error);

      // Lỗi từ Google API, có thể do accessToken hết hạn
      if (error.code === 401 || error.code === 403) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Token truy cập Google Drive không hợp lệ hoặc đã hết hạn.'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        'Lỗi khi import khách hàng'
      );
    }
  });

// Lấy danh sách file customer từ Google Drive
export const getCustomerFiles = functions
  .region('asia-southeast1')
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Yêu cầu đăng nhập'
        );
      }

      const { accessToken } = data;
      if (!accessToken) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu access token.'
        );
      }

      // 1. Setup Google API client với OAuth2
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // 2. Tìm file có tên chứa "customer"
      const response = await drive.files.list({
        q: "name contains 'customer' and mimeType contains 'spreadsheet' and trashed=false",
        fields: 'files(id,name,modifiedTime,size)',
        orderBy: 'modifiedTime desc',
      });

      const files = response.data.files || [];
      console.log('📁 Tìm thấy', files.length, 'file customer');

      return {
        success: true,
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          modifiedTime: file.modifiedTime,
          size: file.size,
        })),
      };
    } catch (error: any) {
      console.error('❌ Lỗi lấy danh sách file customer:', error);

      // Lỗi từ Google API, có thể do accessToken hết hạn
      if (error.code === 401 || error.code === 403) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Token truy cập Google Drive không hợp lệ hoặc đã hết hạn.'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        'Lỗi khi lấy danh sách file'
      );
    }
  });
