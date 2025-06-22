//functions/src/index.ts
/* eslint-disable max-len */
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CallableContext } from 'firebase-functions/v1/https';

// Initialize Firebase Admin
admin.initializeApp();

// Get references to services
const storage = admin.storage();
const bucket = storage.bucket();

// Define TypeScript interface for the data received from the client
interface ClientQuotationData {
  quotationNumber: string;
  quotationDate: string;
  projectName: string;
  customerData: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  materials: {
    name?: string;
    unit?: string;
    quantity?: number;
    weight?: number; // Thêm trường KL
    unitPrice?: number;
    totalPrice?: number;
  }[];
  subTotal: number;
  discountPercentage: number;
  discountAmount: number;
  vatPercentage: number;
  vatAmount: number;
  grandTotal: number;
  amountInWords: string;
  notes: string;
  paymentTerms: string;
  deliveryTime: string;
  warrantyTerms: string;
  otherTerms: string;
  bankDetails: string;
  quoteValidity: string;
  projectId?: string;
}

/**
 * Generates HTML content for a quotation.
 * @param {ClientQuotationData} quotationData The data to include in the quotation.
 * @return {string} HTML string for the quotation.
 */
function getQuotationHTML(quotationData: ClientQuotationData): string {
  // Destructure with correct paths, especially for nested customerData
  const {
    quotationNumber,
    quotationDate,
    projectName,
    customerData = {}, // Default to empty object to prevent errors
    materials = [], // Default to empty array
    discountPercentage,
    vatPercentage,
    amountInWords,
    notes,
    paymentTerms,
    deliveryTime,
    warrantyTerms,
    otherTerms,
    bankDetails,
    quoteValidity,
  } = quotationData;

  // Format currency function
  const formatCurrency = (amount: number): string => {
    // Defensively handle non-numeric types
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '0 VNĐ';
    }
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace('₫', 'VNĐ');
  };

  // SERVER-SIDE CALCULATION
  // 1. Calculate SubTotal on the server
  const serverCalculatedSubTotal = materials.reduce((sum, item) => {
    const itemTotal =
      (item.quantity || 0) * (item.weight || 0) * (item.unitPrice || 0);
    return sum + itemTotal;
  }, 0);

  // 2. Recalculate all other financial figures
  const discountAmount =
    (serverCalculatedSubTotal * (discountPercentage || 0)) / 100;
  const totalAfterDiscount = serverCalculatedSubTotal - discountAmount;
  const vatAmount = (totalAfterDiscount * (vatPercentage || 0)) / 100;
  const grandTotal = totalAfterDiscount + vatAmount;

  // Generate table rows for materials
  const materialRows = materials
    .map((item, index: number) => {
      // Calculate the new display unit price (Price per complete item)
      const displayUnitPrice = (item.weight || 0) * (item.unitPrice || 0);

      // The total price is now simply quantity * the new display unit price
      const calculatedTotalPrice = (item.quantity || 0) * displayUnitPrice;

      return `
      <tr style="border: 1px solid #000;">
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${
          index + 1
        }</td>
        <td style="border: 1px solid #000; padding: 8px;">${
          item.name || ''
        }</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${
          item.unit || ''
        }</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${
          item.quantity || 0
        }</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(
          displayUnitPrice
        )}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(
          calculatedTotalPrice
        )}</td>
      </tr>
    `;
    })
    .join('');

  // Format bank details with line breaks
  const formattedBankDetails = (bankDetails || '').replace(/\n/g, '<br>');

  // Create the complete HTML template
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Báo giá ${quotationNumber}</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
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
            <img src="data:image/gif;base64,R0lGODlhyABkAOcAAHbNfnjMfnrQd3vQfDO6vjW7uja6vja8ujW8vTq3uzy8tzu4vDu+uT66uDy9uACa6QCa7QCd6gCd7ACd8ACe/hyv2xe21hO03B610xqx3ACh6gCh7QCl6gCl7QCo6gCp7gCu6gCt7gaq7Qav6gSt7gur7QCj8ACh+wCi/gCm+QCl/gSh/wCq8QCq9gCt8ACs9Qes8ASs9QCq+gCp/gCs+Aap+Aip9wms8QCw6gCw7Qqw5Qyx4Qyx5Aix6A6x7gCw8Auz8Q2y8Bes5hKs6Rmv4Rev8BCx4BGw5xSw4RO27xSz6xez7hW07hqw7xy37h657xCy8BG08Bez8Ba08Re39Ru38B2z8B228hy58CW1zye4ySq0zC26xCm4ySy5ySKy1SK40Smz0TG1wzW8wSq67yGy8SO18SK58iq08i628im68Sm79Cm98i248C298i6/9DK58DG98jK/9Da48je/8Te+9Tq88Ti+9Dy+8j7BszTA8zvC9Eq+rUS9s0m/s1G/pEW971/Fk1vFm13IkEXBrEvBpk/Bp0rCqULAsFHCpVLCrG7Kh23LjGPGk2XJkHTMg33QgEXD80vB8UnD9k3G80zG9k7I9FDG9VTE9lLI81bK9VvK9WDL9WPP9mXO9WPM+WjO9G/P9WfR+GzT9nLO9XLP+HHR9HbQ9XXU9nLS+HnR9XnV93zR9X/W9HrX+HzW+LrePr/eO7zePbfiPbrhPb3gO7zgPbzkPr3pPpfZXZzWXJ3YWp7YXYDPfInSbYnUa4zTa4zVbIPRdIHRfIjSc5TUZJPYZKPaVKDaWqjbUbTeRbDbTrLfSLHeT7TcSLreQb3eQaPgV7PgRrnhQLzgQLznQL7pQtftHsbmLczmLcjoK8TjNMLgOcXoNMjjMcjsNNbmJdPmKtboJdPqKdnnItnmJdjnKNnrJNDlMNfwJeTtFOTqGunsE+/1DeTxFOLxGOzzEfLtDP7vAfb1BfL0Cv7yAPn2Cfn5AP75AP/6BP79AP/9BMDgQYHU9oHX+P///yH5BAAAAP8ALAAAAADIAGQAAAj+AP8JHEiwoMGCn+osCRIECMOHECNKnEixosWLGDNq3MiRoY8gUupwOkiypMmTBOd0kCChww8XIXKEmEmzps2bOHPq3Mmzp8+fQIP+CDH0g4QNHdqgXMq0YBEJGkLArCkzqNWrWLNq3ToTpouqQzdEKNK0bMk0LX8MpenCxVqucOPKnctTrVSvbjtAQGO2779+GyT8yCGzKt3DiBPDbUt05tsfGzSw8st0U1q8jmtOVcy5s+fMNhn/+PAAE+WTkR6wKMy4atvXn2PLlrsZZg61LkC4/RDBzmmSeCBInQnCMePas5MrD/o1JujCXUNAgPO7YOqXNrED3az5tferQ1n+K3dL861s7t7t1vwBwXf1f50exJxK/673+/dxcs9aXOpaw7HZ5tVyd1G10wObvAcBC4OZlxVyczVnW3KuzbefZ/th1hVuUkFQXQcuFRjdVdwNdhhjBDZH1IUYNkgTYQB2lcMHG5ymxgYOggbeWyhuNZRo2s1WG4udoTjVWjm+lIMEZ1Am33AsePcCflRSyUKUMP0wZZVcUinTS+Qlp5sLL5DwQlddpqkmlWqZiJdbrplI1AOo9LWBB4PJgAIKKvTp55+ABioon3sWauihiCaqgqEzxMhZWyTMsKcKJ/SZ6KWYZoroonuewGd9IjaWAws1lrWHBDm8gEILhhBzzDH+ycQq66y01jrrMboUo+uuvPbqq6/GFBNsMdEM0AKRJ7oAwy/RCPvrs9BGK60xxDCCSAaLyiDhVDJlKYEcZW0QAgsoJHKOPuimq+667Lbr7rvs7gMvun2o0B1dPbqggiDz9uvvvPKii8880DBiBAUqGNYWYVNJ0BQbGvywwiPo1mPxxRhnrPHGHHessTwWg4yxPPjgIwYFOXIGwg8UGKIPPiJ7LPPMHMdMMrrtEDMEBS8EaRdkWDAlQQgoKPAyzUgnTbM8NuejDx8o54TsdprNlIMLFDSiz8f1xKz01xvjow88jSD8o1S6zeQwShDTkMI6W4cM9txgMy22IBTk9mP+j4m1xgIFAcRtM92EXwyy2MnAgEK35mnQ5EkThLACIfqI7HXhmHdtuMViL8KzWiygGWAOLVAQTNyaZ144yPLok44Qi7P1lQsTnGQZCCgYg7rqvG9usT7CUNDCD2N+NhUIZ341AwXHbD345b0vrc87Q5xw24pfSWCJSSF88IIKzOweffT66EIBDcTTYO/Uh7VgL1GSSoM69OPTL3fI+lxTQ8ISdh+CSZFjgQqUsY/x9U5k+pgGCmZQnO89wgs0OFPfQtBAGRwCby8AAQj6NI7KGdBj9sOYPmaxgmNdTSo5qB1J3qABt6CAF+L74Oa8djka7kMbffoS4PRhgRmwZTj+iVFBIvRxspdssATv8KAMuTYzfQCAAldDkeNI4gHGoIBfcgthzVI3N/qxLn82SJhuKMCHrfXAhyNSjArGoA97VACKMzkBEehROS1Gz3I1KxkGYlcVEnCAJBHolgxgMA988C6ETAMhDcc2hNixbAFiiwcP0AhENSKgHvt4RwkSFhMKhEFsdjSg/ZimD26ggAbF+ZEEVmEQOWygNRQYRAyRhkelhXIf8/gCHHNAgS3cQx/5kCQl2ccVFRjAkPoYRwpQkDYKJGAfhlxiKDWmjwOgwGpX28AaDPKB0E1FVbt42TSZeD/MQdMLFEAhCjLQjsrdIx47GGZnVHCAaO5jG33+0iDWyhjNJX5NH7ZAQVvW8oEPGERcIDhhCGSggl6I7V/pElvJxCkzeTitZPm4KEbz8VA/7FIFJXBHHfEhzB9yhp793Ic0Fkg8rGkNojCNaDm3WA9DXmB9w4lAQSzDrcGAQAYUyAIkpuGNohr1qEhF6jbiwUWOlaOo3TgqOsIhDnGAIx2B4FkIcNAncexDZCSdpEkt2c966GMXFJABYV5AAQB8I6lwjatcixqOeDitqR7TxyNO4J+ZROASBHnCK22ymhAsSgUzSKxiF8vYxapgBcqYJcbwgQAKNHYGNGjBCzargq/kgFLT2B1JjSDPkx5zc/rwhfBkIsDLuva1r5X+wRH40AxghrJ13FABDZzjgg4kgSDedM5N2kKD4hq3uJtNbnKRy9BnSPZi+OgDzyL4ggjKYAYyyK4MzpQDoB6jgJMtaXSIuR36qAABZf3dE3crFeW+QAYRpK57q3tc4853s9dFAQUUMY98VLSm8jBCZ7FTUIKIqzEX4ttPyKQCWIC3Y/hABAqC1J/hXK90xYhhWEsbIbacN72/cwTPFEyXoWipl/aA2cwiPGGruUCnAkkFqsgblFSpgBrP5ZyEFdad3LC1F7Pc8Fhp42H0hk0ff8jbWmhsFSXxknI00+s1jxMBUAhkEuIakNSotGUG2yLHNZVwJW0iE7Y64miXE3L+GolMkw9v7GYNgOJgFsYwJvPkK1pCQSycl9diCBSIG7iDQJzQAdukDE342YmNvywzFo95RFgrBDRnWlPxPnoxNXHzmzkaBr5GMT9cWZhtKDBELtaydcn4s206EAWB+I88RKqSor+HY5nlQ8xpNO8x+5lmS9vZJ7XR9Jv1gQ4ipIAz4YGJCjDQMcvpgxqddQtMCvyPKIEpSFrxCq3B7GjRAVEGJaDHVyldabGuOS7BNnLGLNc6bKhAghN0ywyMEEp9xOLdXrlaBwSSZUdppTDbbvSOvU3BEMzgAgD2HXR9faIig/h++WDHC2ag5UuTyGpSWTZNf0eLd7dUKjCOyor+DvM9Rnus2+OlyQx4EI+HLzyeCj33Yj572pOD472IzkyWjsPlUK1HKi17cMf0sYx38/bFrzBFVGZHchWYHMK4rtpMVt7yk4t3W3Axz0uM6XLo3lwGOY/OoX8ems2k6gTPEDrH9JGLP+9tA57YxIETU3JuR32sVO96peMpI5lneyooVfhkvx52k5KYLT9jy9VYloejgVCvK9jQTDZgiUiYIOVzqbvArxkalbMcxDELK9ghFGqd66sAZYUePgjv7b0tTCcxdwx2sBaGFNNsH4ewHgpnYoI9yKEDBJeL5k9+9zTmnYkki8cIVNAC+cr3vtC/L3LjSwMUcCH1Gls9zr3+PTuZYBa72g2/dslEpupKioz0UDEIbfo+CX3ADWf4gN+5Mnyoc17qBv+81WOAWNj6//+LRQFaoHc1xXqwUUlaglzQRwMM9SczQAJ9gAy2NTOtgw66NSKjcQZTkHK/thP1xzEoh3f6B0JzVYImGFfhUE5pZoA9QhgqwAXnYFXmMIM0OIPiYA7ZwA/UQA218AzcsA5ikzStIwD3xx1TEAQZknlOZ3f3J4JV92bQdVHANFEx5S4SNVEcRUPZx4L14QIowADowlElM4YYNVEBIzBggw9gwEm38RJDAQVB0Bgo1IFS8z20wIRVsxnH508fpH2jlxNcx4e/4w0XeBdRlAP+H2FhZ4NudoiHnTd1IyiI0eOHFmdYNceH+lAIiwMgjMEQwjV2WMFgd7h5w+V5TyiJvUOJRBKImAgOzKc3Y+aJQBQmWdeIpPiI+XeKqKg6qgiIlyhDYjMGcIRgNSGLKuJvWKElKjCKxNeExheJu5g5vYgTrPhBpGQMKINtbBEETPAddFiHy+iI+LeH0SiNhLeKv2hA+iAO2PVDQ8IEavABPBIhttiMpQiJuliOhDONN1GNBpQP9IAEK8A4wuUYH3AGceASX1KJJFKP9nePuUiA+kgz/GgT/nhI9ZAP9xAGUEQYL6IZH7AGkQB8TEeP4XiLBaKH0AhCITNOXaQ5IaT+igKSaen4X1HWDmJwTWljIB7ZAXugCS0kKt84XA4Jgne3H+QIhRPZaOc4ZBfZbDXDNKwjNt1ABNe0iGQXAhtACaMQAWBSkItRlGFzlDaRlEtDbi8JlarXlGv2lOTUaC8zDIuSA8WBZ0fyiRHQCf8gLtpYiydpj0MWkTa5lCDIlmPmlkq5bpzzMsjAkY1iiBUmdRLwCnupGMrIjA8ZmGaZOghUhZ6JLtA0OFuIc6RniRJpVupyhgIzDsGATgmzkAg2IDunlQJRaLxlkphplE2IlCupgsigC7uwC8AZnLpQnMZ5nMiZnMe5C7wQnM35m8wwMmFjmNyBmBgTD89ADbT+QA3QQAu2IA3HAAyOMAZAhW/DEZnHUSAy8Uf/QALyGEW4KY6PtpnhtTyE8ieakp+EUiiLQgEZgH0Zw4/VWZMjgw/bgAIrMAN9oqCWUil/qFAsUiGjYVD/QAUckG/I2JB/mZnnRp8LpwMygCVrMqKJ9j1jQIACSpMo6g2JtVltsSWh0i0kIIdoAiAk4AIfEAQCEQlZBpahJpbZF3XpiY96p2bDcXihaF7qBmHnOJNttqQgyKI0kKHgMRwcQAcCUQpDc5eMuKG6iX9EanXmFphbkW4oSp2ZBqVhI6VUKhQDIgGfMBAHFns/6qVjuZtl2ZvhNabzF4oOx5Sk6ZRqmn3+bEob9AFjAuEB8icncXGZ8smb+RigltanF/ekZxqobTmoAVqoiLFvA1EFJNmmQgGkAUqWNeGhnDOpDFmpMyFshYmph6mpk8WpcLEyedFqA6EJElBxYWmnQYqnp6qnC8enq2oVZgqof5ipK4pZorpgNLEBlVAQPTqUoUGqk2WqplikqkqtuKgvsup1sFqd38o5tIppP7A2wPUBJNCsC2at0IWtYQph29phXeGq0xmuabqsU0oXM2ICBuEGl0ejcBFwgJmS2Sqm8sStZdeq41qApOmkrUqgs8qsHdYBj0MQ/hBIxRoUBMuh8ymsqTqmCjtcgNewKdpmEgtd5VqmbhH+AaZwEAU1sjTRsV+qmSBbbhwWISV7qcl6mClLrhSLbjjqqQbBBiYAildBs3cKpoIpryKLGNphr6PZswOqr+zaEzKxAU9QEqhCF0r7q0yLqjhLplm3s8haSVXbaCu7FUvSCiUhAvKnhLVWsB8bqXuas4bKsDyLtiqqtkEbF9RGEpkgGHL7qHlqt8OKt0Krt2dbmtYJtPsaFzkQAZFwEnMXF11bqsB6sE6ruIthtjaHryhrtXKxJChxBjjikSFwo1ZxQi4wA7agdhpza5y3ZBg3AzuAuKnKd6CCaepZjfSDD+bwXhV2gIZlstswAxJkZxNiYjmwAVewFLv6onRmrMr+CAvcRgh/JjvOsYdaaDHw5ENXqxWBp5jQVQ40QElz2C1rZEgxyaLHsrFU0S0oUioo8QQaUBUE2bq0hqJihh7DYZZeI2QymxMygQJQmkiGkw/DS3FU4R3lC2Hw6xaR6RNXs3jPOwVNsau46BPY8T3koA+qmZroUgjpJLB3MW8P9S7QRFpIKhdb5wDpEjDyoprywIDc4bpEI8PwIi/sgFkzAW/AJiMrg65LoQdeqSFAsTJSMQO+YA3UYAtSPMVS3J23QACddWkuIAM64Ay3QA2yYAtgLAs7SMa34AwgWsA40S0p0AVfLAvQMA08GMXQYAuwgAu7sFll5xVtfAveScX+VEwN1WAMysuoP7GQbiEBamAWd6IiSQoCkiIogIJKfMMtyiPJDrh7TIsVi9caIfA9iOUnDLqgiPVoryETOADKoyzJFdJkNEEjfYEKHHzBzIHILvB87nXLUoNxn7xZWqJcDOKiEyK/h/wdDKNct1x+LPACmuXIsrNkvxx9L6pQSHsTSAIBouAXToAjvHrIJICVN6FQ3TKL9iGHswMm1GwfKDK+W8YadwmLr5Fsziw6ZlcX9EGnPYFnGqAEp4EU2gFrucHOBDLQBP3AJnI2o2G/lAEBH6C6R/LCBR3REo0mbjLMD+AK1ZEJD3BCQ8G61TzRIE0ge2MYPxABk/Ae/2C+Bxu9ZBwd0i490eNsHz/wAIuM0v/QBqgCIwP10jwd0V+ZUJNrBjY9EHMgHFqmxj2d1FTTFRCQBkNNEJLwAO/Zl0pd1ZapN6MSAYDw1AURCkehI1Yd1sgGAhswAVbG1QZRBhIgjwoG0WL91vNbNTMiAU2A1iXBCjcQAVEBFnDd11hrzCGwEiJACnZ9EqpQBoGxAfJHi37d2J1HI5FhBadQ2E3RD5fQBnD4ER2x2Zzd2Z792Z39ET5ABpUwGe8REAA7" alt="Logo" style="max-height: 80px;">
          </div>
        </div>
        <!-- Quotation title and number -->
        <div class="quotation-title">BÁO GIÁ</div>
        <div class="quotation-number">Số: ${
          quotationNumber || 'N/A'
        } - Ngày: ${new Date(quotationDate).toLocaleDateString('vi-VN')}</div>
        <!-- Customer information -->
        <div class="customer-info">
          <table style="border: none;">
            <tr>
              <td style="width: 150px;"><strong>Kính gửi:</strong></td>
              <td><strong>${customerData.name || 'N/A'}</strong></td>
            </tr>
            <tr>
              <td>Địa chỉ:</td>
              <td>${customerData.address || 'N/A'}</td>
            </tr>
            <tr>
              <td>Điện thoại:</td>
              <td>${customerData.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td>Email:</td>
              <td>${customerData.email || 'N/A'}</td>
            </tr>
             <tr>
              <td>Dự án:</td>
              <td>${projectName || 'N/A'}</td>
            </tr>
            <tr>
              <td>Hiệu lực báo giá:</td>
              <td>${quoteValidity || 'N/A'}</td>
            </tr>
          </table>
        </div>
        <!-- Materials table -->
        <table style="border: 1px solid #000;">
          <thead>
            <tr>
              <th style="width: 5%;">STT</th>
              <th style="width: 40%;">Tên sản phẩm</th>
              <th style="width: 10%;">Đơn vị</th>
              <th style="width: 10%;">Số lượng</th>
              <th style="width: 15%;">Đơn giá</th>
              <th style="width: 20%;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${materialRows}
          </tbody>
        </table>

        <!-- Summary section - Use server-calculated values -->
        <table class="summary-table">
          <tr>
            <td>Tổng cộng:</td>
            <td style="text-align: right;">${formatCurrency(
              serverCalculatedSubTotal
            )}</td>
          </tr>
          <tr>
            <td>Chiết khấu (${discountPercentage || 0}%):</td>
            <td style="text-align: right;">- ${formatCurrency(
              discountAmount
            )}</td>
          </tr>
          <tr>
            <td>Thuế VAT (${vatPercentage || 0}%):</td>
            <td style="text-align: right;">${formatCurrency(vatAmount)}</td>
          </tr>
          <tr style="font-weight: bold;">
            <td>TỔNG CỘNG:</td>
            <td style="text-align: right;">${formatCurrency(grandTotal)}</td>
          </tr>
        </table>
        <div class="amount-in-words">
          <strong>Bằng chữ:</strong> ${amountInWords || 'Không đồng'}
        </div>

        <!-- Notes section -->
        <div class="notes">
          <strong>GHI CHÚ:</strong><br>
          ${(notes || 'Không có ghi chú.').replace(/\n/g, '<br>')}
        </div>

        <!-- Terms and conditions -->
        <div class="terms">
          <div class="term-title">ĐIỀU KHOẢN THANH TOÁN:</div>
          <div>${(paymentTerms || '').replace(/\n/g, '<br>')}</div>
        </div>
        <div class="terms">
          <div class="term-title">THỜI GIAN GIAO HÀNG:</div>
          <div>${deliveryTime || ''}</div>
        </div>
         <div class="terms">
          <div class="term-title">ĐIỀU KHOẢN BẢO HÀNH:</div>
          <div>${(warrantyTerms || '').replace(/\n/g, '<br>')}</div>
        </div>
        <div class="terms">
          <div class="term-title">THÔNG TIN NGÂN HÀNG:</div>
          <div>${formattedBankDetails}</div>
        </div>
        <div class="terms">
          <div class="term-title">ĐIỀU KHOẢN KHÁC:</div>
          <div>${(otherTerms || 'Không có').replace(/\n/g, '<br>')}</div>
        </div>

        <!-- Signatures -->
        <div class="signatures">
          <div class="signature-box">
            <div class="signature-title">KHÁCH HÀNG</div>
            <div>(Ký, đóng dấu, ghi rõ họ tên)</div>
          </div>
          <div class="signature-box">
            <div class="signature-title">ĐẠI DIỆN CÔNG TY</div>
            <div>(Ký, đóng dấu, ghi rõ họ tên)</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Firebase Callable Function that generates a PDF invoice from quotation data.
 * Uploads the PDF to Firebase Storage and returns a public URL.
 * @param {{quotationData: ClientQuotationData, projectId: string}} data The data passed.
 * @param {CallableContext} context The context of the function call.
 * @return {Promise<{pdfUrl: string}>} A URL of the generated PDF.
 */
export const generateInvoicePDF = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '1GB',
  })
  .https.onCall(
    async (
      data: {
        quotationData: ClientQuotationData;
        projectId: string;
      },
      context: CallableContext
    ) => {
      // DYNAMIC IMPORT: Only load modules when the function is called
      const puppeteer = (await import('puppeteer-core')).default;
      const chromium = (await import('@sparticuz/chromium')).default;

      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Bạn cần đăng nhập để sử dụng tính năng này.'
        );
      }

      const { quotationData, projectId } = data;

      if (!quotationData) {
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

      // Đảm bảo projectId được đặt đúng
      quotationData.projectId = projectId;

      const htmlContent = getQuotationHTML(quotationData);
      const tempHtmlPath = path.join(os.tmpdir(), 'invoice.html');
      fs.writeFileSync(tempHtmlPath, htmlContent);

      const browser = await puppeteer.launch({
        executablePath: await chromium.executablePath(),
        args: chromium.args,
        headless: true,
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600 });
      await page.goto(`file://${tempHtmlPath}`, {
        waitUntil: 'networkidle0',
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      await browser.close();
      fs.unlinkSync(tempHtmlPath);

      const fileName = `invoices/${projectId}/${quotationData.quotationNumber}.pdf`;
      const file = bucket.file(fileName);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
        },
      });

      await file.makePublic();

      const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      return { pdfUrl };
    }
  );

// Export functions from separate files
export { projectWorkflowManager } from './taskTriggers';
export { onProjectDeleted } from './projectTriggers';

// You can add more exports here as you create more function files
// export * from "./userTriggers";
// export * from "./anotherTriggerFile";
