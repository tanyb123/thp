/**
 * HTML template for generating quotation PDFs
 * This template creates a professional-looking quotation with all required sections
 */

export const getQuotationHTML = (quotationData) => {
  // Destructure all necessary data from the quotationData object
  const {
    quotationNumber,
    quotationDate,
    validUntil,
    projectName,
    customerName,
    customerAddress,
    customerPhone,
    customerEmail,
    materials,
    subtotal,
    discount,
    discountAmount,
    vatRate,
    vatAmount,
    totalWithVat,
    totalInWords,
    notes,
    paymentTerms,
    deliveryTerms,
    warrantyTerms,
    otherTerms,
    bankDetails
  } = quotationData;

  // Format currency function
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('₫', 'VNĐ');
  };

  // Generate table rows for materials
  const materialRows = materials.map((item, index) => {
    return `
      <tr style="border: 1px solid #000;">
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #000; padding: 8px;">${item.name}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.unit}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.quantity}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(item.unitPrice)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(item.quantity * item.unitPrice)}</td>
      </tr>
    `;
  }).join('');

  // Format bank details with line breaks
  const formattedBankDetails = bankDetails.replace(/\n/g, '<br>');

  // Create the complete HTML template
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Báo giá ${quotationNumber}</title>
      <style>
        body {
          font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
          font-size: 12px;
          line-height: 1.5;
        }
        .page {
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        .company-info {
          text-align: left;
        }
        .company-name {
          font-size: 18px;
          font-weight: bold;
          color: #1a5276;
          margin-bottom: 5px;
        }
        .quotation-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin: 20px 0;
          text-transform: uppercase;
        }
        .quotation-number {
          font-style: italic;
          text-align: center;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
          text-align: center;
          padding: 8px;
          border: 1px solid #000;
        }
        .customer-info {
          margin-bottom: 20px;
        }
        .summary-table {
          width: 50%;
          margin-left: auto;
          margin-top: 10px;
        }
        .notes {
          margin-bottom: 20px;
        }
        .amount-in-words {
          font-style: italic;
          margin-bottom: 20px;
        }
        .terms {
          margin-bottom: 20px;
        }
        .term-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          page-break-inside: avoid;
        }
        .signature-box {
          text-align: center;
          width: 45%;
        }
        .signature-title {
          font-weight: bold;
          margin-bottom: 60px;
        }
        .footer {
          margin-top: 30px;
          font-size: 10px;
          text-align: center;
          color: #777;
          page-break-inside: avoid;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header with company info -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ XÂY DỰNG HOÀNG KHANG</div>
            <div>Địa chỉ: 123 Nguyễn Văn Linh, Phường Tân Thuận Đông, Quận 7, TP. Hồ Chí Minh</div>
            <div>Điện thoại: 028.1234.5678 | Email: info@hoangkhang.vn</div>
            <div>MST: 0123456789</div>
          </div>
          <div>
            <img src="https://via.placeholder.com/150x80?text=LOGO" alt="Logo" style="max-height: 80px;">
          </div>
        </div>
        
        <!-- Quotation title and number -->
        <div class="quotation-title">BÁO GIÁ</div>
        <div class="quotation-number">Số: ${quotationNumber} - Ngày: ${quotationDate}</div>
        
        <!-- Customer information -->
        <div class="customer-info">
          <table style="border: none;">
            <tr>
              <td style="width: 150px;"><strong>Kính gửi:</strong></td>
              <td><strong>${customerName}</strong></td>
            </tr>
            <tr>
              <td>Địa chỉ:</td>
              <td>${customerAddress || ''}</td>
            </tr>
            <tr>
              <td>Điện thoại:</td>
              <td>${customerPhone || ''}</td>
            </tr>
            <tr>
              <td>Email:</td>
              <td>${customerEmail || ''}</td>
            </tr>
            <tr>
              <td>Dự án:</td>
              <td>${projectName}</td>
            </tr>
            <tr>
              <td>Hiệu lực báo giá:</td>
              <td>${validUntil}</td>
            </tr>
          </table>
        </div>
        
        <!-- Materials table -->
        <table style="border: 1px solid #000; width: 100%;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 8px; width: 5%;">STT</th>
              <th style="border: 1px solid #000; padding: 8px; width: 40%;">Tên sản phẩm</th>
              <th style="border: 1px solid #000; padding: 8px; width: 10%;">Đơn vị</th>
              <th style="border: 1px solid #000; padding: 8px; width: 10%;">Số lượng</th>
              <th style="border: 1px solid #000; padding: 8px; width: 15%;">Đơn giá</th>
              <th style="border: 1px solid #000; padding: 8px; width: 20%;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${materialRows}
          </tbody>
        </table>
        
        <!-- Notes section -->
        <div class="notes">
          <div style="font-weight: bold; margin-bottom: 5px;">GHI CHÚ:</div>
          <div>${notes || 'Không có ghi chú.'}</div>
        </div>
        
        <!-- Summary table -->
        <div style="display: flex; justify-content: flex-end;">
          <table class="summary-table" style="border: none; width: 50%;">
            <tr>
              <td style="text-align: right; padding: 5px;"><strong>Tổng cộng:</strong></td>
              <td style="text-align: right; padding: 5px;">${formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 5px;"><strong>Chiết khấu (${discount}%):</strong></td>
              <td style="text-align: right; padding: 5px;">${formatCurrency(discountAmount)}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 5px;"><strong>Thuế VAT (${vatRate}%):</strong></td>
              <td style="text-align: right; padding: 5px;">${formatCurrency(vatAmount)}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 5px; font-weight: bold;">
                <strong>Tổng cộng đã bao gồm VAT:</strong>
              </td>
              <td style="text-align: right; padding: 5px; font-weight: bold;">${formatCurrency(totalWithVat)}</td>
            </tr>
          </table>
        </div>
        
        <!-- Amount in words -->
        <div class="amount-in-words">
          <strong>Bằng chữ:</strong> ${totalInWords}
        </div>
        
        <!-- Terms and conditions -->
        <div class="terms">
          <div class="term-title">ĐIỀU KHOẢN VÀ ĐIỀU KIỆN:</div>
          <ol>
            <li><strong>Thời gian giao hàng:</strong> ${deliveryTerms}</li>
            <li><strong>Điều khoản thanh toán:</strong> ${paymentTerms}</li>
            <li><strong>Điều khoản bảo hành:</strong> ${warrantyTerms}</li>
            <li><strong>Điều khoản khác:</strong> ${otherTerms}</li>
            <li><strong>Thông tin tài khoản:</strong><br>${formattedBankDetails}</li>
          </ol>
        </div>
        
        <!-- Signature section -->
        <div class="signatures">
          <div class="signature-box">
            <div class="signature-title">KHÁCH HÀNG</div>
            <div>(Ký, ghi rõ họ tên)</div>
          </div>
          <div class="signature-box">
            <div class="signature-title">CÔNG TY TNHH TM DV XD HOÀNG KHANG</div>
            <div>(Ký, đóng dấu)</div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div>CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ XÂY DỰNG HOÀNG KHANG</div>
          <div>Địa chỉ: 123 Nguyễn Văn Linh, Phường Tân Thuận Đông, Quận 7, TP. Hồ Chí Minh</div>
          <div>Điện thoại: 028.1234.5678 | Email: info@hoangkhang.vn | Website: www.hoangkhang.vn</div>
        </div>
      </div>
    </body>
    </html>
  `;
}; 