import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();
const SECRET_TOKEN = 'THP_FINANCE_SECRET_TOKEN'; // Should match Apps Script token

// Function to format currency for display
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

// Column mapping for Excel file
const colMap = {
  date: 0, // A - Ngày CT
  docNumber: 1, // B - BB SỐ
  invoiceNumber: 2, // C - Hóa đơn
  supplier: 3, // D - TÊN ĐƠN VỊ
  description: 4, // E - DIỄN GIẢI
  unit: 5, // F - ĐVT
  quantity: 6, // G - SỐ LƯỢNG
  price: 7, // H - ĐƠN GIÁ
  vat: 8, // I - VAT
  totalAmount: 9, // J - THÀNH TIỀN
  paidAmount: 10, // K - ĐÃ THANH TOÁN
  remainingAmount: 11, // L - CÒN LẠI
};

// Function to convert Excel date serial number to JS Date
function excelDateToJSDate(excelDate: number): Date {
  // Excel's epoch starts on 1/1/1900
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  // Excel incorrectly assumes 1900 is a leap year, so we adjust by 1 day for dates after 2/28/1900
  const dayAdjust = excelDate > 59 ? 1 : 0;
  const jsDate = new Date(
    Math.round((excelDate - dayAdjust - 25569) * millisecondsPerDay)
  );
  return jsDate;
}

// Function to clean text values
function cleanText(text: any): string {
  if (!text) return '';
  return String(text).trim().replace(/\s+/g, ' ');
}

// Function to extract numeric value from cell
function extractNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const numStr = String(value).replace(/[^\d.-]/g, '');
  return numStr ? parseFloat(numStr) : 0;
}

// Function to check if a row is a transaction row
function isTransactionRow(row: any[], currentSupplier: string | null): boolean {
  // Check if date column has a value and we have a current supplier
  return row[colMap.date] && currentSupplier !== null;
}

// Function to check if a row is a supplier header row
function isSupplierRow(row: any[]): boolean {
  const supplierValue = row[colMap.supplier];
  return (
    supplierValue &&
    (String(supplierValue).startsWith('NCC - ') ||
      String(supplierValue).startsWith('KH - '))
  );
}

// Function to check if a row is a total row
function isTotalRow(row: any[]): boolean {
  return row[0] === 'CỘNG';
}

// Function to extract supplier name from cell
function extractSupplierName(cell: any): string {
  if (!cell) return '';
  const text = String(cell);
  if (text.startsWith('NCC - ')) {
    return text.substring(6).trim();
  } else if (text.startsWith('KH - ')) {
    return text.substring(5).trim();
  }
  return text.trim();
}

/**
 * Cloud Function to process payable ledger Excel file from Google Drive
 */
export const processPayableLedgerFromDrive = functions.https.onRequest(
  {
    region: 'asia-southeast1',
    timeoutSeconds: 300, // 5 minutes timeout for large files
  },
  async (req, res) => {
    try {
      // Verify authorization token
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${SECRET_TOKEN}`) {
        console.error('Invalid or missing authorization token');
        res.status(401).send({ error: 'Unauthorized' });
        return;
      }

      // Get fileId from request body
      const { fileId } = req.body;
      if (!fileId) {
        console.error('No fileId provided in request body');
        res.status(400).send({ error: 'Missing fileId parameter' });
        return;
      }

      console.log(`Processing file with ID: ${fileId}`);

      // Initialize Google Drive API
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../tanyb-fe4bf-4fbd5c01b6c7.json'),
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      const drive = google.drive({ version: 'v3', auth });

      // Download file from Google Drive
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
        },
        { responseType: 'arraybuffer' }
      );

      // Get file metadata to extract filename
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        fields: 'name,createdTime,modifiedTime',
      });

      const fileName = fileMetadata.data.name || 'Unknown File';
      console.log(`Downloaded file: ${fileName}`);

      // Parse Excel file
      const workbook = XLSX.read(response.data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert to array of arrays
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as any[][];

      console.log(`Total rows in Excel file: ${rows.length}`);

      // Process rows
      const transactions = [];
      let currentSupplier: string | null = null;
      let isPayable = true; // Default to payable (phải trả)

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // Check if this is a header row that indicates the type of ledger
        if (
          row.some(
            (cell) =>
              cell && String(cell).includes('SỔ CHI TIẾT CÔNG NỢ PHẢI THU')
          )
        ) {
          isPayable = false;
          currentSupplier = null;
          continue;
        } else if (
          row.some(
            (cell) =>
              cell && String(cell).includes('SỔ CHI TIẾT CÔNG NỢ PHẢI TRẢ')
          )
        ) {
          isPayable = true;
          currentSupplier = null;
          continue;
        }

        // Check if this is a supplier row
        if (isSupplierRow(row)) {
          currentSupplier = extractSupplierName(row[colMap.supplier]);
          continue;
        }

        // Check if this is a total row
        if (isTotalRow(row)) {
          currentSupplier = null;
          continue;
        }

        // Skip header rows
        if (row[0] === 'Ngày CT' || row[0] === 'Ngày') continue;

        // Process transaction row
        if (isTransactionRow(row, currentSupplier)) {
          let transactionDate: Date;

          // Handle date format (could be Excel serial date or string)
          if (typeof row[colMap.date] === 'number') {
            transactionDate = excelDateToJSDate(row[colMap.date]);
          } else if (typeof row[colMap.date] === 'string') {
            // Try to parse date string (DD/MM/YYYY format)
            const dateParts = String(row[colMap.date]).split('/');
            if (dateParts.length === 3) {
              transactionDate = new Date(
                parseInt(dateParts[2]),
                parseInt(dateParts[1]) - 1,
                parseInt(dateParts[0])
              );
            } else {
              // Default to current date if parsing fails
              transactionDate = new Date();
            }
          } else {
            // Default to current date if no valid date
            transactionDate = new Date();
          }

          const transaction = {
            type: isPayable ? 'payable' : 'receivable',
            supplier: currentSupplier || '',
            transactionDate: Timestamp.fromDate(transactionDate),
            docNumber: cleanText(row[colMap.docNumber]),
            invoiceNumber: cleanText(row[colMap.invoiceNumber]),
            description: cleanText(row[colMap.description]),
            amount: extractNumber(row[colMap.totalAmount]),
            paidAmount: extractNumber(row[colMap.paidAmount]),
            remainingAmount: extractNumber(row[colMap.remainingAmount]),
            unit: cleanText(row[colMap.unit]),
            quantity: extractNumber(row[colMap.quantity]),
            price: extractNumber(row[colMap.price]),
            vat: extractNumber(row[colMap.vat]),
            fileId: fileId,
            fileName: fileName,
            processedAt: Timestamp.now(),
          };

          transactions.push(transaction);
        }
      }

      console.log(`Extracted ${transactions.length} transactions`);

      // Save transactions to Firestore using batch write
      const batch = db.batch();

      for (const transaction of transactions) {
        // Generate a unique ID based on supplier, date, and document number
        const idComponents = [
          transaction.supplier,
          transaction.transactionDate.toDate().toISOString().split('T')[0],
          transaction.docNumber || 'nodoc',
          transaction.description
            ? transaction.description.substring(0, 20)
            : 'nodesc',
        ];
        const uniqueId = idComponents.join('_').replace(/[^a-zA-Z0-9_]/g, '');

        const docRef = db.collection('payable_transactions').doc(uniqueId);
        batch.set(docRef, transaction, { merge: true });
      }

      await batch.commit();
      console.log(
        `Successfully saved ${transactions.length} transactions to Firestore`
      );

      // Update the last processed timestamp in a metadata document
      await db.collection('system').doc('financialProcessorMetadata').set(
        {
          lastProcessedAt: Timestamp.now(),
          lastProcessedFile: fileName,
          lastProcessedFileId: fileId,
          transactionsProcessed: transactions.length,
        },
        { merge: true }
      );

      res.status(200).send({
        success: true,
        message: `Successfully processed ${transactions.length} transactions from ${fileName}`,
      });
    } catch (error: any) {
      console.error('Error processing payable ledger:', error);
      res.status(500).send({
        error: 'Failed to process payable ledger',
        details: error.message,
      });
    }
  }
);

/**
 * Orchestrator function to trigger Excel processing from a folder
 * This is a callable function that can be invoked from the client
 */
export const triggerExcelProcessing = functions.https.onCall(
  {
    region: 'asia-southeast1',
    timeoutSeconds: 300, // 5 phút timeout cho file lớn
  },
  async () => {
    try {
      console.log('triggerExcelProcessing called');

      // Initialize Google Drive API
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../tanyb-fe4bf-4fbd5c01b6c7.json'),
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      const drive = google.drive({ version: 'v3', auth });

      // Define the folder ID where Excel files are stored
      const FOLDER_ID = '1Ci_BHZx0-Uhv2xg5IzwLPn05yPAUXOOU';

      // Search for Excel files in the specified folder
      const response = await drive.files.list({
        q: `'${FOLDER_ID}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false`,
        orderBy: 'modifiedTime desc',
        pageSize: 1, // Get only the latest file
        fields: 'files(id,name,modifiedTime)',
      });

      const files = response.data.files;
      if (!files || files.length === 0) {
        throw new functions.https.HttpsError(
          'not-found',
          'No Excel files found in the specified folder'
        );
      }

      const latestFile = files[0];
      console.log(
        `Found latest file: ${latestFile.name} (ID: ${latestFile.id})`
      );

      // Download file from Google Drive
      const fileResponse = await drive.files.get(
        {
          fileId: latestFile.id!,
          alt: 'media',
        },
        { responseType: 'arraybuffer' }
      );

      console.log(`Downloaded file Excel: ${latestFile.name}`);

      // Parse Excel file
      const workbook = XLSX.read(fileResponse.data, { type: 'buffer' });

      let totalReceivable = 0; // Tổng phải thu
      let totalPayable = 0; // Tổng phải trả

      // Process "PHẢI TRẢ" sheet
      const payableSheetName = findSheetByPattern(workbook, [
        'PHẢI TRẢ',
        'PHAI TRA',
        'PAYABLE',
      ]);
      if (payableSheetName) {
        console.log(`Processing PHẢI TRẢ sheet: ${payableSheetName}`);
        totalPayable = processSheetForTotal(workbook, payableSheetName);
        console.log(`Total PAYABLE: ${totalPayable}`);
      } else {
        console.log('No PHẢI TRẢ sheet found');
      }

      // Process "PHẢI THU" sheet
      const receivableSheetName = findSheetByPattern(workbook, [
        'PHẢI THU',
        'PHAI THU',
        'RECEIVABLE',
      ]);
      if (receivableSheetName) {
        console.log(`Processing PHẢI THU sheet: ${receivableSheetName}`);
        totalReceivable = processSheetForTotal(workbook, receivableSheetName);
        console.log(`Total RECEIVABLE: ${totalReceivable}`);
      } else {
        console.log('No PHẢI THU sheet found');
      }

      // Calculate net position
      const netPosition = totalReceivable - totalPayable;

      // Create summary object
      const summary = {
        totalReceivable,
        totalPayable,
        netPosition,
        lastUpdated: Timestamp.now(),
        fileName: latestFile.name!,
        fileId: latestFile.id!,
        formattedTotals: {
          totalReceivable: formatCurrency(totalReceivable),
          totalPayable: formatCurrency(totalPayable),
          netPosition: formatCurrency(netPosition),
        },
      };

      // Save summary to Firestore
      console.log('Saving data to Firestore...');
      await db
        .collection('summaries')
        .doc('directorDashboard')
        .set(summary, { merge: true });

      // Update metadata
      await db.collection('system').doc('financialProcessorMetadata').set(
        {
          lastProcessedAt: Timestamp.now(),
          lastProcessedFile: latestFile.name,
          lastProcessedFileId: latestFile.id,
          summaryDataProcessed: true,
          totalReceivable,
          totalPayable,
        },
        { merge: true }
      );

      console.log('Excel processing completed successfully!');

      // Return success result
      return {
        success: true,
        message: `Successfully processed data from file ${latestFile.name}`,
        fileName: latestFile.name,
        fileId: latestFile.id,
        summary,
      };
    } catch (error: any) {
      console.error('Error in triggerExcelProcessing:', error);

      // Re-throw HttpsError as-is, convert others to internal error
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        `Failed to process Excel file: ${error.message}`
      );
    }
  }
);

/**
 * Find sheet name based on pattern
 * @param workbook - XLSX workbook
 * @param patterns - Array of patterns to look for
 * @returns Sheet name if found, undefined otherwise
 */
function findSheetByPattern(
  workbook: XLSX.WorkBook,
  patterns: string[]
): string | undefined {
  for (const sheetName of workbook.SheetNames) {
    const normalizedName = sheetName.normalize('NFC').toUpperCase();
    for (const pattern of patterns) {
      if (normalizedName.includes(pattern)) {
        return sheetName;
      }
    }
  }
  return undefined;
}

/**
 * Process a sheet to get total value based on column B = "CỘNG" and get value from column L
 * @param workbook - XLSX workbook
 * @param sheetName - Sheet name to process
 * @returns Total value
 */
function processSheetForTotal(
  workbook: XLSX.WorkBook,
  sheetName: string
): number {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 'A' });

  let total = 0;
  let sums: number[] = [];

  console.log(`Total rows in sheet ${sheetName}: ${data.length}`);

  // Loop through each row to find rows with column B as "CỘNG"
  for (const row of data) {
    // Check if column B (mapped to key 'B') is "CỘNG"
    if (row['B'] === 'CỘNG') {
      // Get value from column L
      const value = parseFloat(row['L'] || 0);
      if (!isNaN(value)) {
        sums.push(value);
        console.log(`Found CỘNG value: ${value}`);
      }
    }
  }

  // Calculate total from all found values
  total = sums.reduce((acc, curr) => acc + curr, 0);
  console.log(`Values found: ${sums.join(', ')}`);
  console.log(`Total: ${total}`);

  return total;
}
