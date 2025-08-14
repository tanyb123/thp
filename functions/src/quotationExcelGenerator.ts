import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CallableContext } from 'firebase-functions/v1/https';

// Get references to services (but don't reinitialize admin)
const storage = admin.storage();
const bucket = storage.bucket();

// Interface for the Excel formatted data
interface ExcelQuotationData {
  metadata: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    taxCode: string;
    customerName: string;
    customerAddress: string;
    quotationNumber: string;
    quotationDate: string;
    projectName: string;
    quoteValidity: string;
  };
  materials: Array<{
    no: string | any; // Changed from number to string or any to support Roman numerals
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  summary: {
    subTotal: number;
    discountPercentage: number;
    discountAmount: number;
    vatPercentage: number;
    vatAmount: number;
    grandTotal: number;
    amountInWords: string;
  };
}

/**
 * Generates an Excel file based on the quotation data and template
 * @param {ExcelQuotationData} formattedData The formatted data for Excel
 * @returns {Buffer} The Excel file as a buffer
 */
function generateExcelFile(formattedData: ExcelQuotationData): Buffer {
  // Create a new workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([]);

  // Set column widths
  const colWidths = [
    { wch: 5 }, // A - STT
    { wch: 40 }, // B - Tên gọi
    { wch: 15 }, // C - Vật liệu
    { wch: 10 }, // D - ĐVT
    { wch: 10 }, // E - SL
    { wch: 15 }, // F - Đơn giá
    { wch: 20 }, // G - Thành Tiền
    { wch: 15 }, // H
  ];
  worksheet['!cols'] = colWidths;

  // Add company logo placeholder in cell A1-B8
  // Logo would be added manually or could be implemented with additional code

  // Populate header section based on the template screenshot - Right side header (Company info)
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['CÔNG TY TNHH SẢN XUẤT CƠ KHÍ THƯƠNG MẠI']],
    { origin: 'D1' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['DỊCH VỤ TÂN HÒA PHÁT']], {
    origin: 'D2',
  });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['ĐC: Số 7 Quốc lộ 1A ,KP3B,Phường Thanh Lộc,Quận']],
    { origin: 'D3' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['12,TP.HCM']], { origin: 'D4' });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['MST: 0315155409', 'Web:cokhitanhoaphat.com.vn']],
    { origin: 'D5' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Email :chomcauinoxtanhoaphat.com.vn']],
    { origin: 'D6' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['Hotline 24/7: 0978.268.559']], {
    origin: 'D7',
  });

  // Add quotation title
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['BẢNG BÁO GIÁ KIỂM XÁC NHẬN ĐẶT HÀNG']],
    { origin: 'B3' }
  );

  // Add quotation info - Date and number
  XLSX.utils.sheet_add_aoa(worksheet, [['Ngày']], { origin: 'F4' });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [[formattedData.metadata.quotationDate]],
    { origin: 'G4' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['SỐ']], { origin: 'F5' });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [[formattedData.metadata.quotationNumber]],
    { origin: 'G5' }
  );

  // Add customer info section starting at B10
  XLSX.utils.sheet_add_aoa(worksheet, [['KÍNH GỬI:']], { origin: 'B9' });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Địa chỉ:', formattedData.metadata.customerAddress]],
    { origin: 'B10' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tel', ':', '', '', 'MST', ':', '', 'FAX']],
    { origin: 'B11' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Email', ':', '', '', 'Attn', ':', '', 'Mobile:']],
    { origin: 'B12' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        'Trước hết Công Ty Tân Hòa Phát xin chân thành cảm ơn sự quan tâm & hợp tác của Quý Khách. Chúng tôi xin gửi tới Quý khách báo giá các chủng loại sau:',
      ],
    ],
    { origin: 'B14' }
  );

  // Add table header for materials
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['STT', 'Tên gọi', 'Vật liệu', 'ĐVT', 'SL', 'Đơn giá', 'Thành Tiền']],
    { origin: 'B16' }
  );

  // Log một vài item đầu tiên để kiểm tra
  functions.logger.info('Generating Excel with materials (first 5):', {
    materials: (formattedData.materials || [])
      .slice(0, 5)
      .map((item) => ({ no: item.no, name: item.name })),
  });

  // Add material rows
  let currentRow = 17;
  formattedData.materials.forEach((item) => {
    const cellData = [
      { v: item.no, t: 's' }, // Ép kiểu thành Text (s)
      item.name,
      '', // Vật liệu
      item.unit,
      item.quantity,
      item.unitPrice,
      item.total,
    ];
    XLSX.utils.sheet_add_aoa(worksheet, [cellData], {
      origin: `B${currentRow}`,
    });

    currentRow++;
  });

  // Add summary section after materials
  // Calculate appropriate summary row position based on materials
  const summaryStartRow = Math.max(currentRow + 1, 17); // Ensure at least some space after last material

  // Add summary rows with borders
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tổng cộng', formattedData.summary.subTotal]],
    { origin: `F${summaryStartRow}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Thuế VAT 10%', formattedData.summary.vatAmount]],
    { origin: `F${summaryStartRow + 1}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tổng cộng đã bao gồm VAT 10%', formattedData.summary.grandTotal]],
    { origin: `F${summaryStartRow + 2}` }
  );

  // Add borders to summary cells
  const summaryCells = [
    `F${summaryStartRow}`,
    `G${summaryStartRow}`, // Tổng cộng
    `F${summaryStartRow + 1}`,
    `G${summaryStartRow + 1}`, // Thuế VAT 10%
    `F${summaryStartRow + 2}`,
    `G${summaryStartRow + 2}`, // Tổng cộng đã bao gồm VAT 10%
  ];

  summaryCells.forEach((cellRef) => {
    if (!worksheet[cellRef]) {
      worksheet[cellRef] = {};
    }
    worksheet[cellRef].s = {
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      },
      fill: {
        fgColor: { rgb: 'E6E6FA' }, // Light purple background
      },
      alignment: {
        horizontal: 'right',
        vertical: 'center',
      },
    };
  });

  // Add amount in words
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Bằng chữ:', formattedData.summary.amountInWords]],
    { origin: `B${summaryStartRow + 4}` }
  );

  // Add ghi chú section
  XLSX.utils.sheet_add_aoa(worksheet, [['Ghi chú:']], {
    origin: `B${summaryStartRow + 6}`,
  });

  // Add terms and conditions
  let termsRow = summaryStartRow + 8;

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        '1. Báo giá có hiệu lực trong 7 ngày. Hết hiệu lực xin liên hệ lại cho Công ty.',
      ],
    ],
    { origin: `C${termsRow}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['2. Thời gian giao hàng: 3 ngày ( không bao gồm chủ nhật, ngày lễ )']],
    { origin: `C${termsRow + 1}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['3. Giá đã bao gồm VAT và không bao gồm vận chuyển']],
    { origin: `C${termsRow + 2}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['4. Địa điểm giao hàng: kho bên Bán']],
    { origin: `C${termsRow + 3}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        '5. Phương thức thanh toán: Quý Khách hàng vui lòng thanh toán bằng chuyển khoản để xuất hóa đơn:',
      ],
    ],
    { origin: `C${termsRow + 4}` }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['Tài khoản số: 27888866']], {
    origin: `C${termsRow + 5}`,
  });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tên tài khoản: Công ty TNHH SX cơ khí TM-DV Tân Hòa Phát']],
    { origin: `C${termsRow + 6}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Ngân hàng TMCP Á Châu - Chi nhánh: Tam Hà, Thủ Đức']],
    { origin: `C${termsRow + 7}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tạm ứng 50%, Thanh toán 50% trước khi nhận hàng']],
    { origin: `C${termsRow + 8}` }
  );

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo giá');

  // Generate Excel file as buffer
  const excelBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });
  return excelBuffer;
}

/**
 * Firebase Callable Function that generates an Excel quotation
 * Uploads the Excel to Firebase Storage and returns a public URL
 */
export const generateExcelQuotation = functions
  .runWith({
    timeoutSeconds: 300, // Increased timeout
    memory: '512MB', // Increased memory
  })
  .https.onCall(
    async (
      data: {
        formattedData: ExcelQuotationData;
        projectId: string;
        accessToken?: string; // Thêm tham số accessToken vào đây
      },
      context: CallableContext
    ) => {
      try {
        // Bắt đầu try...catch ở đây
        if (!context.auth) {
          throw new functions.https.HttpsError(
            'unauthenticated',
            'Bạn cần đăng nhập để sử dụng tính năng này.'
          );
        }

        const { formattedData, projectId } = data;

        // Log dữ liệu nhận được
        functions.logger.info(
          'Received data in generateExcelQuotation function.',
          {
            projectId,
            materialsCount: formattedData?.materials?.length || 0,
            firstFiveMaterials: (formattedData?.materials || [])
              .slice(0, 5)
              .map((item) => ({ no: item.no, name: item.name })),
          }
        );

        if (!formattedData) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Không tìm thấy dữ liệu báo giá.'
          );
        }

        if (!projectId) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Không tìm thấy ID dự án.'
          );
        }

        console.log('Bắt đầu tạo file Excel với dữ liệu:', {
          projectId,
          quotationNumber: formattedData.metadata.quotationNumber,
          materialsCount: formattedData.materials?.length || 0,
        });

        // Generate Excel buffer
        const excelBuffer = generateExcelFile(formattedData);

        // Save to temp file
        const quotationNumber = formattedData.metadata.quotationNumber.replace(
          /\//g,
          '-'
        );
        const tempExcelPath = path.join(os.tmpdir(), `${quotationNumber}.xlsx`);
        fs.writeFileSync(tempExcelPath, excelBuffer);

        // Upload to Firebase Storage
        const fileName = `excel_quotations/${projectId}/${quotationNumber}.xlsx`;
        const file = bucket.file(fileName);

        await file.save(fs.readFileSync(tempExcelPath), {
          metadata: {
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        });

        // Clean up temp file
        fs.unlinkSync(tempExcelPath);

        // Make the file publicly accessible
        await file.makePublic();

        // Return the public URL
        const excelUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        functions.logger.info('Đã tạo file Excel thành công:', { excelUrl });
        return { excelUrl };
      } catch (error: any) {
        functions.logger.error('Unhandled error in generateExcelQuotation:', {
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          data, // Log cả dữ liệu đầu vào
        });
        throw new functions.https.HttpsError(
          'internal',
          error.message || 'Lỗi không xác định khi tạo file Excel.',
          error
        );
      } // Kết thúc try...catch ở đây
    }
  );
