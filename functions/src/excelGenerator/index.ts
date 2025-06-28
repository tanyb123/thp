// functions/src/index.ts

import * as functions from 'firebase-functions/v1';
import { google, sheets_v4 } from 'googleapis';
import { CallableContext } from 'firebase-functions/v1/https';

// Giả sử bạn đã định nghĩa kiểu này trong file types.ts
interface ExcelQuotationData {
  metadata: {
    projectName?: string;
    customerName?: string;
    customerAddress?: string;
    quotationNumber?: string;
    quoteValidity?: string;
    deliveryTime?: string;
  };
  materials: {
    no: number;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  summary: {
    subTotal: number;
    vatPercentage: number;
    vatAmount: number;
    grandTotal: number;
  };
}

// ----- CẤU HÌNH -----
const TEMPLATE_FILE_ID = '18CYrE8IHHbqNBc-FWrQw5kGnyLW31VDJOA4a1tusu4M';
const DESTINATION_FOLDER_ID = '18OrAEBSuZzz-AFbqlitz5gUxpsdunXjX';
const START_ROW_MATERIALS = 10; // Dựa theo ảnh, có vẻ là dòng 10
const SIGNATURE_IMAGE_URL =
  'https://drive.google.com/uc?export=view&id=1OM7JVgPl8V16-N6r-jsWyp360lZ_lhEz';

// ----- HÀM CHÍNH -----
export const generateExcelQuotation = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(
    async (
      data: { formattedData: ExcelQuotationData },
      context: CallableContext
    ) => {
      // ... (Phần xác thực và kiểm tra data giữ nguyên)
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập.'
        );
      }
      const { formattedData } = data;
      if (!formattedData) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Dữ liệu không hợp lệ.'
        );
      }

      const auth = new google.auth.GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets',
        ],
        keyFile: './tanyb-fe4bf-4fbd5c01b6c7.json',
      });
      const drive = google.drive({ version: 'v3', auth });
      const sheets = google.sheets({ version: 'v4', auth });

      try {
        const newFileName = `Báo giá - ${
          formattedData.metadata.projectName || 'Dự án'
        } - ${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`;
        const copiedFileResponse = await drive.files.copy({
          fileId: TEMPLATE_FILE_ID,
          requestBody: { name: newFileName, parents: [DESTINATION_FOLDER_ID] },
        });

        const newFileId = copiedFileResponse.data.id;
        if (!newFileId) throw new Error('Không thể sao chép file template.');

        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: newFileId,
          fields: 'sheets.properties',
        });
        const firstSheet = spreadsheet.data.sheets?.[0];
        const sheetId = firstSheet?.properties?.sheetId;
        if (sheetId === undefined || sheetId === null) {
          throw new Error('Không thể xác định sheetId của sheet đầu tiên');
        }

        // Tính toán vị trí các dòng
        const lastMaterialRow =
          START_ROW_MATERIALS + Math.max(0, formattedData.materials.length - 1);
        const totalRow = lastMaterialRow + 2;
        const vatRow = totalRow + 1;
        const totalWithVatRow = vatRow + 1;
        const amountInWordsRow = totalWithVatRow + 1;
        const blankRowAfterWords = amountInWordsRow + 1; // Dòng trống
        const notesRow = blankRowAfterWords + 1;
        const footerStartRow = notesRow + 1;
        const signatureRow = footerStartRow + 6;

        const requests: sheets_v4.Schema$Request[] = [];

        // Hủy bỏ merge cell ở vùng có thể gây lỗi
        requests.push({
          unmergeCells: {
            range: {
              sheetId,
              startRowIndex: START_ROW_MATERIALS - 1,
              endRowIndex: START_ROW_MATERIALS + 50,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
          },
        });

        // Header & Materials Data (giữ nguyên, chỉ chỉnh rowIndex cho đúng)
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: `KÍNH GỬI: ${formattedData.metadata.customerName}`,
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 11, columnIndex: 0 },
          },
        });
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: `Địa chỉ: ${formattedData.metadata.customerAddress}`,
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 12, columnIndex: 0 },
          },
        });

        if (formattedData.materials.length > 0) {
          const materialsRows = formattedData.materials.map(
            (material, index) => ({
              values: [
                { userEnteredValue: { numberValue: index + 1 } },
                { userEnteredValue: { stringValue: material.name } },
                { userEnteredValue: { stringValue: material.unit || 'cái' } },
                { userEnteredValue: { stringValue: '' } },
                { userEnteredValue: { numberValue: material.quantity } },
                {
                  userEnteredValue: { numberValue: material.unitPrice },
                  userEnteredFormat: {
                    numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                  },
                },
                {
                  userEnteredValue: { numberValue: material.total },
                  userEnteredFormat: {
                    numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                  },
                },
              ],
            })
          );
          requests.push({
            updateCells: {
              rows: materialsRows,
              fields: 'userEnteredValue,userEnteredFormat',
              start: {
                sheetId,
                rowIndex: START_ROW_MATERIALS - 1,
                columnIndex: 0,
              },
            },
          });
        }

        // --- Bắt đầu phần định dạng Footer ---
        const blueBg = { red: 217 / 255, green: 234 / 255, blue: 250 / 255 };
        const yellowBg = { red: 255 / 255, green: 255 / 255, blue: 204 / 255 };
        const boldRight = {
          horizontalAlignment: 'RIGHT',
          textFormat: { bold: true, fontSize: 11 },
          backgroundColor: blueBg,
        };
        const boldRightValue = {
          ...boldRight,
          numberFormat: { type: 'NUMBER', pattern: '#,##0' },
        };
        const boldCenterYellow = {
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          textFormat: { bold: true, italic: true, fontSize: 11 },
          backgroundColor: yellowBg,
        };

        // Tổng cộng, VAT, Tổng có VAT (kéo dài đến cột G - index 6)
        const summaryEndColumn = 7; // Cột G
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: totalRow - 1,
              endRowIndex: totalRow,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn - 1,
            },
          },
        });
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'Tổng cộng' },
                    userEnteredFormat: boldRight,
                  },
                  {},
                  {},
                  {},
                  {},
                  {},
                  {
                    userEnteredValue: {
                      numberValue: formattedData.summary.subTotal,
                    },
                    userEnteredFormat: boldRightValue,
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: totalRow - 1, columnIndex: 0 },
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: vatRow - 1,
              endRowIndex: vatRow,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn - 1,
            },
          },
        });
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: `Thuế VAT ${formattedData.summary.vatPercentage}%`,
                    },
                    userEnteredFormat: boldRight,
                  },
                  {},
                  {},
                  {},
                  {},
                  {},
                  {
                    userEnteredValue: {
                      numberValue: formattedData.summary.vatAmount,
                    },
                    userEnteredFormat: boldRightValue,
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: vatRow - 1, columnIndex: 0 },
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: totalWithVatRow - 1,
              endRowIndex: totalWithVatRow,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn - 1,
            },
          },
        });
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: 'Tổng cộng đã bao gồm VAT 10%',
                    },
                    userEnteredFormat: boldRight,
                  },
                  {},
                  {},
                  {},
                  {},
                  {},
                  {
                    userEnteredValue: {
                      numberValue: formattedData.summary.grandTotal,
                    },
                    userEnteredFormat: boldRightValue,
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: totalWithVatRow - 1, columnIndex: 0 },
          },
        });

        // Bằng chữ
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: amountInWordsRow - 1,
              endRowIndex: amountInWordsRow,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
          },
        });
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: convertNumberToVnWords(
                        formattedData.summary.grandTotal
                      ),
                    },
                    userEnteredFormat: boldCenterYellow,
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: amountInWordsRow - 1, columnIndex: 0 },
          },
        });

        // **FIX 3: Merge và kẻ viền dòng trống**
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: blankRowAfterWords - 1,
              endRowIndex: blankRowAfterWords,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
          },
        });

        // Ghi chú
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: notesRow - 1,
              endRowIndex: notesRow,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
          },
        });
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        'Ghi chú: Các điều khoản khác vui lòng xem bên dưới.',
                    },
                    userEnteredFormat: {
                      textFormat: { bold: true, italic: true },
                      padding: { left: 10 },
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: notesRow - 1, columnIndex: 0 },
          },
        });

        // Phần điều khoản
        const termsTextPart1 =
          `1. Báo giá có hiệu lực trong ${
            formattedData.metadata.quoteValidity || '7 ngày'
          }. Hết hiệu lực xin liên hệ lại cho Công ty.\n` +
          `2. Thời gian giao hàng: ${
            formattedData.metadata.deliveryTime || '3 ngày'
          } ( không bao gồm chủ nhật, ngày lễ )\n` +
          `3. Giá đã bao gồm VAT và chưa bao gồm vận chuyển\n` +
          `4. Địa điểm giao hàng: Xưởng THP\n` +
          `5. Phương thức thanh toán: Thanh toán bằng chuyển khoản\n` +
          `    Tài khoản số: 27888866\n` +
          `    Tên tài khoản: Công ty TNHH SX cơ khí TM-DV Tân Hòa Phát\n` +
          `    Ngân hàng TMCP Á Châu - Chi nhánh Bình Tây\n`;
        const termsTextPart2 = `    Tạm ứng 50%, Thanh toán 50% trước khi nhận hàng`;

        // Mở rộng merge cell cho điều khoản
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: footerStartRow - 1,
              endRowIndex: footerStartRow + 5,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
          },
        });

        // Phần điều khoản thông thường
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: termsTextPart1,
                    },
                    userEnteredFormat: {
                      wrapStrategy: 'WRAP',
                      verticalAlignment: 'TOP',
                      padding: { left: 20 },
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: footerStartRow - 1, columnIndex: 0 },
          },
        });

        // Phần điều khoản màu đỏ (tạm ứng)
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: termsTextPart2,
                    },
                    userEnteredFormat: {
                      wrapStrategy: 'WRAP',
                      verticalAlignment: 'TOP',
                      padding: { left: 20 },
                      textFormat: {
                        foregroundColor: { red: 1, green: 0, blue: 0 },
                        bold: true,
                      },
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: footerStartRow + 4, columnIndex: 0 },
          },
        });

        // Vùng chữ ký
        const buyerSignatureEndCol = 4; // Cột D
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: signatureRow - 1,
              endRowIndex: signatureRow,
              startColumnIndex: 0,
              endColumnIndex: buyerSignatureEndCol,
            },
          },
        });
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'Xác Nhận Bên Mua' },
                    userEnteredFormat: {
                      horizontalAlignment: 'CENTER',
                      textFormat: { bold: true },
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: signatureRow - 1, columnIndex: 0 },
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: signatureRow,
              endRowIndex: signatureRow + 5,
              startColumnIndex: 0,
              endColumnIndex: buyerSignatureEndCol,
            },
          },
        });

        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: signatureRow - 1,
              endRowIndex: signatureRow,
              startColumnIndex: buyerSignatureEndCol,
              endColumnIndex: summaryEndColumn,
            },
          },
        }); // Cột E-G
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'Xác Nhận Bên Bán' },
                    userEnteredFormat: {
                      horizontalAlignment: 'CENTER',
                      textFormat: { bold: true },
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: {
              sheetId,
              rowIndex: signatureRow - 1,
              columnIndex: buyerSignatureEndCol,
            },
          },
        });

        // **FIX 1: Chèn ảnh vào ô đã merge**
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: signatureRow,
              endRowIndex: signatureRow + 5,
              startColumnIndex: buyerSignatureEndCol,
              endColumnIndex: summaryEndColumn,
            },
          },
        });

        // Chèn ảnh chữ ký sử dụng IMAGE function
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      formulaValue: `=IMAGE("${SIGNATURE_IMAGE_URL}")`,
                    },
                    userEnteredFormat: {
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: {
              sheetId,
              rowIndex: signatureRow,
              columnIndex: buyerSignatureEndCol,
            },
          },
        });

        // **FIX 2 & 4: Kẻ bảng chính xác, loại bỏ border thừa**
        // Kẻ bảng vật tư
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: START_ROW_MATERIALS - 2,
              endRowIndex: lastMaterialRow + 1,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
            innerHorizontal: { style: 'SOLID' },
            innerVertical: { style: 'SOLID' },
          },
        });
        // Kẻ bảng tổng kết
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: totalRow - 1,
              endRowIndex: notesRow,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
            innerHorizontal: { style: 'SOLID' },
          },
        });
        // Kẻ bảng điều khoản
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: notesRow,
              endRowIndex: signatureRow - 1,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
          },
        });
        // Kẻ bảng chữ ký (quan trọng: không kẻ innerVertical)
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: signatureRow - 1,
              endRowIndex: signatureRow + 5,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
            innerHorizontal: { style: 'SOLID' },
          },
        });

        // Gửi tất cả các request định dạng
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: newFileId,
          requestBody: { requests },
        });

        // Cấp quyền và trả về URL
        await drive.permissions.create({
          fileId: newFileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });
        const fileResponse = await drive.files.get({
          fileId: newFileId,
          fields: 'webViewLink',
        });

        return { success: true, excelUrl: fileResponse.data.webViewLink };
      } catch (error: any) {
        console.error(
          'Lỗi khi tạo báo giá:',
          error.response ? error.response.data.error : error.message
        );
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi khi tạo file trên Google Drive: ${error.message}`
        );
      }
    }
  );

// Hàm convertNumberToVnWords giữ nguyên
function convertNumberToVnWords(n: number): string {
  if (n === null || n === undefined) return '';
  const num = Math.floor(n);
  if (num === 0) return 'Bằng chữ: Không đồng chẵn.';
  const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const numbers = [
    'không',
    'một',
    'hai',
    'ba',
    'bốn',
    'năm',
    'sáu',
    'bảy',
    'tám',
    'chín',
  ];
  const convertGroup = (group: number): string => {
    let result = '';
    const tram = Math.floor(group / 100);
    const chuc = Math.floor((group % 100) / 10);
    const donvi = group % 10;
    if (tram > 0) {
      result += numbers[tram] + ' trăm';
      if (chuc === 0 && donvi !== 0) result += ' linh';
    }
    if (chuc > 1) {
      result += (tram > 0 ? ' ' : '') + numbers[chuc] + ' mươi';
      if (donvi === 1) result += ' mốt';
    } else if (chuc === 1) {
      result += (tram > 0 ? ' ' : '') + 'mười';
    }
    if (donvi > 0 && chuc !== 1) {
      if (donvi === 5 && chuc > 0) {
        result += (result.length > 0 ? ' ' : '') + 'lăm';
      } else if (donvi === 4 && chuc > 1) {
        result += (result.length > 0 ? ' ' : '') + 'tư';
      } else {
        result += (result.length > 0 ? ' ' : '') + numbers[donvi];
      }
    } else if (donvi > 0 && chuc === 1) {
      if (donvi === 5) {
        result += ' lăm';
      } else {
        result += ' ' + numbers[donvi];
      }
    }
    return result;
  };
  if (num === 0) return 'Không';
  let result = '';
  let i = 0;
  let tempNum = num;
  while (tempNum > 0) {
    let groupValue = tempNum % 1000;
    if (groupValue > 0) {
      let groupText = convertGroup(groupValue);
      result = groupText + units[i] + (result ? ' ' + result : '');
    }
    tempNum = Math.floor(tempNum / 1000);
    i++;
  }
  result = result.trim();
  return (
    'Bằng chữ: ' +
    result.charAt(0).toUpperCase() +
    result.slice(1) +
    ' đồng chẵn.'
  );
}
