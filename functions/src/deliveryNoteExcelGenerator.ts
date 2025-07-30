import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as XlsxPopulate from 'xlsx-populate';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { google } from 'googleapis';
import { CallableContext } from 'firebase-functions/v1/https';

// Ensure admin is initialized only once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
// const storage = admin.storage();
// const bucket = storage.bucket();

interface DeliveryNoteItem {
  no: number;
  name: string; // Vật Tư, Hàng Hóa
  material: string; // Vật liệu
  unit: string; // ĐVT
  quantity: number; // Số lượng
}

interface ExcelDeliveryNoteData {
  metadata: {
    deliveryNoteNumber: string;
    deliveryDate: string;
    customerName: string;
    customerTaxCode: string;
    customerAddress: string;
    customerRepresentative: string;
    customerRepresentativePosition: string;
  };
  items: DeliveryNoteItem[];
}

async function generateDeliveryNoteExcelFile(
  formattedData: ExcelDeliveryNoteData
): Promise<Buffer> {
  const workbook = await XlsxPopulate.fromBlankAsync();
  const sheet = workbook.sheet(0).name('BienBanGiaoHang');

  // Set default font for a large range of the sheet
  sheet.range('A1:L100').style({
    fontFamily: 'Times New Roman',
    fontSize: 13,
  });

  // Set column widths
  sheet.column('A').width(5);
  sheet.column('B').width(10);
  sheet.column('C').width(15);
  sheet.column('D').width(20);
  sheet.column('E').width(15);
  sheet.column('F').width(10); // STT
  sheet.column('G').width(55); // Vật tư, hàng hóa - increased from 40 to 55
  sheet.column('H').width(20); // Vật liệu
  sheet.column('I').width(10); // ĐVT - decreased from 15 to 10
  sheet.column('J').width(10); // Số lượng - decreased from 15 to 10
  sheet.column('K').width(15);

  // --- HEADER SECTION ---
  sheet
    .range('F1:G1')
    .merged(true)
    .value('CÔNG TY TNHH SX CK TM DV')
    .style({ bold: true, horizontalAlignment: 'center' });
  sheet
    .range('F2:G2')
    .merged(true)
    .value('TÂN HÒA PHÁT')
    .style({ bold: true, horizontalAlignment: 'center' });
  sheet
    .range('F3:G3')
    .merged(true)
    .value([['Số:'], [`/BBGH ${formattedData.metadata.deliveryNoteNumber}`]]);

  sheet
    .range('I1:K1')
    .merged(true)
    .value('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')
    .style({ bold: true, horizontalAlignment: 'center' });
  sheet
    .range('I2:K2')
    .merged(true)
    .value('Độc lập – Tự do – Hạnh phúc')
    .style({ bold: true, horizontalAlignment: 'center', underline: true });
  sheet
    .range('I4:K4')
    .merged(true)
    .value(`TPHCM, ${formattedData.metadata.deliveryDate}`)
    .style({ italic: true, horizontalAlignment: 'center' });

  sheet
    .range('F6:J6')
    .merged(true)
    .value('BIÊN BẢN GIAO HÀNG')
    .style({ bold: true, fontSize: 16, horizontalAlignment: 'center' });

  // --- INFO SECTION ---
  sheet
    .cell('F9')
    .value('Hôm nay, tại Xưởng Tân Hòa Phát, đại diện 2 bên gồm có:');

  // Party A
  sheet
    .cell('F11')
    .value(
      'BÊN A: (Bên bán): CÔNG TY TNHH SẢN XUẤT CƠ KHÍ TM – DV TÂN HÒA PHÁT'
    )
    .style('bold', true);
  sheet.cell('G12').value('- Mã số thuế: 0315155409');
  sheet
    .cell('G13')
    .value(
      '- Địa chỉ: 7 Quốc lộ 1A, Khu phố 3B, Phường Thạnh Lộc, Quận 12, TPHCM.'
    );
  sheet.cell('G14').value('- Ông/Bà: Đinh Văn Hòa');
  sheet.cell('I14').value('Chức vụ: Giám đốc');

  // Party B
  sheet.cell('F16').value('BÊN B: (Bên mua):').style('bold', true);
  sheet
    .cell('G17')
    .value(`- Tên đơn vị: ${formattedData.metadata.customerName}`);
  sheet
    .cell('G18')
    .value(`- Mã số thuế: ${formattedData.metadata.customerTaxCode}`);
  sheet
    .cell('G19')
    .value(`- Địa chỉ: ${formattedData.metadata.customerAddress}`);
  sheet
    .cell('G20')
    .value(`- Ông/Bà: ${formattedData.metadata.customerRepresentative}`);
  sheet
    .cell('I20')
    .value(`Chức vụ: ${formattedData.metadata.customerRepresentativePosition}`);

  sheet.cell('F22').value('Hai bên thống nhất giao hàng, cụ thể như sau:');

  // --- ITEMS TABLE ---
  // Table Headers
  const tableHeaders = [
    'STT',
    'Vật tư, hàng hóa',
    'Vật liệu',
    'ĐVT',
    'Số lượng',
  ];
  const headerRow = sheet.range('F24:J24');
  headerRow.value([tableHeaders]).style({
    fill: 'B4C6E7', // Light blue color
    bold: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
    wrapText: true,
  });

  // Add a utility function to convert numbers to Roman numerals
  function toRoman(num: number): string {
    const romanNumerals = [
      { value: 1000, numeral: 'M' },
      { value: 900, numeral: 'CM' },
      { value: 500, numeral: 'D' },
      { value: 400, numeral: 'CD' },
      { value: 100, numeral: 'C' },
      { value: 90, numeral: 'XC' },
      { value: 50, numeral: 'L' },
      { value: 40, numeral: 'XL' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' },
    ];

    let roman = '';
    let n = num;

    for (let i = 0; i < romanNumerals.length; i++) {
      while (n >= romanNumerals[i].value) {
        roman += romanNumerals[i].numeral;
        n -= romanNumerals[i].value;
      }
    }

    return roman;
  }

  // Add items and borders
  let currentRow = 25;
  formattedData.items.forEach((item, index) => {
    sheet
      .range(`F${currentRow}:J${currentRow}`)
      .value([
        [
          toRoman(index + 1),
          item.name,
          item.material,
          item.unit,
          item.quantity,
        ],
      ]);

    // Apply wrap text for all cells to prevent overflow
    sheet.range(`F${currentRow}:J${currentRow}`).style({
      wrapText: true,
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      },
    });

    // Special styling for material name column to prevent overflow
    sheet.cell(`G${currentRow}`).style({
      wrapText: true,
      shrinkToFit: false,
      verticalAlignment: 'top',
    });

    // Center align STT, Vật liệu, ĐVT and Số lượng columns
    sheet
      .cell(`F${currentRow}`)
      .style({ horizontalAlignment: 'center', verticalAlignment: 'center' }); // STT
    sheet
      .cell(`H${currentRow}`)
      .style({ horizontalAlignment: 'center', verticalAlignment: 'center' }); // Vật liệu
    sheet
      .cell(`I${currentRow}`)
      .style({ horizontalAlignment: 'center', verticalAlignment: 'center' }); // ĐVT
    sheet
      .cell(`J${currentRow}`)
      .style({ horizontalAlignment: 'center', verticalAlignment: 'center' }); // Số lượng
    currentRow++;
  });

  // --- TOTAL ROW ---
  const totalQuantity = formattedData.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  // Merge cells for the label and set value
  sheet.range(`F${currentRow}:I${currentRow}`).merged(true).value('Tổng cộng');

  // Add the total quantity
  sheet.cell(`J${currentRow}`).value(totalQuantity);

  // Style the entire total row
  sheet.range(`F${currentRow}:J${currentRow}`).style({
    fill: 'B4C6E7', // Light blue color
    bold: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
  });

  // Apply border to the entire table, including header and total row
  const tableRange = sheet.range(`F24:J${currentRow}`);
  tableRange.style({
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  });

  // --- FOOTER SECTION ---
  const footerStartRow = currentRow + 2;
  sheet
    .cell(`F${footerStartRow}`)
    .value(
      '- Bên A đã hoàn thành và bàn giao tất cả các hàng hóa trên cho Bên B tại Xưởng THP'
    );
  sheet
    .cell(`F${footerStartRow + 1}`)
    .value(
      '- Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.'
    );

  sheet
    .cell(`G${footerStartRow + 4}`)
    .value('ĐẠI DIỆN BÊN A')
    .style({ bold: true, horizontalAlignment: 'center' });
  sheet
    .cell(`G${footerStartRow + 5}`)
    .value('(Ký, ghi rõ họ tên)')
    .style({ italic: true, horizontalAlignment: 'center' });

  sheet
    .cell(`J${footerStartRow + 4}`)
    .value('ĐẠI DIỆN BÊN B')
    .style({ bold: true, horizontalAlignment: 'center' });
  sheet
    .cell(`J${footerStartRow + 5}`)
    .value('(Ký, ghi rõ họ tên)')
    .style({ italic: true, horizontalAlignment: 'center' });

  return workbook.outputAsync() as Promise<Buffer>;
}

export const generateDeliveryNoteExcel = functions
  .region('us-central1') // Explicitly set region
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .https.onCall(
    async (
      data: {
        formattedData: ExcelDeliveryNoteData;
        projectId: string;
        deliveryNoteId: string;
        accessToken: string;
      },
      context: CallableContext
    ) => {
      console.log('Function called with projectId:', data.projectId);

      if (!context.auth) {
        console.error('Authentication required');
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để sử dụng tính năng này.'
        );
      }

      const { formattedData, projectId, deliveryNoteId, accessToken } = data;

      if (!formattedData) {
        console.error('Missing formattedData');
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Không tìm thấy dữ liệu biên bản.'
        );
      }
      if (!projectId) {
        console.error('Missing projectId');
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Không tìm thấy ID dự án.'
        );
      }
      if (!deliveryNoteId) {
        console.error('Missing deliveryNoteId');
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Không tìm thấy ID biên bản.'
        );
      }
      if (!accessToken) {
        console.error('Missing accessToken');
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Không tìm thấy access token.'
        );
      }

      try {
        console.log('Generating Excel file with xlsx-populate...');
        const excelBuffer = await generateDeliveryNoteExcelFile(formattedData);

        console.log('Creating temp file...');
        const tempExcelPath = path.join(os.tmpdir(), `${deliveryNoteId}.xlsx`);
        fs.writeFileSync(tempExcelPath, excelBuffer);

        // Get project information to find the appropriate Drive folder
        const projectSnap = await db
          .collection('projects')
          .doc(projectId)
          .get();
        const projectData = projectSnap.data();

        if (!projectData || !projectData.driveFolderId) {
          console.error(`Project folder not found for project ${projectId}`);
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Không tìm thấy thư mục Drive của dự án.'
          );
        }

        // Use the user's access token to authenticate with Google Drive
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const drive = google.drive({ version: 'v3', auth });

        // Verify access token works by getting user info
        try {
          console.log('Verifying access token validity');
          const aboutResponse = await drive.about.get({
            fields: 'user',
          });
          console.log(
            `Access token valid for user: ${
              aboutResponse.data.user?.displayName || 'Unknown'
            }`
          );
        } catch (tokenError) {
          console.error('Access token verification failed:', tokenError);
          throw new functions.https.HttpsError(
            'unauthenticated',
            'Google access token không hợp lệ hoặc đã hết hạn.'
          );
        }

        // Upload file to project folder in Drive
        const fileName = `Biên bản giao hàng - ${formattedData.metadata.deliveryNoteNumber}.xlsx`;
        console.log(
          `Uploading file to Drive folder: ${projectData.driveFolderId}`
        );

        // Create file metadata and media
        const fileMetadata = {
          name: fileName,
          parents: [projectData.driveFolderId],
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };

        // Create a readable stream from the temp file
        const fileStream = fs.createReadStream(tempExcelPath);

        // Upload the file to Drive
        const driveResponse = await drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: fileStream,
          },
          fields: 'id, webViewLink',
        });

        console.log('File uploaded to Drive:', driveResponse.data);

        // Make the file publicly accessible
        await drive.permissions.create({
          fileId: driveResponse.data.id!,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });

        // Also upload to Firebase Storage as a backup
        /* console.log('Uploading to Firebase Storage as backup...');
        const fileName2 = `delivery_notes/${projectId}/${deliveryNoteId}.xlsx`;
        const file = bucket.file(fileName2);

        await file.save(fs.readFileSync(tempExcelPath), {
          metadata: {
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        });

        console.log('Cleaning up temp file...');
        fs.unlinkSync(tempExcelPath);

        console.log('Making firebase file public...');
        await file.makePublic(); */

        const excelUrl = driveResponse.data.webViewLink;
        console.log('Excel URL generated:', excelUrl);
        return { excelUrl, driveFileId: driveResponse.data.id };
      } catch (error: any) {
        console.error('Error generating delivery note Excel:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Lỗi tạo file Excel: ${error.message || 'Unknown error'}`,
          error
        );
      }
    }
  );
