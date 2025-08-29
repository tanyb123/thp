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

// Chuẩn hóa chuỗi tiếng Việt để so khớp không dấu
function normalizeVi(str: string): string {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
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
        defval: null,
      });

      const parsedMaterials: any[] = [];
      // Bắt đầu từ dòng 3 (index 2) để không bỏ lỡ dòng tổng hợp đầu bảng nếu có
      for (let i = 2; i < rawData.length; i++) {
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

        // Nếu là dòng tổng hợp/tổng cộng (STT La Mã hoặc tên chứa từ khoá), tạo một item đặc biệt
        const rawName = (row[1] || '').toString();
        const nameNormalized = normalizeVi(rawName);
        if (
          isRoman ||
          nameNormalized.includes('TONG CONG') ||
          nameNormalized.includes('TONG HOP') ||
          nameNormalized.includes('TONG KET')
        ) {
          const summaryItem = {
            stt: String(row[0] || '').trim(),
            name: rawName,
            material: '',
            quyCach: '',
            unit: String(row[6] || '').trim(),
            quantity: parseFloat(String(row[7] || '0')) || 0,
            weight: parseFloat(String(row[8] || '0')) || 0, // KL/cái
            totalWeight: parseFloat(String(row[9] || '0')) || 0, // KL tổng
            unitPrice: 0,
            totalPrice: 0,
            isSummary: true,
          };
          parsedMaterials.push(summaryItem);
          continue; // không xử lý tiếp như vật tư thường
        }

        // Đảm bảo STT được lưu dưới dạng chuỗi
        let sttValue = '';
        if (hasSTT) {
          sttValue = String(row[0]).trim();
        }

        // Xử lý thông tin vật tư, mặc định giá trị là 0 hoặc chuỗi rỗng nếu không có dữ liệu
        const materialItem = {
          stt: sttValue,
          name: rawName || '',
          material: row[2] || '',
          quyCach: row[3] && row[4] ? `${row[3]}x${row[4]}` : row[3] || '',
          unit: String(row[6] || '').trim(),
          quantity: parseFloat(String(row[7] || '0')) || 0,
          weight: parseFloat(String(row[8] || '0')) || 0, // KL/cái
          totalWeight: parseFloat(String(row[9] || '0')) || 0, // KL tổng (cột J)
          unitPrice: 0,
          totalPrice: 0,
        };
        parsedMaterials.push(materialItem);
      }

      // Trả về duy nhất mảng materials (đã bao gồm item isSummary nếu có)
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
