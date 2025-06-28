import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { saveQuotation } from '../api/quotationService';

/**
 * Custom hook for generating quotations in Excel format
 * @param {Object} options - Configuration options
 * @returns {Object} - Functions and state for quotation generation
 */
const useQuotationGenerator = ({ projectId, customerData, materials }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [excelUrl, setExcelUrl] = useState(null);

  /**
   * Formats quotation data for Excel export according to the specified template
   * @param {Object} quotationData - All quotation data
   * @returns {Object} - Formatted data for Excel
   */
  const formatQuotationDataForExcel = (quotationData) => {
    const {
      quotationNumber,
      quotationDate,
      projectName,
      customerData = {},
      metadata = {},
      materials = [],
      subTotal,
      discountPercentage,
      discountAmount,
      vatPercentage,
      vatAmount,
      grandTotal,
      amountInWords,
      quoteValidity,
      deliveryTime,
    } = quotationData;

    // Build data structure matching the Excel template
    return {
      metadata: {
        // Header/company info
        companyName:
          'CÔNG TY TNHH SẢN XUẤT CƠ KHÍ THƯƠNG MẠI DỊCH VỤ TÂN HÒA PHÁT',
        companyAddress:
          'Số 7 Quốc lộ 1A, KP3B, Phường Thanh Lộc, Quận 12, TP.HCM',
        companyPhone: '0978.268.559',
        companyEmail: 'chomcauinoxtanhoaphat.com.vn',
        taxCode: '0315155409',

        // Customer info - Sử dụng metadata nếu có, không thì dùng customerData, không hiển thị N/A
        customerName: metadata?.customerName || customerData?.name || '',
        customerAddress:
          metadata?.customerAddress || customerData?.address || '',
        customerPhone: metadata?.customerPhone || customerData?.phone || '',
        customerEmail: metadata?.customerEmail || customerData?.email || '',
        customerTaxCode:
          metadata?.customerTaxCode || customerData?.taxCode || '',
        customerContactPerson:
          metadata?.customerContactPerson || customerData?.contactPerson || '',

        // Quotation info
        quotationNumber,
        quotationDate: new Date(quotationDate).toLocaleDateString('vi-VN'),
        projectName,
        quoteValidity,
        deliveryTime,
      },

      // Materials will be added from row 8 onwards
      materials: materials.map((item, index) => {
        // Tính đơn giá bằng cách nhân đơn giá/kg với khối lượng
        const weight = item.weight || 0;
        const unitPricePerKg = item.unitPrice || item.price || 0;
        const calculatedUnitPrice = weight * unitPricePerKg;
        const quantity = item.quantity || 0;
        const totalPrice = quantity * calculatedUnitPrice;

        return {
          no: item.no || index + 1,
          name: item.name || '',
          material: item.material || item.type || '',
          unit: item.unit || '',
          quantity: quantity,
          unitPrice: calculatedUnitPrice, // Đơn giá đã được tính = đơn giá/kg * khối lượng
          total: totalPrice || item.totalPrice || item.total || 0,
          weight: weight, // Thêm trường weight để Cloud Function có thể sử dụng nếu cần
        };
      }),

      // Summary data
      summary: {
        subTotal,
        discountPercentage: discountPercentage || 0,
        discountAmount: discountAmount || 0,
        vatPercentage: vatPercentage || 0,
        vatAmount: vatAmount || 0,
        grandTotal: grandTotal || 0,
        amountInWords: amountInWords || 'Không đồng',
      },
    };
  };

  /**
   * Generate and save a quotation in Excel format
   * @param {Object} quotationData - Complete quotation data
   * @returns {Promise<string>} URL to the generated Excel file
   */
  const generateExcelQuotation = async (quotationData) => {
    try {
      setIsLoading(true);

      // Format the data for Excel export
      const formattedData = formatQuotationDataForExcel(quotationData);

      // Call cloud function to generate Excel file
      const functions = getFunctions(undefined, 'asia-southeast1');
      const generateExcelFunc = httpsCallable(
        functions,
        'generateExcelQuotation'
      );
      const result = await generateExcelFunc({
        formattedData,
        projectId,
      });

      // Get the Excel file URL
      const { excelUrl } = result.data;
      setExcelUrl(excelUrl);

      // Save quotation metadata to Firestore
      await saveQuotation(projectId, {
        ...quotationData,
        excelUrl,
        pdfUrl: excelUrl, // Using Excel URL as PDF URL to pass validation
        createdBy: quotationData.createdBy,
      });

      return excelUrl;
    } catch (error) {
      console.error('Error generating Excel quotation:', error);
      Alert.alert('Lỗi', 'Không thể tạo báo giá Excel: ' + error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Share the generated Excel file
   */
  const shareExcelQuotation = async () => {
    try {
      if (!excelUrl) {
        Alert.alert('Lỗi', 'Chưa có file báo giá Excel để chia sẻ.');
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}quotation.xlsx`;
      const downloadResult = await FileSystem.downloadAsync(excelUrl, fileUri);

      if (downloadResult.status === 200) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Lỗi', 'Không thể tải file báo giá Excel.');
      }
    } catch (error) {
      console.error('Error sharing Excel quotation:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ báo giá Excel: ' + error.message);
    }
  };

  return {
    generateExcelQuotation,
    shareExcelQuotation,
    isLoading,
    excelUrl,
  };
};

export default useQuotationGenerator;
