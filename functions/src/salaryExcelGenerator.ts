import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Firebase Admin đã được khởi tạo trong index.ts

// Định nghĩa interface cho SalarySlip
interface SalarySlip {
  id: string;
  employeeName: string;
  month: number;
  year: number;
  dailySalary: number;
  monthlySalary?: number;
  workingDays: number;
  overtimeDays: number;
  calculatedSalary: {
    salaryByDays: number;
    overtimeSalary: number;
    totalAllowances: number;
    totalBonuses: number;
    totalDeductions: number;
    grossSalary: number;
    netSalary: number;
  };
  allowances: Array<{ name: string; amount: number }>;
  bonuses: Array<{ name: string; amount: number }>;
  deductions: Array<{ name: string; amount: number }>;
  advancePayments: Array<{ reason: string; amount: number }>;
  notes?: string;
}

// Google Drive API setup
const { google } = require('googleapis');

/**
 * Helper function để xuất một phiếu lương Excel
 * @param salarySlipId - ID phiếu lương
 * @param accessToken - Google access token
 * @returns Promise với kết quả xuất
 */
async function exportSingleSalarySlipToDrive(
  salarySlipId: string,
  accessToken: string
) {
  let tempExcelPath: string | null = null;
  try {
    // 1. Lấy thông tin phiếu lương từ Firestore
    const salarySlipDoc = await admin
      .firestore()
      .collection('salarySlips')
      .doc(salarySlipId)
      .get();

    if (!salarySlipDoc.exists) {
      throw new Error('Phiếu lương không tồn tại');
    }

    const salarySlip = {
      id: salarySlipDoc.id,
      ...salarySlipDoc.data(),
    } as SalarySlip;

    // 2. Tạo file Excel
    const workbook = XLSX.utils.book_new();

    // Sheet thông tin nhân viên
    const employeeInfo = [
      ['PHIẾU LƯƠNG THÁNG'],
      [''],
      ['Thông tin nhân viên:'],
      ['Tên nhân viên:', salarySlip.employeeName],
      ['Tháng:', `${salarySlip.month}/${salarySlip.year}`],
      ['Ngày tạo:', new Date().toLocaleDateString('vi-VN')],
      [''],
    ];

    const employeeSheet = XLSX.utils.aoa_to_sheet(employeeInfo);
    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Thông tin');

    // Sheet chi tiết lương
    const salaryDetails = [
      ['CHI TIẾT LƯƠNG'],
      [''],
      ['Lương theo ngày:', salarySlip.dailySalary || 0, 'VNĐ'],
      ['Lương cố định tháng:', salarySlip.monthlySalary || 0, 'VNĐ'],
      ['Số ngày công:', salarySlip.workingDays, 'ngày'],
      ['Số ngày tăng ca:', salarySlip.overtimeDays, 'ngày'],
      ['Lương theo ngày:', salarySlip.calculatedSalary.salaryByDays, 'VNĐ'],
      ['Lương tăng ca:', salarySlip.calculatedSalary.overtimeSalary, 'VNĐ'],
      [''],
    ];

    const salarySheet = XLSX.utils.aoa_to_sheet(salaryDetails);
    XLSX.utils.book_append_sheet(workbook, salarySheet, 'Chi tiết lương');

    // Sheet phụ cấp
    const allowances = [
      ['PHỤ CẤP VÀ THƯỞNG'],
      [''],
      ...salarySlip.allowances.map((a) => [a.name, a.amount, 'VNĐ']),
      ...salarySlip.bonuses.map((b) => [b.name, b.amount, 'VNĐ']),
      [''],
      ['Tổng cộng:', salarySlip.calculatedSalary.totalAllowances, 'VNĐ'],
    ];

    const allowancesSheet = XLSX.utils.aoa_to_sheet(allowances);
    XLSX.utils.book_append_sheet(workbook, allowancesSheet, 'Phụ cấp');

    // Sheet khấu trừ
    const deductions = [
      ['KHẤU TRỪ'],
      [''],
      ...salarySlip.deductions.map((d) => [d.name, d.amount, 'VNĐ']),
      ...salarySlip.advancePayments.map((ap) => [ap.reason, ap.amount, 'VNĐ']),
      [''],
      ['Tổng cộng:', salarySlip.calculatedSalary.totalDeductions, 'VNĐ'],
    ];

    const deductionsSheet = XLSX.utils.aoa_to_sheet(deductions);
    XLSX.utils.book_append_sheet(workbook, deductionsSheet, 'Khấu trừ');

    // Sheet tổng kết
    const summary = [
      ['TỔNG KẾT LƯƠNG'],
      [''],
      ['Tổng lương gộp:', salarySlip.calculatedSalary.grossSalary, 'VNĐ'],
      ['Tổng khấu trừ:', salarySlip.calculatedSalary.totalDeductions, 'VNĐ'],
      [''],
      ['LƯƠNG THỰC NHẬN:', salarySlip.calculatedSalary.netSalary, 'VNĐ'],
      [''],
      ['Ghi chú:', salarySlip.notes || 'Không có ghi chú'],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summary);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tổng kết');

    // 3. Chuyển đổi thành buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // 4. Tìm folder "PHIEU LUONG" trong Google Drive
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });

    // Tìm folder PHIEU LUONG trong root
    const rootFolderId = '1Ci_BHZx0-Uhv2xg5IzwLPn05yPAUXOOU'; // Root folder ID
    const folderQuery = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='PHIEU LUONG' and trashed=false`;

    const folderResponse = await drive.files.list({
      q: folderQuery,
      fields: 'files(id,name)',
    });

    let targetFolderId = null;
    if (folderResponse.data.files && folderResponse.data.files.length > 0) {
      targetFolderId = folderResponse.data.files[0].id;
    } else {
      // Tạo folder PHIEU LUONG nếu chưa có
      const folderMetadata = {
        name: 'PHIEU LUONG',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      };

      const newFolder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id',
      });

      targetFolderId = newFolder.data.id;
      console.log('Đã tạo folder PHIEU LUONG:', targetFolderId);
    }

    // 5. Upload file Excel vào folder
    const fileName = `Phiếu lương - ${salarySlip.employeeName} - Tháng ${salarySlip.month}-${salarySlip.year}.xlsx`;

    const fileMetadata = {
      name: fileName,
      parents: [targetFolderId],
    };

    const media = {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Buffer.from(excelBuffer),
    };

    const uploadedFile = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink',
    });

    // 6. Cập nhật trạng thái phiếu lương
    await admin.firestore().collection('salarySlips').doc(salarySlipId).update({
      excelFileId: uploadedFile.data.id,
      excelFileName: fileName,
      excelFileUrl: uploadedFile.data.webViewLink,
      exportedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'exported',
    });

    console.log('Đã xuất phiếu lương thành công:', fileName);

    // Cleanup temp file (giống hệt deliveryNoteExcelGenerator)
    try {
      fs.unlinkSync(tempExcelPath);
      console.log('Đã xóa temp file:', tempExcelPath);
    } catch (cleanupError) {
      console.warn('Không thể xóa temp file:', cleanupError);
    }

    return {
      success: true,
      message: 'Đã xuất phiếu lương thành công',
      fileId: uploadedFile.data.id,
      fileName: uploadedFile.data.name,
      fileUrl: uploadedFile.data.webViewLink,
      folderId: targetFolderId,
    };
  } catch (error) {
    console.error('Lỗi khi xuất phiếu lương:', error);

    // Cleanup temp file trong trường hợp lỗi
    try {
      if (tempExcelPath && fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
        console.log('Đã xóa temp file sau lỗi:', tempExcelPath);
      }
    } catch (cleanupError) {
      console.warn('Không thể xóa temp file sau lỗi:', cleanupError);
    }

    throw error;
  }
}

/**
 * Cloud Function để xuất phiếu lương Excel vào Google Drive
 * Folder đích: PHIEU LUONG (root folder)
 */
export const exportSalarySlipToDrive = functions
  .region('asia-southeast1')
  .https.onCall(async (data: any, context: any) => {
    try {
      // Kiểm tra quyền truy cập
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Yêu cầu đăng nhập'
        );
      }

      const { salarySlipId, accessToken } = data;

      if (!salarySlipId || !accessToken) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu salarySlipId hoặc accessToken'
        );
      }

      // 1. Lấy thông tin phiếu lương từ Firestore
      const salarySlipDoc = await admin
        .firestore()
        .collection('salarySlips')
        .doc(salarySlipId)
        .get();

      if (!salarySlipDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Phiếu lương không tồn tại'
        );
      }

      const salarySlip = {
        id: salarySlipDoc.id,
        ...salarySlipDoc.data(),
      } as SalarySlip;

      // 2. Tạo dữ liệu Excel (đã được sử dụng trong prepareSalaryExcelData)
      // const excelData = prepareSalaryExcelData(salarySlip);

      // 3. Tạo file Excel
      const workbook = XLSX.utils.book_new();

      // Sheet thông tin nhân viên
      const employeeInfo = [
        ['PHIẾU LƯƠNG THÁNG'],
        [''],
        ['Thông tin nhân viên:'],
        ['Tên nhân viên:', salarySlip.employeeName],
        ['Tháng:', `${salarySlip.month}/${salarySlip.year}`],
        ['Ngày tạo:', new Date().toLocaleDateString('vi-VN')],
        [''],
      ];

      const employeeSheet = XLSX.utils.aoa_to_sheet(employeeInfo);
      XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Thông tin');

      // Sheet chi tiết lương
      const salaryDetails = [
        ['CHI TIẾT LƯƠNG'],
        [''],
        ['Lương theo ngày:', salarySlip.dailySalary, 'VNĐ'],
        ['Số ngày làm việc:', salarySlip.workingDays, 'ngày'],
        ['Số ngày tăng ca:', salarySlip.overtimeDays || 0, 'ngày'],
        [''],
        ['Lương theo ngày:', salarySlip.calculatedSalary.salaryByDays, 'VNĐ'],
        ['Lương tăng ca:', salarySlip.calculatedSalary.overtimeSalary, 'VNĐ'],
        [''],
      ];

      const salarySheet = XLSX.utils.aoa_to_sheet(salaryDetails);
      XLSX.utils.book_append_sheet(workbook, salarySheet, 'Chi tiết lương');

      // Sheet phụ cấp và thưởng
      const additions = [
        ['PHỤ CẤP VÀ THƯỞNG'],
        [''],
        ['Phụ cấp:'],
        ...salarySlip.allowances.map((a: any) => [a.name, a.amount, 'VNĐ']),
        [''],
        ['Thưởng:'],
        ...salarySlip.bonuses.map((b: any) => [b.name, b.amount, 'VNĐ']),
        [''],
        [
          'Tổng cộng:',
          salarySlip.calculatedSalary.totalAllowances +
            salarySlip.calculatedSalary.totalBonuses,
          'VNĐ',
        ],
      ];

      const additionsSheet = XLSX.utils.aoa_to_sheet(additions);
      XLSX.utils.book_append_sheet(
        workbook,
        additionsSheet,
        'Phụ cấp & Thưởng'
      );

      // Sheet khấu trừ
      const deductions = [
        ['KHẤU TRỪ'],
        [''],
        ['Khấu trừ:'],
        ...salarySlip.deductions.map((d: any) => [d.name, d.amount, 'VNĐ']),
        [''],
        ['Ứng lương:'],
        ...salarySlip.advancePayments.map((ap: any) => [
          ap.reason || 'Ứng lương',
          ap.amount,
          'VNĐ',
        ]),
        [''],
        ['Tổng cộng:', salarySlip.calculatedSalary.totalDeductions, 'VNĐ'],
      ];

      const deductionsSheet = XLSX.utils.aoa_to_sheet(deductions);
      XLSX.utils.book_append_sheet(workbook, deductionsSheet, 'Khấu trừ');

      // Sheet tổng kết
      const summary = [
        ['TỔNG KẾT LƯƠNG'],
        [''],
        ['Tổng lương gộp:', salarySlip.calculatedSalary.grossSalary, 'VNĐ'],
        ['Tổng khấu trừ:', salarySlip.calculatedSalary.totalDeductions, 'VNĐ'],
        [''],
        ['LƯƠNG THỰC NHẬN:', salarySlip.calculatedSalary.netSalary, 'VNĐ'],
        [''],
        ['Ghi chú:', salarySlip.notes || 'Không có ghi chú'],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summary);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tổng kết');

      // 4. Chuyển đổi thành buffer và lưu temp file
      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      // Lưu vào temp file (giống hệt deliveryNoteExcelGenerator)
      const tempExcelPath = path.join(
        os.tmpdir(),
        `salary_${salarySlipId}.xlsx`
      );
      fs.writeFileSync(tempExcelPath, excelBuffer);

      // 5. Tìm folder "PHIEU LUONG" trong Google Drive
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // Tìm folder PHIEU LUONG trong root
      const rootFolderId = '1Ci_BHZx0-Uhv2xg5IzwLPn05yPAUXOOU'; // Root folder ID
      const folderQuery = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='PHIEU LUONG' and trashed=false`;

      const folderResponse = await drive.files.list({
        q: folderQuery,
        fields: 'files(id,name)',
      });

      let targetFolderId = null;
      if (folderResponse.data.files && folderResponse.data.files.length > 0) {
        targetFolderId = folderResponse.data.files[0].id;
      } else {
        // Tạo folder PHIEU LUONG nếu chưa có
        const folderMetadata = {
          name: 'PHIEU LUONG',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        };

        const newFolder = await drive.files.create({
          resource: folderMetadata,
          fields: 'id',
        });

        targetFolderId = newFolder.data.id;
        console.log('Đã tạo folder PHIEU LUONG:', targetFolderId);
      }

      // 6. Upload file Excel vào folder (giống hệt deliveryNoteExcelGenerator)
      const fileName = `Phiếu lương - ${salarySlip.employeeName} - Tháng ${salarySlip.month}-${salarySlip.year}.xlsx`;

      const fileMetadata = {
        name: fileName,
        parents: [targetFolderId],
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      // Tạo readable stream từ temp file (giống hệt deliveryNoteExcelGenerator)
      const fileStream = fs.createReadStream(tempExcelPath);

      const uploadedFile = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: fileStream,
        },
        fields: 'id,name,webViewLink',
      });

      // 7. Cập nhật trạng thái phiếu lương
      await admin
        .firestore()
        .collection('salarySlips')
        .doc(salarySlipId)
        .update({
          excelFileId: uploadedFile.data.id,
          excelFileName: fileName,
          excelFileUrl: uploadedFile.data.webViewLink,
          exportedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'exported',
        });

      console.log('Đã xuất phiếu lương thành công:', fileName);

      return {
        success: true,
        message: 'Đã xuất phiếu lương thành công',
        fileId: uploadedFile.data.id,
        fileName: uploadedFile.data.name,
        fileUrl: uploadedFile.data.webViewLink,
        folderId: targetFolderId,
      };
    } catch (error) {
      console.error('Lỗi khi xuất phiếu lương:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Lỗi khi xuất phiếu lương: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  });

/**
 * Cloud Function để xuất nhiều phiếu lương cùng lúc
 */
export const exportMultipleSalarySlips = functions
  .region('asia-southeast1')
  .https.onCall(async (data: any, context: any) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Yêu cầu đăng nhập'
        );
      }

      const { salarySlipIds, accessToken } = data;

      if (
        !salarySlipIds ||
        !Array.isArray(salarySlipIds) ||
        salarySlipIds.length === 0
      ) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Danh sách phiếu lương không hợp lệ'
        );
      }

      const results = [];
      const errors = [];

      // Xuất từng phiếu lương
      for (const salarySlipId of salarySlipIds) {
        try {
          // Gọi trực tiếp logic xuất Excel thay vì gọi Cloud Function
          const result = await exportSingleSalarySlipToDrive(
            salarySlipId,
            accessToken
          );
          results.push(result);
        } catch (error) {
          errors.push({
            salarySlipId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: `Đã xuất ${results.length} phiếu lương thành công`,
        results,
        errors,
        totalProcessed: salarySlipIds.length,
        totalSuccess: results.length,
        totalErrors: errors.length,
      };
    } catch (error) {
      console.error('Lỗi khi xuất nhiều phiếu lương:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Lỗi khi xuất nhiều phiếu lương: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  });
