import * as XLSX from 'xlsx';
import { ExcelQuotationData } from './types';

/**
 * Generates an Excel file based on the quotation data and template
 * @param {ExcelQuotationData} formattedData The formatted data for Excel
 * @returns {Buffer} The Excel file as a buffer
 */
export function generateExcelFile(formattedData: ExcelQuotationData): Buffer {
  // Create a new workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([]);

  // Set column widths
  const colWidths = [
    { wch: 5 }, // A
    { wch: 40 }, // B
    { wch: 10 }, // C
    { wch: 10 }, // D
    { wch: 15 }, // E
    { wch: 20 }, // F
    { wch: 20 }, // G
  ];
  worksheet['!cols'] = colWidths;

  // Add company header info (column E)
  addCompanyHeader(worksheet, formattedData);

  // Add quotation information (header and basic info)
  addQuotationHeader(worksheet, formattedData);

  // Add customer information
  addCustomerInfo(worksheet, formattedData);

  // Add materials table
  const materialEndRow = addMaterialsTable(worksheet, formattedData);

  // Add financial summary section
  const summaryEndRow = addFinancialSummary(
    worksheet,
    formattedData,
    materialEndRow
  );

  // Add terms and conditions
  addTermsAndConditions(worksheet, summaryEndRow);

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
 * Add company header information to the worksheet
 */
function addCompanyHeader(
  worksheet: XLSX.WorkSheet,
  formattedData: ExcelQuotationData
): void {
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['CÔNG TY TNHH SẢN XUẤT CƠ KHÍ THƯƠNG MẠI']],
    { origin: 'E1' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['DỊCH VỤ TÂN HÒA PHÁT']], {
    origin: 'E2',
  });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['ĐC: Số 7 Quốc lộ 1A ,KP3B,Phường Thanh Lộc,Quận']],
    { origin: 'E3' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['12,TP.HCM']], { origin: 'E4' });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['MST: 0315155409', 'Web:cokhitanhoaphat.com.vn']],
    { origin: 'E5' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Email :chomcauinoxtanhoaphat.com.vn']],
    { origin: 'E6' }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['Hotline 24/7: 0978.268.559']], {
    origin: 'E7',
  });
}

/**
 * Add quotation title and basic information
 */
function addQuotationHeader(
  worksheet: XLSX.WorkSheet,
  formattedData: ExcelQuotationData
): void {
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['BẢNG BÁO GIÁ KIỂM XÁC NHẬN ĐẶT HÀNG']],
    { origin: 'B9' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Ngày'], [formattedData.metadata.quotationDate]],
    { origin: 'F10' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['SỐ'], [formattedData.metadata.quotationNumber]],
    { origin: 'F11' }
  );
}

/**
 * Add customer information section
 */
function addCustomerInfo(
  worksheet: XLSX.WorkSheet,
  formattedData: ExcelQuotationData
): void {
  XLSX.utils.sheet_add_aoa(worksheet, [['KÍNH GỬI:']], { origin: 'B12' });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Địa chỉ:', formattedData.metadata.customerAddress]],
    { origin: 'B13' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tel', ':', '', '', 'MST', ':', '', 'FAX']],
    { origin: 'B14' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Email', ':', '', '', 'Attn', ':', '', 'Mobile:']],
    { origin: 'B15' }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        'Trước hết Công Ty Tân Hòa Phát xin chân thành cảm ơn sự quan tâm & hợp tác của Quý Khách. Chúng tôi xin gửi tới Quý khách báo giá các chủng loại sau:',
      ],
    ],
    { origin: 'B16' }
  );
}

/**
 * Add materials table to the worksheet
 * @returns The row number after the materials table
 */
function addMaterialsTable(
  worksheet: XLSX.WorkSheet,
  formattedData: ExcelQuotationData
): number {
  // Add table header for materials
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['STT', 'Tên gọi', 'Vật liệu', 'ĐVT', 'SL', 'Đơn giá', 'Thành Tiền']],
    { origin: 'B18' }
  );

  // Add material rows
  let currentRow = 19;
  formattedData.materials.forEach((item) => {
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [
          item.no,
          item.name,
          '',
          item.unit,
          item.quantity,
          item.unitPrice,
          item.total,
        ],
      ],
      { origin: `B${currentRow}` }
    );
    currentRow++;
  });

  return currentRow + 2; // Add 2 rows gap
}

/**
 * Add financial summary section
 * @returns The row number after the summary section
 */
function addFinancialSummary(
  worksheet: XLSX.WorkSheet,
  formattedData: ExcelQuotationData,
  startRow: number
): number {
  // Add summary section after materials
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['', '', '', '', 'Tổng cộng:', '', formattedData.summary.subTotal]],
    { origin: `B${startRow}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        '',
        '',
        '',
        '',
        `Chiết khấu (${formattedData.summary.discountPercentage}%):`,
        '',
        formattedData.summary.discountAmount,
      ],
    ],
    { origin: `B${startRow + 1}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        '',
        '',
        '',
        '',
        `Thuế VAT (${formattedData.summary.vatPercentage}%):`,
        '',
        formattedData.summary.vatAmount,
      ],
    ],
    { origin: `B${startRow + 2}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['', '', '', '', 'TỔNG CỘNG:', '', formattedData.summary.grandTotal]],
    { origin: `B${startRow + 3}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Bằng chữ:', formattedData.summary.amountInWords]],
    { origin: `B${startRow + 5}` }
  );

  return startRow + 8; // Return row after summary section
}

/**
 * Add terms and conditions section
 */
function addTermsAndConditions(
  worksheet: XLSX.WorkSheet,
  startRow: number
): void {
  XLSX.utils.sheet_add_aoa(worksheet, [['Ghi chú:']], {
    origin: `B${startRow}`,
  });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        '1. Báo giá có hiệu lực trong 7 ngày. Hết hiệu lực xin liên hệ lại cho Công ty.',
      ],
    ],
    { origin: `C${startRow + 2}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['2. Thời gian giao hàng: 3 ngày ( không bao gồm chủ nhật, ngày lễ )']],
    { origin: `C${startRow + 3}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['3. Giá đã bao gồm VAT và không bao gồm vận chuyển']],
    { origin: `C${startRow + 4}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['4. Địa điểm giao hàng: kho bên Bán']],
    { origin: `C${startRow + 5}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [
        '5. Phương thức thanh toán: Quý Khách hàng vui lòng thanh toán bằng chuyển khoản để xuất hóa đơn:',
      ],
    ],
    { origin: `C${startRow + 6}` }
  );

  XLSX.utils.sheet_add_aoa(worksheet, [['Tài khoản số: 27888866']], {
    origin: `C${startRow + 7}`,
  });

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tên tài khoản: Công ty TNHH SX cơ khí TM-DV Tân Hòa Phát']],
    { origin: `C${startRow + 8}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Ngân hàng TMCP Á Châu - Chi nhánh: Tam Hà, Thủ Đức']],
    { origin: `C${startRow + 9}` }
  );

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [['Tạm ứng 50%, Thanh toán 50% trước khi nhận hàng']],
    { origin: `C${startRow + 10}` }
  );
}
