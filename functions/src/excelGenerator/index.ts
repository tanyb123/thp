import * as functions from 'firebase-functions/v1';
import { google, sheets_v4 } from 'googleapis';
import { CallableContext } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';

// Giả sử bạn đã định nghĩa kiểu này trong file types.ts
interface ExcelQuotationData {
  metadata: {
    projectName?: string;
    customerName?: string;
    customerAddress?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerTaxCode?: string;
    customerContactPerson?: string;
    quotationNumber?: string;
    quoteValidity?: string;
    deliveryTime?: string;
  };
  materials: {
    isNote?: boolean; // Flag to identify note rows
    no: number;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
    material?: string;
    weight?: number; // Thêm trường weight để lưu khối lượng vật tư
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
// @ts-ignore - Keep for backward compatibility
const DESTINATION_FOLDER_ID = '18OrAEBSuZzz-AFbqlitz5gUxpsdunXjX';
const START_ROW_MATERIALS = 10; // Dựa theo ảnh, có vẻ là dòng 10
// URL ảnh chữ ký từ Firebase Storage - đã xóa bỏ
// const SIGNATURE_IMAGE_URL =
//   'https://storage.googleapis.com/tanyb-fe4bf.firebasestorage.app/signature.png';

// ----- HÀM CHÍNH -----
export const generateExcelQuotation = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(
    async (
      data: {
        formattedData: ExcelQuotationData;
        projectId: string;
        accessToken: string;
      },
      context: CallableContext
    ) => {
      // ... (Phần xác thực và kiểm tra data giữ nguyên)
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập.'
        );
      }
      const { formattedData, projectId, accessToken } = data;
      if (!formattedData) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Dữ liệu không hợp lệ.'
        );
      }

      if (!projectId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu ID dự án.'
        );
      }

      if (!accessToken) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Thiếu accessToken Google của người dùng.'
        );
      }

      // Sử dụng OAuth2 client của googleapis với accessToken người dùng
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const drive = google.drive({ version: 'v3', auth });
      const sheets = google.sheets({ version: 'v4', auth });

      // Lấy thông tin dự án từ Firestore để tìm thư mục Drive
      const db = admin.firestore();
      const projectDoc = await db.collection('projects').doc(projectId).get();
      const projectData = projectDoc.data();

      if (!projectData || !projectData.driveFolderId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Không tìm thấy thông tin thư mục Drive của dự án.'
        );
      }

      try {
        // Tìm thư mục con 'baogia' trong thư mục dự án
        const baogiaFolderResponse = await drive.files.list({
          q: `name='baogia' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
        });

        // Nếu không tìm thấy thư mục baogia, tạo mới
        let baogiaFolderId;
        if (
          baogiaFolderResponse.data.files &&
          baogiaFolderResponse.data.files.length > 0
        ) {
          baogiaFolderId = baogiaFolderResponse.data.files[0].id;
        } else {
          // Tạo thư mục baogia nếu chưa có
          const folderResponse = await drive.files.create({
            requestBody: {
              name: 'baogia',
              mimeType: 'application/vnd.google-apps.folder',
              parents: [projectData.driveFolderId],
            },
            fields: 'id',
          });
          baogiaFolderId = folderResponse.data.id;
        }

        const newFileName = `Báo giá - ${
          formattedData.metadata.projectName || 'Dự án'
        } - ${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`;
        const copiedFileResponse = await drive.files.copy({
          fileId: TEMPLATE_FILE_ID,
          requestBody: { name: newFileName, parents: [baogiaFolderId] },
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
              endRowIndex: START_ROW_MATERIALS + 150, // Mở rộng vùng làm việc
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
          },
        });

        // Xóa nội dung cũ trong vùng làm việc động để tránh dữ liệu thừa từ template
        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: START_ROW_MATERIALS - 1,
              endRowIndex: START_ROW_MATERIALS + 150, // Phải khớp với vùng unmerge
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
            fields: 'userEnteredValue', // Chỉ xóa giá trị, giữ định dạng
          },
        });

        // Unmerge header rows 4-6 to avoid partial merge errors
        requests.push({
          unmergeCells: {
            range: {
              sheetId,
              startRowIndex: 3, // rows A4, A5, A6 index
              endRowIndex: 6,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
          },
        });

        // Cập nhật tên khách hàng vào ô A4
        // Merge cells A4-G4 for company name
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 0,
              endColumnIndex: 7,
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
                      stringValue: `KÍNH GỬI: ${
                        formattedData.metadata.customerName || ''
                      }`,
                    },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: 3, columnIndex: 0 }, // A4 (0-indexed)
          },
        });

        // Add border to company name
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
          },
        });

        // KHÔNG MERGE cells A5-G5 cho địa chỉ nữa
        // Thêm label "Địa chỉ:" vào A5
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'Địa chỉ:' },
                    userEnteredFormat: {
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: 4, columnIndex: 0 }, // A5
          },
        });

        // Ghi địa chỉ vào ô B5 (không merge)
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: formattedData.metadata.customerAddress || '',
                    },
                    userEnteredFormat: {
                      wrapStrategy: 'WRAP',
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: 4, columnIndex: 1 }, // B5
          },
        });

        // Merge cells B5:G5 sau khi đã thiết lập giá trị thành công
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 4,
              endRowIndex: 5,
              startColumnIndex: 1,
              endColumnIndex: 7,
            },
          },
        });

        // Add border to address row
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: 4,
              endRowIndex: 5,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
          },
        });

        // Cập nhật thông tin liên hệ khách hàng vào các ô tương ứng
        // Số điện thoại vào ô B6
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: formattedData.metadata.customerPhone || '',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 5, columnIndex: 1 }, // B6 (0-indexed)
          },
        });

        // Email vào ô B7 (với định dạng màu đen)
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: formattedData.metadata.customerEmail || '',
                    },
                    userEnteredFormat: {
                      textFormat: {
                        foregroundColor: { red: 0, green: 0, blue: 0 }, // Màu đen
                      },
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: 6, columnIndex: 1 }, // B7 (0-indexed)
          },
        });

        // Mã số thuế vào ô C6
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: 'MST:',
                    },
                    userEnteredFormat: {
                      textFormat: { bold: false }, // Bỏ bôi đậm
                      horizontalAlignment: 'LEFT',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: 5, columnIndex: 2 }, // C6
          },
        });

        // Tax code vào ô D6
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: formattedData.metadata.customerTaxCode || '',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 5, columnIndex: 3 }, // D6 (0-indexed)
          },
        });

        // Người liên hệ vào ô C7
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: 'Attn:',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 6, columnIndex: 2 }, // C7 (0-indexed)
          },
        });

        // Thêm tên người liên hệ vào ô D7
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        formattedData.metadata.customerContactPerson || '',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 6, columnIndex: 3 }, // D7 (0-indexed)
          },
        });

        if (formattedData.materials.length > 0) {
          const materialsRows: sheets_v4.Schema$RowData[] = [];

          formattedData.materials.forEach((material) => {
            // --- New classification logic ---
            const upperName = (material.name || '').trim().toUpperCase();

            const nameIsNoteMerge = upperName.includes('GHI CHÚ');
            const startsWithPlus = upperName.startsWith('+');

            const isAccessoryRow = upperName.startsWith('PHỤ KIỆN ĐI KÈM');

            const isGroupHeader = /^[IVXLCDM]+$/i.test(
              String(material.no || '').trim()
            );

            const isNoteRow =
              !isAccessoryRow &&
              !isGroupHeader &&
              (material.isNote ||
                nameIsNoteMerge ||
                startsWithPlus ||
                ((!material.unit || material.unit === '') &&
                  (material.quantity === null ||
                    material.quantity === undefined ||
                    material.quantity === 0) &&
                  (!material.material || material.material === '')));

            // 额外检查其他特殊行格式
            const isSpecialRow =
              (material.name && material.name.includes('-----')) ||
              (material.name &&
                material.name.toLowerCase().includes('tổng phụ')) ||
              (material.name &&
                material.name.toLowerCase().includes('tạm tính'));

            // 所有需要特殊处理的行
            const shouldFormatAsNote = isNoteRow || isSpecialRow;

            if (shouldFormatAsNote) {
              // 根据行类型调整格式
              if (isSpecialRow) {
                // 对于特殊行（如总计小计等），使用特殊格式
                let bgColor = { red: 1, green: 1, blue: 0.9 }; // 默认浅黄色
                let fontStyle = { bold: true, italic: false };
                let alignment = 'CENTER';

                // 可以根据不同类型的特殊行设置不同的样式
                if (
                  material.name &&
                  material.name.toLowerCase().includes('tổng phụ')
                ) {
                  bgColor = { red: 0.9, green: 0.9, blue: 1 }; // 浅蓝色
                  alignment = 'RIGHT';
                } else if (
                  material.name &&
                  material.name.toLowerCase().includes('tạm tính')
                ) {
                  bgColor = { red: 0.9, green: 1, blue: 0.9 }; // 浅绿色
                  alignment = 'RIGHT';
                }

                materialsRows.push({
                  values: [
                    {
                      userEnteredValue: { stringValue: material.name || '' },
                      userEnteredFormat: {
                        textFormat: fontStyle,
                        horizontalAlignment: alignment,
                        verticalAlignment: 'MIDDLE',
                        backgroundColor: bgColor,
                      },
                    },
                    {},
                    {},
                    {},
                    {},
                    {},
                  ],
                });
              } else {
                // 原始备注行格式保持不变
                materialsRows.push({
                  values: [
                    {
                      userEnteredValue: { stringValue: material.name || '' },
                      userEnteredFormat: {
                        textFormat: { italic: true, bold: true },
                        horizontalAlignment: 'LEFT',
                        verticalAlignment: 'MIDDLE',
                        backgroundColor: { red: 1, green: 1, blue: 0.9 },
                      },
                    },
                    {},
                    {},
                    {},
                    {},
                    {},
                  ],
                });
              }
            } else {
              if (isAccessoryRow) {
                // Accessory rows: blank numeric columns, distinct background color
                const accessoryBg = { red: 1, green: 0.93, blue: 0.8 }; // light peach
                materialsRows.push({
                  values: [
                    {
                      userEnteredValue: { stringValue: '' }, // Blank STT
                      userEnteredFormat: {
                        backgroundColor: accessoryBg,
                        textFormat: { bold: true },
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: material.name || '' },
                      userEnteredFormat: {
                        backgroundColor: accessoryBg,
                        textFormat: { bold: true },
                        horizontalAlignment: 'LEFT',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: {
                        stringValue: material.material || '',
                      },
                      userEnteredFormat: {
                        backgroundColor: accessoryBg,
                        textFormat: { bold: true },
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: material.unit || '' },
                      userEnteredFormat: {
                        backgroundColor: accessoryBg,
                        textFormat: { bold: true },
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: '' },
                      userEnteredFormat: {
                        backgroundColor: accessoryBg,
                        textFormat: { bold: true },
                      },
                    }, // SL blank
                    {
                      userEnteredValue: { stringValue: '' },
                      userEnteredFormat: {
                        backgroundColor: accessoryBg,
                        textFormat: { bold: true },
                      },
                    }, // Đơn giá blank
                    {
                      userEnteredValue: { stringValue: '' },
                      userEnteredFormat: {
                        backgroundColor: accessoryBg,
                        textFormat: { bold: true },
                      },
                    }, // Thành tiền blank
                  ],
                });
              } else if (isGroupHeader) {
                // Roman numeral header rows: only STT shown, blank numeric columns, grey background
                const headerBg = { red: 0.9, green: 0.9, blue: 0.9 };
                materialsRows.push({
                  values: [
                    {
                      userEnteredValue: { stringValue: String(material.no) },
                      userEnteredFormat: {
                        backgroundColor: headerBg,
                        textFormat: { bold: true },
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: material.name || '' },
                      userEnteredFormat: {
                        backgroundColor: headerBg,
                        textFormat: { bold: true },
                        horizontalAlignment: 'LEFT',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: {
                        stringValue: material.material || '',
                      },
                      userEnteredFormat: {
                        backgroundColor: headerBg,
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: material.unit || '' },
                      userEnteredFormat: {
                        backgroundColor: headerBg,
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: '' },
                      userEnteredFormat: { backgroundColor: headerBg },
                    },
                    {
                      userEnteredValue: { stringValue: '' },
                      userEnteredFormat: { backgroundColor: headerBg },
                    },
                    {
                      userEnteredValue: { stringValue: '' },
                      userEnteredFormat: { backgroundColor: headerBg },
                    },
                  ],
                });
              } else {
                // Regular rows (unchanged logic)
                materialsRows.push({
                  values: [
                    {
                      userEnteredValue: {
                        stringValue: material.no ? String(material.no) : '',
                      },
                      userEnteredFormat: {
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: material.name || '' },
                      userEnteredFormat: {
                        horizontalAlignment: 'LEFT',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: {
                        stringValue: material.material || '',
                      },
                      userEnteredFormat: {
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: material.unit || '' },
                      userEnteredFormat: {
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: {
                        numberValue: material.quantity ?? 0,
                      },
                      userEnteredFormat: {
                        horizontalAlignment: 'CENTER',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: material.unitPrice
                        ? { numberValue: material.unitPrice }
                        : { stringValue: '' },
                      userEnteredFormat: {
                        numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                        textFormat: { bold: material.unitPrice ? true : false },
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    {
                      userEnteredValue: material.total
                        ? { numberValue: material.total }
                        : { stringValue: '' },
                      userEnteredFormat: {
                        numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                        textFormat: { bold: material.total ? true : false },
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                  ],
                });
              }
            }
          });
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

          // Áp dụng font Times New Roman cỡ 13 cho toàn bộ bảng vật tư (A:G)
          requests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: START_ROW_MATERIALS - 1,
                endRowIndex: lastMaterialRow, // Dòng cuối của vật tư (exclusive)
                startColumnIndex: 0, // Cột A
                endColumnIndex: 7, // Cột G (exclusive)
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    fontFamily: 'Times New Roman',
                    fontSize: 13,
                  },
                },
              },
              fields:
                'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize',
            },
          });

          // Thiết lập chiều cao dòng ~45px (≈33.75pt) cho bảng vật tư
          requests.push({
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: START_ROW_MATERIALS - 1,
                endIndex: lastMaterialRow, // exclusive
              },
              properties: { pixelSize: 45 },
              fields: 'pixelSize',
            },
          });

          // Add merge requests for note rows and special rows between notes and total
          formattedData.materials.forEach((material, index) => {
            const nameIsNoteMerge = (material.name || '')
              .toUpperCase()
              .includes('GHI CHÚ');
            const startsWithPlusMerge = (material.name || '')
              .trim()
              .startsWith('+');

            // 新增逻辑： xác định phụ kiện & header
            const upperNameMerge = (material.name || '').trim().toUpperCase();
            const isAccessoryRowMerge =
              upperNameMerge.startsWith('PHỤ KIỆN ĐI KÈM');
            const isGroupHeaderMerge = /^[IVXLCDM]+$/i.test(
              String(material.no || '').trim()
            );

            // 扩展合并条件，包括备注行和需要合并的特殊行，但 bỏ qua phụ kiện 和 header
            const isNoteRowMerge =
              material.isNote ||
              nameIsNoteMerge ||
              startsWithPlusMerge ||
              ((!material.unit || material.unit === '') &&
                (material.quantity === null ||
                  material.quantity === undefined ||
                  material.quantity === 0) &&
                (!material.material || material.material === ''));

            const shouldMergeFullRow =
              (isNoteRowMerge ||
                (material.name && material.name.includes('-----')) ||
                (material.name &&
                  material.name.toLowerCase().includes('tổng phụ')) ||
                (material.name &&
                  material.name.toLowerCase().includes('tạm tính'))) &&
              !isAccessoryRowMerge &&
              !isGroupHeaderMerge;

            if (shouldMergeFullRow) {
              const noteRowIndex = START_ROW_MATERIALS - 1 + index;
              requests.push({
                mergeCells: {
                  range: {
                    sheetId,
                    startRowIndex: noteRowIndex,
                    endRowIndex: noteRowIndex + 1,
                    startColumnIndex: 0, // Column A
                    endColumnIndex: 7, // Up to column G (7 columns total)
                  },
                  mergeType: 'MERGE_ALL',
                },
              });
            }
          });
        }

        // --- Bắt đầu phần định dạng Footer ---
        const blueBg = { red: 200 / 255, green: 204 / 255, blue: 228 / 255 }; // #c8cce4
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

        // Đầu tiên xóa nội dung đang có ở vùng chữ ký để tránh lặp lại
        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: signatureRow - 1,
              endRowIndex: signatureRow + 5,
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
            fields: 'userEnteredValue',
          },
        });

        // Thiết lập lại "Xác Nhận Bên Mua"
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

        // Vùng để ký bên mua
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

        // Thêm border cho khu vực ký của Bên Mua
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: signatureRow - 1, // Bắt đầu từ header "Xác Nhận Bên Mua"
              endRowIndex: signatureRow + 5, // Kết thúc sau khu vực để chữ ký
              startColumnIndex: 0,
              endColumnIndex: buyerSignatureEndCol,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
            innerHorizontal: { style: 'SOLID' },
            innerVertical: { style: 'SOLID' },
          },
        });

        // Thiết lập "Xác Nhận Bên Bán"
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
        });

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

        // Vùng chữ ký bên bán và hình ảnh chữ ký
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

        // **FIX 1: Chèn ảnh chữ ký từ Firebase Storage**
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

        // Chèn ảnh chữ ký từ Firebase Storage URL - Sửa cú pháp dấu phẩy thành dấu chấm phẩy
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      formulaValue: `=A1`, // Xóa ảnh chữ ký và sử dụng reference trống A1
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

        // Chèn chuỗi ngày ở ô G2 (rowIndex 1) dạng ddMMyy- bằng text thuần để tránh lỗi công thức theo locale
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yy = String(today.getFullYear()).slice(-2);
        const dateSlash = `${dd}/${mm}/${yy}`; // dd/MM/yy
        const dateText = `${dd}${mm}${yy}-`; // ddMMyy-

        // Ô G2 (rowIndex 1): dd/MM/yy
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: dateSlash },
                    userEnteredFormat: {
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      textFormat: {
                        fontFamily: 'Times New Roman',
                        fontSize: 13,
                      },
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: 1, columnIndex: 6 }, // G2
          },
        });

        // Ô G3 (rowIndex 2): ddMMyy-
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: dateText },
                    userEnteredFormat: {
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      textFormat: {
                        fontFamily: 'Times New Roman',
                        fontSize: 13,
                      },
                    },
                  },
                ],
              },
            ],
            fields: '*',
            start: { sheetId, rowIndex: 2, columnIndex: 6 }, // G3
          },
        });

        // Borders for G2 and G3
        const dateRows = [1, 2];
        dateRows.forEach((rowIdx) => {
          requests.push({
            updateBorders: {
              range: {
                sheetId,
                startRowIndex: rowIdx,
                endRowIndex: rowIdx + 1,
                startColumnIndex: 6,
                endColumnIndex: 7,
              },
              top: { style: 'SOLID' },
              bottom: { style: 'SOLID' },
              left: { style: 'SOLID' },
              right: { style: 'SOLID' },
            },
          });
        });

        // **FIX 2 & 4: Kẻ bảng chính xác, loại bỏ border thừa**
        // Instead of one global border, apply borders individually for each row
        // to correctly handle note rows (which should not have innerVertical borders)
        if (formattedData.materials.length > 0) {
          // First apply border to the header row
          requests.push({
            updateBorders: {
              range: {
                sheetId,
                startRowIndex: START_ROW_MATERIALS - 2, // Header row
                endRowIndex: START_ROW_MATERIALS - 1,
                startColumnIndex: 0,
                endColumnIndex: summaryEndColumn,
              },
              top: { style: 'SOLID' },
              bottom: { style: 'SOLID' },
              left: { style: 'SOLID' },
              right: { style: 'SOLID' },
              innerVertical: { style: 'SOLID' },
            },
          });

          // Then apply borders for each material row individually
          formattedData.materials.forEach((material, index) => {
            const rowStartIndex = START_ROW_MATERIALS - 1 + index;
            const rowEndIndex = rowStartIndex + 1;

            const nameIsNoteBorder = (material.name || '')
              .toUpperCase()
              .includes('GHI CHÚ');
            const startsWithPlusBorder = (material.name || '')
              .trim()
              .startsWith('+');
            // (legacy note row detection removed as it's no longer required)

            const upperNameBorder = (material.name || '').trim().toUpperCase();
            const isAccessoryRowBorder =
              upperNameBorder.startsWith('PHỤ KIỆN ĐI KÈM');
            const isGroupHeaderBorder = /^[IVXLCDM]+$/i.test(
              String(material.no || '').trim()
            );

            const isNoteRowBorder =
              material.isNote ||
              nameIsNoteBorder ||
              startsWithPlusBorder ||
              ((!material.unit || material.unit === '') &&
                (material.quantity === null ||
                  material.quantity === undefined ||
                  material.quantity === 0) &&
                (!material.material || material.material === ''));

            const shouldMergeForBorder =
              (isNoteRowBorder ||
                (material.name && material.name.includes('-----')) ||
                (material.name &&
                  material.name.toLowerCase().includes('tổng phụ')) ||
                (material.name &&
                  material.name.toLowerCase().includes('tạm tính'))) &&
              !isAccessoryRowBorder &&
              !isGroupHeaderBorder;

            if (shouldMergeForBorder) {
              // For note rows, only apply outer borders (no inner vertical borders)
              requests.push({
                updateBorders: {
                  range: {
                    sheetId,
                    startRowIndex: rowStartIndex,
                    endRowIndex: rowEndIndex,
                    startColumnIndex: 0,
                    endColumnIndex: summaryEndColumn,
                  },
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                  // No innerVertical for note rows
                },
              });
            } else {
              // For regular rows, apply full borders including inner vertical lines
              requests.push({
                updateBorders: {
                  range: {
                    sheetId,
                    startRowIndex: rowStartIndex,
                    endRowIndex: rowEndIndex,
                    startColumnIndex: 0,
                    endColumnIndex: summaryEndColumn,
                  },
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                  innerVertical: { style: 'SOLID' },
                },
              });
            }
          });
        }

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
            innerVertical: { style: 'SOLID' }, // <-- THÊM DÒNG NÀY
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

        // Xóa nội dung ở các dòng phía dưới để tránh hiển thị văn bản dư thừa từ template
        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: signatureRow + 6,
              endRowIndex: signatureRow + 20, // Xóa đến dòng +20 để đảm bảo xóa hết
              startColumnIndex: 0,
              endColumnIndex: summaryEndColumn,
            },
            fields: 'userEnteredValue',
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

        return {
          success: true,
          excelUrl: fileResponse.data.webViewLink,
          spreadsheetId: newFileId, // Thêm spreadsheetId vào kết quả trả về
        };
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
