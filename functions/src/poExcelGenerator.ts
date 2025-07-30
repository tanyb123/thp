import * as functions from 'firebase-functions/v1';
import { google, sheets_v4 } from 'googleapis';
import { CallableContext } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';

// Define PO data interface
interface ExcelPurchaseOrderData {
  metadata: {
    projectName?: string;
    supplierName?: string;
    supplierAddress?: string;
    supplierPhone?: string;
    supplierEmail?: string;
    supplierTaxCode?: string;
    supplierContactPerson?: string;
    poNumber?: string;
    proposalNumber?: string;
    poDate?: string;
    deliveryTime?: string;
    paymentTerms?: string;
  };
  materials: {
    no: number;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
    material?: string;
    specs?: string;
  }[];
  summary: {
    subTotal: number;
    vatPercentage: number;
    vatAmount: number;
    grandTotal: number;
  };
}

// ----- CONFIGURATION -----
const TEMPLATE_FILE_ID = '1z0MBboGASBZ8rE68x-_ykMVt4YjFcuTZG9RcVWBcZF0'; // Updated PO template ID
const START_ROW_MATERIALS = 18; // Data starts at row 18 in the new template

// ----- MAIN FUNCTION -----
export const generateExcelPurchaseOrder = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(
    async (
      data: {
        formattedData: ExcelPurchaseOrderData;
        projectId: string;
        accessToken: string;
      },
      context: CallableContext
    ) => {
      // Add detailed logging for debugging
      console.log('PO Generator called with projectId:', data.projectId);
      console.log(
        'Auth context:',
        context.auth ? 'Authenticated' : 'Not authenticated'
      );
      console.log('Access token provided:', data.accessToken ? 'Yes' : 'No');

      // Check if we have the required data
      const { formattedData, projectId, accessToken } = data;

      // Validate required parameters
      if (!formattedData) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid data.'
        );
      }
      if (!projectId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Project ID is required.'
        );
      }

      // Check for accessToken (required for Google API access)
      if (!accessToken) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Google access token is required.'
        );
      }

      console.log(
        'PO Generator: Received valid request for project:',
        projectId
      );

      try {
        // Use the provided access token for Google API authentication
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        const db = admin.firestore();
        const projectDoc = await db.collection('projects').doc(projectId).get();
        const projectData = projectDoc.data();

        if (!projectData || !projectData.driveFolderId) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Project Drive folder information not found.'
          );
        }

        // Find or create 'PO' subfolder in the project folder
        const poFolderResponse = await drive.files.list({
          q: `name='PO' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
        });

        let poFolderId;
        if (
          poFolderResponse.data.files &&
          poFolderResponse.data.files.length > 0
        ) {
          poFolderId = poFolderResponse.data.files[0].id;
        } else {
          const folderResponse = await drive.files.create({
            requestBody: {
              name: 'PO',
              mimeType: 'application/vnd.google-apps.folder',
              parents: [projectData.driveFolderId],
            },
            fields: 'id',
          });
          poFolderId = folderResponse.data.id;
        }

        const newFileName = `Đặt hàng - ${
          formattedData.metadata.supplierName || 'NCC'
        } - ${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`;

        const copiedFileResponse = await drive.files.copy({
          fileId: TEMPLATE_FILE_ID,
          requestBody: { name: newFileName, parents: [poFolderId] },
        });

        const newFileId = copiedFileResponse.data.id;
        if (!newFileId) throw new Error('Cannot copy template file.');

        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: newFileId,
          fields: 'sheets.properties',
        });
        const firstSheet = spreadsheet.data.sheets?.[0];
        const sheetId = firstSheet?.properties?.sheetId;
        if (sheetId === undefined || sheetId === null) {
          throw new Error('Cannot determine sheetId of the first sheet');
        }

        const requests: sheets_v4.Schema$Request[] = [];

        // ---- NEW METADATA MAPPING TO MATCH THE TEMPLATE ----
        const poDate = new Date();
        const dateString = `HCM, Ngày ${poDate.getDate()} tháng ${
          poDate.getMonth() + 1
        } năm ${poDate.getFullYear()}`;

        // Helper to create update requests
        const createCellUpdateRequest = (
          value: any,
          rowIndex: number,
          columnIndex: number
        ) => ({
          updateCells: {
            rows: [
              {
                values: [{ userEnteredValue: { stringValue: String(value) } }],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex, columnIndex },
          },
        });

        // Project and Date
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.projectName || '',
            1,
            9 // Column J (index 9) for cell J2
          )
        );
        requests.push(createCellUpdateRequest(dateString, 5, 4)); // E6

        // Supplier Info - Updated to write to the correct cells
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.supplierName || '',
            8,
            3
          )
        ); // D9

        // Merge cells for supplier name D9:F10
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 8,
              endRowIndex: 10,
              startColumnIndex: 3,
              endColumnIndex: 6,
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // Address in D11:F11
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.supplierAddress || '',
            10,
            3
          )
        ); // D11

        // Merge cells for address D11:F11
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 10,
              endRowIndex: 11,
              startColumnIndex: 3,
              endColumnIndex: 6,
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // Tax code in D12:F12
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.supplierTaxCode || '',
            11,
            3
          )
        ); // D12

        // Merge cells for tax code D12:F12
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 11,
              endRowIndex: 12,
              startColumnIndex: 3,
              endColumnIndex: 6,
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // Contact person in D13:F13
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.supplierContactPerson || '',
            12,
            3
          )
        ); // D13

        // Merge cells for contact person D13:F13
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 12,
              endRowIndex: 13,
              startColumnIndex: 3,
              endColumnIndex: 6,
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // Email stays in original location
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.supplierEmail || '',
            13,
            2
          )
        ); // C14

        // Phone in D15:F15
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.supplierPhone || '',
            14,
            3
          )
        ); // D15

        // Merge cells for phone D15:F15
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 14,
              endRowIndex: 15,
              startColumnIndex: 3,
              endColumnIndex: 6,
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // PO Info - I9
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: formattedData.metadata.poNumber || '',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 8, columnIndex: 8 }, // I9
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 8,
              endRowIndex: 9,
              startColumnIndex: 8, // I
              endColumnIndex: 10, // J
            }, // I9:J9
            mergeType: 'MERGE_ALL',
          },
        });

        // Proposal Number - I10
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: formattedData.metadata.proposalNumber || '',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
            start: { sheetId, rowIndex: 9, columnIndex: 8 }, // I10
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 9,
              endRowIndex: 10,
              startColumnIndex: 8, // I
              endColumnIndex: 10, // J
            }, // I10:J10
            mergeType: 'MERGE_ALL',
          },
        });

        // Delivery time moved to I12
        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.deliveryTime || '',
            11,
            8
          )
        ); // I12
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 11,
              endRowIndex: 12,
              startColumnIndex: 8,
              endColumnIndex: 10,
            }, // I12:J12
            mergeType: 'MERGE_ALL',
          },
        });

        requests.push(
          createCellUpdateRequest(
            formattedData.metadata.paymentTerms || '',
            12,
            9
          )
        ); // J13

        // ---- MATERIALS TABLE ----
        // Add table header for materials - starting from column C (index 2)
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: 'STT' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                  {
                    userEnteredValue: { stringValue: 'Mô Tả Hàng Hóa' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                  {
                    userEnteredValue: { stringValue: 'Yêu Cầu Kỹ Thuật' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                  {
                    userEnteredValue: { stringValue: 'ĐVT' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                  {
                    userEnteredValue: { stringValue: 'Số Lượng' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                  {
                    userEnteredValue: { stringValue: 'Đơn giá (VND)' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                  {
                    userEnteredValue: { stringValue: 'Thành Tiền (VND)' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                  {
                    userEnteredValue: { stringValue: 'Ghi chú' },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      borders: {
                        top: { style: 'SOLID' },
                        bottom: { style: 'SOLID' },
                        left: { style: 'SOLID' },
                        right: { style: 'SOLID' },
                      },
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: {
              sheetId,
              rowIndex: START_ROW_MATERIALS - 2,
              columnIndex: 2,
            },
          },
        });

        const materialRows = formattedData.materials.map((material) => ({
          values: [
            {
              userEnteredValue: { numberValue: material.no },
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            {
              // Description
              userEnteredValue: { stringValue: material.name },
              userEnteredFormat: {
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            {
              // Technical spec
              userEnteredValue: { stringValue: material.specs || '' },
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            {
              // Unit
              userEnteredValue: { stringValue: material.unit },
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            {
              // Quantity
              userEnteredValue: { numberValue: material.quantity },
              userEnteredFormat: {
                horizontalAlignment: 'RIGHT',
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            {
              // Unit price
              userEnteredValue: { numberValue: material.unitPrice },
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                horizontalAlignment: 'RIGHT',
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            {
              // Total
              userEnteredValue: { numberValue: material.total },
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                horizontalAlignment: 'RIGHT',
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
            {
              // Note column blank
              userEnteredValue: { stringValue: '' },
              userEnteredFormat: {
                borders: {
                  top: { style: 'SOLID' },
                  bottom: { style: 'SOLID' },
                  left: { style: 'SOLID' },
                  right: { style: 'SOLID' },
                },
              },
            },
          ],
        }));

        if (materialRows.length > 0) {
          requests.push({
            insertDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: START_ROW_MATERIALS - 1,
                endIndex: START_ROW_MATERIALS - 1 + materialRows.length,
              },
              inheritFromBefore: true,
            },
          });
          requests.push({
            updateCells: {
              rows: materialRows,
              fields: 'userEnteredValue,userEnteredFormat',
              start: {
                sheetId,
                rowIndex: START_ROW_MATERIALS - 1,
                columnIndex: 2,
              },
            },
          });
        }

        // ---- SUMMARY SECTION ----
        const summaryStartRow =
          START_ROW_MATERIALS + formattedData.materials.length + 3; // Add some spacing
        const createSummaryRow = (
          label: string,
          value: number | null,
          isBold: boolean,
          rowOffset: number
        ) => {
          // 1. Write Label to Column B
          requests.push({
            updateCells: {
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { stringValue: label },
                      userEnteredFormat: {
                        textFormat: { bold: isBold },
                        horizontalAlignment: 'RIGHT',
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                  ],
                },
              ],
              fields: 'userEnteredValue,userEnteredFormat',
              start: {
                sheetId,
                rowIndex: summaryStartRow + rowOffset,
                columnIndex: 1, // Column B
              },
            },
          });

          // 2. Write Value to Column I
          if (value !== null) {
            requests.push({
              updateCells: {
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: { numberValue: value },
                        userEnteredFormat: {
                          numberFormat: { type: 'NUMBER', pattern: '#,##0' },
                          textFormat: { bold: isBold },
                          horizontalAlignment: 'RIGHT',
                          verticalAlignment: 'MIDDLE',
                        },
                      },
                    ],
                  },
                ],
                fields: 'userEnteredValue,userEnteredFormat',
                start: {
                  sheetId,
                  rowIndex: summaryStartRow + rowOffset,
                  columnIndex: 8, // Column I
                },
              },
            });
          }

          // 3. Merge label cells (B to H)
          requests.push({
            mergeCells: {
              range: {
                sheetId,
                startRowIndex: summaryStartRow + rowOffset,
                endRowIndex: summaryStartRow + rowOffset + 1,
                startColumnIndex: 1, // Column B
                endColumnIndex: 8, // Column H
              },
              mergeType: 'MERGE_ALL',
            },
          });

          // 4. Merge value cells (I to J)
          requests.push({
            mergeCells: {
              range: {
                sheetId,
                startRowIndex: summaryStartRow + rowOffset,
                endRowIndex: summaryStartRow + rowOffset + 1,
                startColumnIndex: 8, // Column I
                endColumnIndex: 10, // Column J
              },
              mergeType: 'MERGE_ALL',
            },
          });
        };

        createSummaryRow(
          'Tổng Số Tiền Chưa Bao Gồm thuế GTGT (VAT)',
          formattedData.summary.subTotal,
          false,
          0
        );
        createSummaryRow(
          `Thuế VAT ${formattedData.summary.vatPercentage}%`,
          formattedData.summary.vatAmount,
          false,
          1
        );
        createSummaryRow(
          'Tổng Số Tiền Bao Gồm thuế GTGT (VAT)',
          formattedData.summary.grandTotal,
          true,
          2
        );

        // Amount in words row (merge B:J)
        const amountInWordsRow = summaryStartRow + 3;
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: `(Bằng chữ: ${convertNumberToVnWords(
                        formattedData.summary.grandTotal
                      )})`,
                    },
                    userEnteredFormat: {
                      textFormat: { bold: true, italic: true },
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: amountInWordsRow, columnIndex: 1 },
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: amountInWordsRow,
              endRowIndex: amountInWordsRow + 2, // Span 2 rows
              startColumnIndex: 1,
              endColumnIndex: 10,
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // ---- TERMS AND CONDITIONS SECTION ----
        const termsStartRow = amountInWordsRow + 3;
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: '* ĐIỀU KHOẢN VÀ YÊU CẦU BỔ SUNG:',
                    },
                    userEnteredFormat: { textFormat: { bold: true } },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: termsStartRow, columnIndex: 1 },
          },
        });
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: termsStartRow,
              endRowIndex: termsStartRow + 1,
              startColumnIndex: 1,
              endColumnIndex: 10,
            },
            mergeType: 'MERGE_ALL',
          },
        });

        const termsConditions = [
          {
            no: 1,
            text: 'Đơn giá không bao gồm phí vận chuyển theo địa chỉ giao hàng đề cập trong Đơn Đặt Hàng này.',
          },
          {
            no: 2,
            text: 'Nhà cung cấp chuẩn bị và kí biên bản giao nhận, cùng với Đơn đặt hàng này khi giao hàng.',
          },
          {
            no: 3,
            text: 'Tất cả hàng hóa mới 100%. Nhà cung cấp phải trình chứng chỉ chất lượng và xuất xứ (copy) khi được yêu cầu',
          },
        ];

        termsConditions.forEach((term, idx) => {
          requests.push({
            updateCells: {
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { numberValue: term.no },
                      userEnteredFormat: {
                        textFormat: { bold: true },
                        horizontalAlignment: 'CENTER',
                      },
                    },
                    {
                      userEnteredValue: { stringValue: term.text },
                      userEnteredFormat: {
                        textFormat: {
                          foregroundColor: { red: 1, green: 0, blue: 0 },
                        },
                        horizontalAlignment: 'LEFT',
                      },
                    },
                  ],
                },
              ],
              fields: 'userEnteredValue,userEnteredFormat',
              start: {
                sheetId,
                rowIndex: termsStartRow + 1 + idx,
                columnIndex: 1,
              },
            },
          });
          requests.push({
            mergeCells: {
              range: {
                sheetId,
                startRowIndex: termsStartRow + 1 + idx,
                endRowIndex: termsStartRow + 2 + idx,
                startColumnIndex: 2,
                endColumnIndex: 10,
              },
              mergeType: 'MERGE_ALL',
            },
          });
        });

        // Add space between terms and signatures
        const signatureStartRow = termsStartRow + termsConditions.length + 3;

        // ---- SIGNATURES SECTION (CORRECT & ROBUST IMPLEMENTATION) ----

        // --- BÊN MUA HÀNG (BÊN A) ---
        // 1. Ghi chữ "Đại diện bên Mua hàng (Bên A)" vào cột B
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: 'Đại diện bên Mua hàng (Bên A)',
                    },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: signatureStartRow, columnIndex: 1 }, // Cột B
          },
        });

        // 2. Gộp ô cho Bên A (B đến F)
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: signatureStartRow,
              endRowIndex: signatureStartRow + 1,
              startColumnIndex: 1, // Từ Cột B
              endColumnIndex: 6, // Đến Cột F
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // --- BÊN BÁN HÀNG (BÊN B) ---
        // 3. Ghi chữ "Đại diện bên Bán hàng (Bên B)" vào cột G
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue: 'Đại diện bên Bán hàng (Bên B)',
                    },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: signatureStartRow, columnIndex: 6 }, // Cột G
          },
        });

        // 4. Gộp ô cho Bên B (G đến K)
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: signatureStartRow,
              endRowIndex: signatureStartRow + 1,
              startColumnIndex: 6, // Từ Cột G
              endColumnIndex: 11, // Đến Cột K
            },
            mergeType: 'MERGE_ALL',
          },
        });

        // Add empty space for signatures (about 7 rows)
        for (let i = 0; i < 7; i++) {
          requests.push({
            updateCells: {
              rows: [{ values: [{ userEnteredValue: { stringValue: '' } }] }],
              fields: 'userEnteredValue',
              start: {
                sheetId,
                rowIndex: signatureStartRow + 1 + i,
                columnIndex: 0,
              },
            },
          });
        }

        // Apply all updates to the spreadsheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: newFileId,
          requestBody: { requests },
        });

        // Set permissions to make the file accessible
        await drive.permissions.create({
          fileId: newFileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });

        // ----- SAVE PO METADATA TO FIRESTORE -----
        await admin
          .firestore()
          .collection('purchase_orders')
          .add({
            projectId,
            supplierName: formattedData.metadata.supplierName || '',
            poNumber: formattedData.metadata.poNumber || '',
            deliveryTime: formattedData.metadata.deliveryTime || '',
            fileId: newFileId,
            fileUrl: `https://docs.google.com/spreadsheets/d/${newFileId}/edit`,
            status: 'created',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            formattedData,
          });

        return {
          success: true,
          fileId: newFileId,
          fileUrl: `https://docs.google.com/spreadsheets/d/${newFileId}/edit`,
          message: 'Purchase Order generated successfully',
        };
      } catch (error) {
        console.error('Error details in generateExcelPurchaseOrder:', error);
        throw new functions.https.HttpsError(
          'internal',
          'Error creating purchase order. Check logs for details.',
          error
        );
      }
    }
  );

// ----- HELPER FUNCTIONS -----
function convertNumberToVnWords(n: number): string {
  const t = [
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
  const r = (num: number): string => {
    if (num === 0) return '';
    if (num < 10) return t[num];
    if (num < 100) {
      return (
        t[Math.floor(num / 10)] +
        ' mươi ' +
        (num % 10 === 1
          ? 'mốt'
          : num % 10 === 5
          ? 'lăm'
          : num % 10 !== 0
          ? t[num % 10]
          : '')
      );
    }
    if (num < 1000) {
      return (
        t[Math.floor(num / 100)] +
        ' trăm ' +
        (num % 100 < 10 && num % 100 > 0 ? 'lẻ ' + t[num % 100] : r(num % 100))
      );
    }
    if (num < 1000000) {
      return (
        r(Math.floor(num / 1000)) +
        ' nghìn ' +
        (num % 1000 < 100 && num % 1000 > 0
          ? 'không trăm ' + r(num % 1000)
          : r(num % 1000))
      );
    }
    if (num < 1000000000) {
      return (
        r(Math.floor(num / 1000000)) +
        ' triệu ' +
        (num % 1000000 === 0 ? '' : r(num % 1000000))
      );
    }
    return (
      r(Math.floor(num / 1000000000)) +
      ' tỷ ' +
      (num % 1000000000 === 0 ? '' : r(num % 1000000000))
    );
  };

  return r(Math.floor(n)) + ' đồng';
}
