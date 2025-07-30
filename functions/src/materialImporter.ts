import * as functions from 'firebase-functions/v1';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { CallableContext } from 'firebase-functions/v1/https';

// Kiểm tra xem một chuỗi có phải là số La Mã không
function isRomanNumeral(str: string): boolean {
  if (!str) return false;
  const romanPattern = /^[IVXLCDM]+$/i;
  return romanPattern.test(str.toString().trim());
}

// admin đã được khởi tạo ở file index.ts chính

export const importMaterialsFromDrive = functions
  .region('asia-southeast1')
  .https.onCall(async (data: any, context: CallableContext) => {
    // === QUAY LẠI CÁCH XÁC THỰC CHUẨN ===
    if (!context.auth) {
      // Nếu context.auth không tồn tại, có nghĩa là Firebase không thể xác thực người dùng.
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Yêu cầu phải được thực hiện khi đã đăng nhập.'
      );
    }
    // Từ đây, bạn có thể tin tưởng context.auth.uid
    console.log(`Request from authenticated user: ${context.auth.uid}`);

    const { driveFileId, accessToken } = data;
    if (!driveFileId || !accessToken) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu file ID hoặc access token.'
      );
    }

    try {
      // 1. Setup Google API client
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // 2. Tải và parse file
      const response = await drive.files.get(
        { fileId: driveFileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      const workbook = XLSX.read(Buffer.from(response.data as any), {
        type: 'buffer',
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });

      const parsedMaterials: any[] = [];
      for (let i = 4; i < rawData.length; i++) {
        const row: any[] = rawData[i];

        // Bỏ qua hàng trống hoàn toàn
        if (!row || row.length === 0) {
          continue;
        }

        // Kiểm tra STT (cột đầu tiên) và tên vật tư (cột thứ hai)
        const hasSTT = row[0] !== undefined && row[0] !== null && row[0] !== '';
        const hasName =
          row[1] !== undefined && row[1] !== null && row[1] !== '';
        const isRoman =
          hasSTT && typeof row[0] === 'string' && isRomanNumeral(row[0]);

        // Điều kiện lọc: có tên vật tư HOẶC là hàng có số La Mã
        if (!hasName && !isRoman) {
          console.log(
            `Bỏ qua hàng ${i}: Không có tên vật tư hoặc không phải số La Mã`
          );
          continue;
        }

        // Debug log để kiểm tra
        console.log(
          `Row ${i}, STT value: ${
            row[0]
          }, Is Roman: ${isRoman}, Type: ${typeof row[0]}`
        );

        // Đảm bảo STT được lưu dưới dạng chuỗi
        let sttValue = '';
        if (hasSTT) {
          sttValue = String(row[0]).trim();
        }

        // Xử lý thông tin vật tư, mặc định giá trị là 0 hoặc chuỗi rỗng nếu không có dữ liệu
        const materialItem = {
          stt: sttValue,
          name: row[1] || '',
          material: row[2] || '',
          quyCach: row[3] && row[4] ? `${row[3]}x${row[4]}` : '',
          unit: row[6] || '',
          quantity: parseFloat(String(row[7] || '0')) || 0,
          weight: parseFloat(String(row[8] || '0')) || 0,
          unitPrice: 0,
          totalPrice: 0,
        };
        parsedMaterials.push(materialItem);
      }

      // Trả về kết quả
      return { materials: parsedMaterials };
    } catch (error: any) {
      console.error('Error importing materials from Drive:', error);
      // Lỗi từ Google API, có thể do accessToken hết hạn
      if (error.code === 401 || error.code === 403) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Token truy cập Google Drive không hợp lệ hoặc đã hết hạn.'
        );
      }
      throw new functions.https.HttpsError(
        'internal',
        'Lỗi không xác định khi xử lý file.',
        error.message
      );
    }
  });
