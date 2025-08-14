/**
 * @fileoverview Cloud Function to generate a contract from a Google Docs template.
 *
 * @description
 * This function implements a professional "Native Table Insertion" approach for generating
 * contracts. It creates a properly formatted table directly using Google Docs API.
 *
 * HƯỚNG DẪN CẤU HÌNH TEMPLATE GOOGLE DOCS (QUAN TRỌNG):
 *
 * 1. **Chuẩn bị Template:**
 *    - Tạo một file Google Docs để làm mẫu hợp đồng.
 *    - Đặt các placeholder cho các trường văn bản đơn giản, ví dụ: {companyName}, {customerAddress}, {grandTotal}.
 *
 * 2. **Chuẩn bị phần Bảng Vật Tư:**
 *    - Chỉ cần đặt một placeholder đơn giản: {{MATERIALS_TABLE}}
 *    - Placeholder này sẽ được thay thế bằng một bảng thực sự được tạo bởi Google Docs API.
 *    - Bảng sẽ tự động điều chỉnh kích thước dựa trên số lượng vật tư.
 *
 * 3. **Lấy ID Template:**
 *    - Mở file template Google Docs, copy ID từ URL.
 *      (Ví dụ: trong `.../d/THIS_IS_THE_ID/edit`, `THIS_IS_THE_ID` chính là ID).
 *    - Cập nhật biến `CONTRACT_TEMPLATE_ID` bên dưới bằng ID này.
 */
import * as functions from 'firebase-functions/v1';
// path import removed
import * as admin from 'firebase-admin';
// Import kiểu dữ liệu, không import thư viện thực tế
import type { docs_v1 } from 'googleapis';

// --- CONFIGURATION ---
// TODO: Thay thế bằng ID của file Google Docs template của bạn
const CONTRACT_TEMPLATE_ID = '1d0ERJFmbBmhqe4CcaMi02EBi20BXYCgZeasMCbT6ULc'; // ID TEMPLATE CẦN ĐƯỢC CẬP NHẬT

// --- TYPE DEFINITIONS ---
// Định nghĩa cấu trúc cho một hàng vật tư
interface MaterialItem {
  name: string;
  material: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
  weight?: number | string; // Thêm trọng lượng để tính đơn giá
  [key: string]: any;
}

// Định nghĩa cấu trúc cho dữ liệu hợp đồng được gửi từ client
interface ContractData {
  materials?: MaterialItem[];
  subTotal?: number;
  vatPercentage?: number;
  vatAmount?: number;
  grandTotal?: number;
  [key: string]: any; // Cho phép các trường khác
}

/**
 * Chuyển số thành chữ tiếng Việt
 * @param n Số cần chuyển đổi
 * @returns Chuỗi biểu diễn số bằng chữ tiếng Việt
 */
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

/**
 * Generates a contract by populating a Google Docs template using the "Native Table Insertion" approach.
 * This approach creates a properly formatted table directly using Google Docs API.
 */
export const generateContract = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 300,
    memory: '1GB',
  })
  .https.onCall(async (data, context) => {
    // 1. ========= INITIALIZATION & VALIDATION =========
    // Import googleapis chỉ khi hàm được gọi
    const { google } = await import('googleapis');

    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn phải đăng nhập để thực hiện chức năng này.'
      );
    }

    const { contractData, fileName, projectId, accessToken } = data;
    const typedContractData = contractData as ContractData;

    if (!typedContractData || !fileName || !projectId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Dữ liệu đầu vào không hợp lệ (thiếu contractData, fileName, hoặc projectId).'
      );
    }

    if (!accessToken) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu accessToken Google của người dùng.'
      );
    }

    try {
      // Initialize Google APIs with user accessToken similary to generateExcelQuotation
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const drive = google.drive({ version: 'v3', auth });
      const docs = google.docs({ version: 'v1', auth });

      // Get project folder info from Firestore
      const db = admin.firestore();
      const projectDoc = await db.collection('projects').doc(projectId).get();
      const projectData = projectDoc.data();

      if (!projectData || !projectData.driveFolderId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Không tìm thấy thông tin thư mục Drive của dự án.'
        );
      }

      // Find 'hopdong' subfolder in project folder
      const hopdongFolderResponse = await drive.files.list({
        q: `name='hopdong' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
      });

      let hopdongFolderId;
      if (
        hopdongFolderResponse.data.files &&
        hopdongFolderResponse.data.files.length > 0
      ) {
        hopdongFolderId = hopdongFolderResponse.data.files[0].id;
      } else {
        // Create 'hopdong' folder if it doesn't exist
        const folderResponse = await drive.files.create({
          requestBody: {
            name: 'hopdong',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [projectData.driveFolderId],
          },
          fields: 'id',
        });
        hopdongFolderId = folderResponse.data.id;
      }

      // Copy the template document
      const copiedFileResponse = await drive.files.copy({
        fileId: CONTRACT_TEMPLATE_ID,
        requestBody: {
          name: fileName,
          parents: [hopdongFolderId],
        },
      });
      const newDocId = copiedFileResponse.data.id;
      if (!newDocId) {
        throw new Error('Không thể sao chép file template Google Docs.');
      }

      functions.logger.info(`Đã tạo file tạm từ template, ID: ${newDocId}`);

      // 2. ========= TEXT REPLACEMENTS =========
      const requests: docs_v1.Schema$Request[] = [];

      // Xử lý tất cả các trường thông thường (không bao gồm bảng vật tư)
      const { materials, ...textFields } = typedContractData;

      Object.entries(textFields).forEach(([key, value]) => {
        // Đảm bảo key có dạng {key} để phù hợp với placeholder trong template
        const placeholderKey =
          key.startsWith('{') && key.endsWith('}') ? key : `{${key}}`;

        // Chuyển đổi value thành chuỗi, đảm bảo null/undefined trở thành chuỗi rỗng
        const replacementText = value != null ? String(value) : '';

        requests.push({
          replaceAllText: {
            containsText: {
              text: placeholderKey,
              matchCase: true,
            },
            replaceText: replacementText,
          },
        });
      });

      // 3. ========= APPLY TEXT REPLACEMENTS =========
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: { requests },
        });
        functions.logger.info(
          `Đã thực hiện ${requests.length} yêu cầu thay thế văn bản.`
        );
      }

      // 4. ========= FIND TABLE PLACEHOLDER POSITION =========
      // Lấy nội dung tài liệu để tìm vị trí của placeholder {{MATERIALS_TABLE}}
      const document = await docs.documents.get({
        documentId: newDocId,
      });

      // Tìm vị trí của placeholder {{MATERIALS_TABLE}}
      let placeholderIndex: number | null = null;

      if (document.data.body?.content) {
        for (const element of document.data.body.content) {
          if (element.paragraph && element.paragraph.elements) {
            for (const paraElement of element.paragraph.elements) {
              if (
                paraElement.textRun &&
                paraElement.textRun.content &&
                paraElement.textRun.content.includes('{{MATERIALS_TABLE}}')
              ) {
                placeholderIndex = paraElement.startIndex || null;
                break;
              }
            }
            if (placeholderIndex !== null) break;
          }
        }
      }

      if (placeholderIndex === null) {
        functions.logger.warn(
          'Không tìm thấy placeholder {{MATERIALS_TABLE}} trong tài liệu.'
        );
      } else {
        functions.logger.info(
          `Đã tìm thấy placeholder {{MATERIALS_TABLE}} tại vị trí: ${placeholderIndex}`
        );

        // 5. ========= CREATE AND INSERT TABLE =========
        // ===== MATERIALS FILTER & CLASSIFY =====
        const rawMaterials = materials || [];

        const filteredMaterials = rawMaterials.filter((item) => {
          const name = (item.name || '').trim().toUpperCase();
          const isNote = name.startsWith('GHI CHÚ');
          const startsWithPlus = name.startsWith('+');
          return !isNote && !startsWithPlus; // Loại bỏ ghi chú và dòng '+'
        });

        // +1 cho hàng header
        const numRows = filteredMaterials.length + 1;
        const numColumns = 7; // STT, Vật Tư/Hàng Hóa, VL, ĐVT, SL, Đơn giá, Thành Tiền

        functions.logger.info(
          `Chuẩn bị tạo bảng với ${numRows} hàng (đã lọc) và ${numColumns} cột.`
        );

        // Yêu cầu để xóa placeholder và tạo bảng trống
        const createTableRequests: docs_v1.Schema$Request[] = [
          {
            deleteContentRange: {
              range: {
                startIndex: placeholderIndex,
                endIndex: placeholderIndex + '{{MATERIALS_TABLE}}'.length,
              },
            },
          },
          {
            insertTable: {
              location: { index: placeholderIndex },
              rows: numRows,
              columns: numColumns,
            },
          },
        ];

        // Thực thi tạo bảng
        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: { requests: createTableRequests },
        });
        functions.logger.info(
          'Đã xóa placeholder và tạo bảng trống thành công.'
        );

        // 6. ========= POPULATE TABLE WITH DATA (ĐÃ SỬA LỖI) =========
        // Lấy lại tài liệu để có cấu trúc bảng mới nhất và các chỉ số chính xác
        const docWithTable = await docs.documents.get({
          documentId: newDocId,
        });

        // Tìm bảng vừa tạo
        let tableElement: docs_v1.Schema$Table | undefined;
        let tableStartLocation: number | undefined;

        if (docWithTable.data.body?.content) {
          for (const element of docWithTable.data.body.content) {
            // Tìm bảng có startIndex gần với vị trí placeholder ban đầu
            if (
              element.table &&
              element.startIndex &&
              Math.abs(element.startIndex - placeholderIndex) < 10
            ) {
              tableElement = element.table;
              tableStartLocation = element.startIndex;
              functions.logger.info(
                `Đã tìm thấy bảng tại vị trí: ${element.startIndex}`
              );
              break;
            }
          }
        }

        if (!tableElement || !tableElement.tableRows || !tableStartLocation) {
          throw new Error('Không tìm thấy bảng vừa tạo để điền dữ liệu.');
        }

        // *** THÊM MỚI: Định dạng chiều rộng cột ***
        const columnWidths = [
          { index: 0, width: 30 }, // STT
          { index: 1, width: 190 }, // Vật Tư, Hàng Hóa
          { index: 2, width: 60 }, // VL
          { index: 3, width: 40 }, // ĐVT
          { index: 4, width: 30 }, // SL
          { index: 5, width: 70 }, // Đơn giá
          { index: 6, width: 70 }, // Thành Tiền
        ];

        const setWidthRequests: docs_v1.Schema$Request[] = columnWidths.map(
          (col) => ({
            updateTableColumnProperties: {
              tableStartLocation: { index: tableStartLocation },
              columnIndices: [col.index],
              tableColumnProperties: {
                width: { magnitude: col.width, unit: 'PT' },
                widthType: 'FIXED_WIDTH',
              },
              fields: 'width,widthType',
            },
          })
        );

        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: { requests: setWidthRequests },
        });
        functions.logger.info('Đã định dạng chiều rộng các cột thành công.');

        // *** THAY ĐỔI: Chuẩn bị dữ liệu chỉ cho bảng vật tư ***
        const headers = [
          'STT',
          'Vật Tư, Hàng Hóa',
          'VL',
          'ĐVT',
          'SL',
          'Đơn giá',
          'Thành Tiền',
        ];
        const tableData: string[][] = [headers];

        interface SpecialRowInfo {
          rowIndex: number; // index in table (excluding header)
          type: 'accessory' | 'groupHeader';
        }
        const specialRows: SpecialRowInfo[] = [];

        let seqCounter = 1;
        filteredMaterials.forEach((material, idx) => {
          const nameUpper = (material.name || '').trim().toUpperCase();
          const isAccessory = nameUpper.startsWith('PHỤ KIỆN ĐI KÈM');
          // Nhận diện số La Mã (có thể kèm dấu chấm, ví dụ: "I.")
          const romanRegex = /^[IVXLCDM]+\.?$/i;
          const isGroupHeader = romanRegex.test(
            String(material.no || material.stt || '').trim()
          );

          if (isAccessory || isGroupHeader) {
            specialRows.push({
              rowIndex: idx + 1,
              type: isAccessory ? 'accessory' : 'groupHeader',
            });
          }

          // Build row values
          let stt = '';
          if (!isAccessory) {
            if (
              material.no !== undefined &&
              material.no !== null &&
              String(material.no).trim() !== ''
            ) {
              stt = String(material.no).trim();
            } else if (
              material.stt !== undefined &&
              material.stt !== null &&
              String(material.stt).trim() !== ''
            ) {
              stt = String(material.stt).trim();
            } else {
              stt = String(seqCounter);
            }
            seqCounter++;
          }
          const quantity =
            isAccessory || isGroupHeader
              ? ''
              : material.quantity
              ? String(material.quantity)
              : '';
          const unitPrice =
            isAccessory || isGroupHeader
              ? ''
              : material.unitPrice
              ? Math.floor(Number(material.unitPrice)).toLocaleString('vi-VN')
              : '';
          const totalPrice =
            isAccessory || isGroupHeader
              ? ''
              : material.totalPrice
              ? Math.floor(Number(material.totalPrice)).toLocaleString('vi-VN')
              : '';

          tableData.push([
            stt,
            material.name || '',
            material.material || '',
            material.unit || '',
            quantity,
            unitPrice,
            totalPrice,
          ]);
        });

        functions.logger.info(
          `Đã chuẩn bị dữ liệu cho ${tableData.length} hàng`
        );

        const dataFillRequests: docs_v1.Schema$Request[] = [];

        // Thiết lập font chữ Times New Roman, màu đen, cỡ 12 cho toàn bộ bảng
        if (tableStartLocation) {
          // Thay vì thiết lập font cho toàn bộ bảng với một lệnh, chúng ta sẽ thiết lập font cho từng ô khi chèn dữ liệu
          functions.logger.info(
            'Sẽ thiết lập font chữ cho từng ô khi chèn dữ liệu'
          );
        }

        // *** LẶP NGƯỢC TỪ CUỐI LÊN ĐẦU ***
        for (let r = tableData.length - 1; r >= 0; r--) {
          const rowData = tableData[r];
          for (let c = rowData.length - 1; c >= 0; c--) {
            const cellData = rowData[c];
            if (!cellData) continue; // Bỏ qua ô trống

            const cell = tableElement.tableRows[r]?.tableCells?.[c];
            if (!cell?.content?.[0]?.paragraph?.elements?.[0]?.startIndex) {
              functions.logger.warn(`Không tìm thấy vị trí cho ô [${r}, ${c}]`);
              continue;
            }

            const cellStartIndex =
              cell.content[0].paragraph.elements[0].startIndex;
            functions.logger.info(
              `Điền "${cellData}" vào ô [${r}, ${c}] tại vị trí ${cellStartIndex}`
            );

            // 1. Thêm yêu cầu chèn văn bản
            dataFillRequests.push({
              insertText: {
                location: { index: cellStartIndex },
                text: cellData,
              },
            });

            // 2. Thêm yêu cầu định dạng
            const textRange = {
              startIndex: cellStartIndex,
              endIndex: cellStartIndex + cellData.length,
            };

            // Thiết lập font chữ Times New Roman, màu đen, cỡ 12 cho từng ô
            dataFillRequests.push({
              updateTextStyle: {
                range: textRange,
                textStyle: {
                  weightedFontFamily: { fontFamily: 'Times New Roman' },
                  fontSize: { magnitude: 12, unit: 'PT' },
                  foregroundColor: {
                    color: {
                      rgbColor: { red: 0, green: 0, blue: 0 },
                    },
                  },
                },
                fields: 'weightedFontFamily,fontSize,foregroundColor',
              },
            });

            // In đậm cho hàng tiêu đề và các hàng tổng cộng
            // In đậm cho hàng tiêu đề và các hàng tổng cộng
            // Chỉ in đậm cho hàng tiêu đề
            if (r === 0) {
              // <--- ĐÃ SỬA
              dataFillRequests.push({
                updateTextStyle: {
                  range: textRange,
                  textStyle: { bold: true },
                  fields: 'bold',
                },
              });
            }

            // Căn giữa cho tất cả các ô (theo yêu cầu)
            dataFillRequests.push({
              updateParagraphStyle: {
                range: textRange,
                paragraphStyle: { alignment: 'CENTER' },
                fields: 'alignment',
              },
            });

            // Căn giữa theo chiều dọc
            dataFillRequests.push({
              updateTableCellStyle: {
                tableRange: {
                  tableCellLocation: {
                    tableStartLocation: { index: tableStartLocation || 0 },
                    rowIndex: r,
                    columnIndex: c,
                  },
                  rowSpan: 1,
                  columnSpan: 1,
                },
                tableCellStyle: {
                  contentAlignment: 'MIDDLE',
                },
                fields: 'contentAlignment',
              },
            });
          }
        }

        // ===== TÔ MÀU NỀN CHO HÀNG ĐẶC BIỆT =====
        specialRows.forEach((rowInfo) => {
          const bgColor =
            rowInfo.type === 'accessory'
              ? { red: 1, green: 0.93, blue: 0.8 } // light peach for accessories
              : { red: 0.9, green: 0.9, blue: 0.9 }; // grey for group headers

          dataFillRequests.push({
            updateTableCellStyle: {
              tableRange: {
                tableCellLocation: {
                  tableStartLocation: { index: tableStartLocation || 0 },
                  rowIndex: rowInfo.rowIndex,
                  columnIndex: 0,
                },
                rowSpan: 1,
                columnSpan: numColumns,
              },
              tableCellStyle: {
                backgroundColor: { color: { rgbColor: bgColor } },
              },
              fields: 'backgroundColor',
            },
          });
        });

        // Định dạng màu nền và viền cho bảng
        if (tableStartLocation) {
          // Màu nền cho hàng tiêu đề
          dataFillRequests.push({
            updateTableCellStyle: {
              tableRange: {
                tableCellLocation: {
                  tableStartLocation: { index: tableStartLocation },
                  rowIndex: 0,
                  columnIndex: 0,
                },
                rowSpan: 1,
                columnSpan: numColumns,
              },
              tableCellStyle: {
                backgroundColor: {
                  // Màu xanh nhạt giống trong template
                  color: {
                    rgbColor: { red: 0.737, green: 0.867, blue: 0.898 },
                  },
                },
              },
              fields: 'backgroundColor',
            },
          });

          // Viền cho toàn bộ bảng
          dataFillRequests.push({
            updateTableCellStyle: {
              tableRange: {
                tableCellLocation: {
                  tableStartLocation: { index: tableStartLocation },
                  rowIndex: 0,
                  columnIndex: 0,
                },
                rowSpan: numRows,
                columnSpan: numColumns,
              },
              tableCellStyle: {
                borderBottom: {
                  color: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
                  width: { magnitude: 1, unit: 'PT' },
                  dashStyle: 'SOLID',
                },
                borderTop: {
                  color: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
                  width: { magnitude: 1, unit: 'PT' },
                  dashStyle: 'SOLID',
                },
                borderLeft: {
                  color: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
                  width: { magnitude: 1, unit: 'PT' },
                  dashStyle: 'SOLID',
                },
                borderRight: {
                  color: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
                  width: { magnitude: 1, unit: 'PT' },
                  dashStyle: 'SOLID',
                },
              },
              fields: 'borderBottom,borderTop,borderLeft,borderRight',
            },
          });
        }

        // Thực thi tất cả các yêu cầu điền và định dạng dữ liệu
        if (dataFillRequests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: { requests: dataFillRequests },
          });
          functions.logger.info(
            `Đã điền và định dạng dữ liệu cho ${tableData.length} hàng.`
          );
        }

        // 7. ========= INSERT SUMMARY SECTION (BẢNG TỔNG KẾT) =========
        // Lấy lại tài liệu để xác định vị trí cuối của bảng vật tư
        const docWithTableFilled = await docs.documents.get({
          documentId: newDocId,
        });

        let tableEndIndex: number | undefined;
        if (docWithTableFilled.data.body?.content) {
          for (const element of docWithTableFilled.data.body.content) {
            if (
              element.table &&
              element.startIndex &&
              element.endIndex &&
              Math.abs(element.startIndex - (tableStartLocation || 0)) < 10
            ) {
              tableEndIndex = element.endIndex;
              functions.logger.info(
                `Tìm thấy vị trí kết thúc của bảng vật tư: ${tableEndIndex}`
              );
              break;
            }
          }
        }

        if (!tableEndIndex) {
          throw new Error('Không tìm thấy vị trí kết thúc bảng vật tư');
        }

        // Tính toán giá trị tổng kết - tự tính toán mọi giá trị, không dùng giá trị từ input
        // Hardcode VAT rate là 10%
        const vatPercentage = 10;

        // Tính tổng tiền hàng từ danh sách vật tư
        let subTotal = 0;
        filteredMaterials.forEach((material) => {
          // Tính lại đơn giá và thành tiền để đảm bảo tính đúng
          const weight = Number(material.weight || 0);
          const unitPricePerKg = Number(material.unitPrice || 0);
          const calculatedUnitPrice = weight * unitPricePerKg;
          const quantity = Number(material.quantity || 0);
          const totalPrice = quantity * calculatedUnitPrice;
          subTotal += totalPrice;
        });

        // Tính thuế VAT và tổng tiền thanh toán
        const vatAmount = (subTotal * vatPercentage) / 100;
        const grandTotal = subTotal + vatAmount;

        // Tính half_total SAU KHI đã tính toán xong grandTotal
        const halfTotal = Math.floor(grandTotal * 0.5);
        // Tạo chuỗi half_total chỉ sau khi biết chắc chắn halfTotal là số hợp lệ
        const halfTotalFormatted = halfTotal.toLocaleString('vi-VN');
        const halfTotalText = `${halfTotalFormatted} đ (${convertNumberToVnWords(
          halfTotal
        )})`;

        // Thực hiện thay thế half_total trong văn bản
        const halfTotalRequests: docs_v1.Schema$Request[] = [
          {
            replaceAllText: {
              containsText: { text: '{half_total}', matchCase: false },
              replaceText: halfTotalText,
            },
          },
        ];

        // Áp dụng thay thế half_total
        if (halfTotalRequests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: { requests: halfTotalRequests },
          });
          functions.logger.info('Đã thay thế half_total thành công.');
        }

        // Tự tạo chuỗi "bằng chữ" từ tổng tiền đã tính (bỏ phần thập phân)
        const amountInWords = convertNumberToVnWords(Math.floor(grandTotal));

        // Tạo bảng tổng kết (2 cột, 4 hàng)
        const summaryTableRequests: docs_v1.Schema$Request[] = [
          {
            insertTable: {
              location: { index: tableEndIndex },
              rows: 4,
              columns: 2,
            },
          },
        ];

        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: { requests: summaryTableRequests },
        });
        functions.logger.info('Đã tạo bảng tổng kết sau bảng vật tư');

        // Lấy lại tài liệu để định vị bảng tổng kết vừa tạo
        const docWithSummaryTable = await docs.documents.get({
          documentId: newDocId,
        });

        let summaryTable: docs_v1.Schema$Table | undefined;
        let summaryTableStartIndex: number | undefined;

        if (docWithSummaryTable.data.body?.content) {
          for (const element of docWithSummaryTable.data.body.content) {
            if (
              element.table &&
              element.startIndex &&
              element.startIndex > (tableEndIndex || 0) - 5
            ) {
              // Lấy bảng đầu tiên sau bảng vật tư
              summaryTable = element.table;
              summaryTableStartIndex = element.startIndex;
              functions.logger.info(
                `Tìm thấy bảng tổng kết tại vị trí: ${element.startIndex}`
              );
              break;
            }
          }
        }

        if (!summaryTable || !summaryTableStartIndex) {
          throw new Error('Không tìm thấy bảng tổng kết sau khi tạo');
        }

        // Chuẩn bị dữ liệu cho bảng tổng kết
        const summaryData = [
          [
            'CỘNG TIỀN HÀNG:',
            Math.floor(subTotal).toLocaleString('vi-VN') + ' đ',
          ],
          [
            `THUẾ GTGT ${vatPercentage}%:`,
            Math.floor(vatAmount).toLocaleString('vi-VN') + ' đ',
          ],
          [
            'TỔNG TIỀN THANH TOÁN:',
            Math.floor(grandTotal).toLocaleString('vi-VN') + ' đ',
          ],
          [amountInWords], // Chỉ chứa một phần tử để gộp ô
        ];

        // Tạo các yêu cầu để điền dữ liệu và định dạng bảng tổng kết
        const summaryFillRequests: docs_v1.Schema$Request[] = [];

        // Lặp ngược để điền dữ liệu từ cuối lên đầu (tránh lỗi vị trí)
        for (let r = summaryData.length - 1; r >= 0; r--) {
          for (let c = summaryData[r].length - 1; c >= 0; c--) {
            const cellData = summaryData[r][c];
            if (!cellData) continue;

            const cell = summaryTable.tableRows?.[r]?.tableCells?.[c];
            if (!cell?.content?.[0]?.paragraph?.elements?.[0]?.startIndex) {
              functions.logger.warn(
                `Không tìm thấy vị trí cho ô tổng kết [${r}, ${c}]`
              );
              continue;
            }

            const cellStartIndex =
              cell.content[0].paragraph.elements[0].startIndex;
            functions.logger.info(
              `Điền dữ liệu "${cellData}" vào ô tổng kết [${r}, ${c}] tại vị trí ${cellStartIndex}`
            );

            // Chèn văn bản
            summaryFillRequests.push({
              insertText: {
                location: { index: cellStartIndex },
                text: cellData,
              },
            });

            const textRange = {
              startIndex: cellStartIndex,
              endIndex: cellStartIndex + cellData.length,
            };

            // Định dạng font, màu sắc và in đậm
            summaryFillRequests.push({
              updateTextStyle: {
                range: textRange,
                textStyle: {
                  weightedFontFamily: { fontFamily: 'Times New Roman' },
                  fontSize: { magnitude: 12, unit: 'PT' },
                  bold: r < 3, // Chỉ in đậm 3 dòng đầu tiên (0, 1, 2), không in đậm dòng "Bằng chữ:" (3)
                  foregroundColor: {
                    color: {
                      rgbColor: { red: 0, green: 0, blue: 0 },
                    },
                  },
                },
                fields: 'weightedFontFamily,fontSize,bold,foregroundColor',
              },
            });

            // Căn lề
            let alignment: 'END' | 'START' = 'START';
            if (c === 1) {
              // Cột giá trị căn phải
              alignment = 'END';
            }
            // Dòng "Bằng chữ" căn trái
            if (r === 3) {
              alignment = 'START';
            }

            summaryFillRequests.push({
              updateParagraphStyle: {
                range: textRange,
                paragraphStyle: { alignment: alignment },
                fields: 'alignment',
              },
            });
          }
        }

        // Gộp ô cho dòng "Bằng chữ"
        summaryFillRequests.push({
          mergeTableCells: {
            tableRange: {
              tableCellLocation: {
                tableStartLocation: { index: summaryTableStartIndex },
                rowIndex: 3, // Hàng cuối cùng (bằng chữ)
                columnIndex: 0,
              },
              rowSpan: 1,
              columnSpan: 2,
            },
          },
        });

        // Xóa viền của bảng tổng kết để nó hòa vào văn bản
        summaryFillRequests.push({
          updateTableCellStyle: {
            tableRange: {
              tableCellLocation: {
                tableStartLocation: { index: summaryTableStartIndex },
                rowIndex: 0,
                columnIndex: 0,
              },
              rowSpan: 4,
              columnSpan: 2,
            },
            tableCellStyle: {
              borderBottom: {
                width: { magnitude: 0, unit: 'PT' },
                dashStyle: 'SOLID',
                color: { color: { rgbColor: {} } },
              },
              borderTop: {
                width: { magnitude: 0, unit: 'PT' },
                dashStyle: 'SOLID',
                color: { color: { rgbColor: {} } },
              },
              borderLeft: {
                width: { magnitude: 0, unit: 'PT' },
                dashStyle: 'SOLID',
                color: { color: { rgbColor: {} } },
              },
              borderRight: {
                width: { magnitude: 0, unit: 'PT' },
                dashStyle: 'SOLID',
                color: { color: { rgbColor: {} } },
              },
            },
            fields: 'borderBottom,borderTop,borderLeft,borderRight',
          },
        });

        // Thực thi các yêu cầu điền và định dạng cho bảng tổng kết
        if (summaryFillRequests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: { requests: summaryFillRequests },
          });
          functions.logger.info(
            'Đã điền và định dạng bảng tổng kết thành công'
          );
        }
      }

      // 8. ========= RETURN DOCX INFO =========
      // Cấp quyền xem cho Google Doc để người dùng có link có thể xem
      await drive.permissions.create({
        fileId: newDocId,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      const docUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
      functions.logger.info(`Tạo hợp đồng thành công. Doc URL: ${docUrl}`);

      // Trả về URL của Google Doc và ID
      return {
        docUrl,
        docId: newDocId,
      };
    } catch (error) {
      functions.logger.error('Lỗi nghiêm trọng khi tạo hợp đồng:', error);
      if (error instanceof Error) {
        throw new functions.https.HttpsError(
          'internal',
          `Không thể tạo hợp đồng: ${error.message}`
        );
      }
      throw new functions.https.HttpsError(
        'internal',
        'Đã xảy ra lỗi không xác định khi tạo hợp đồng.'
      );
    }
  });
