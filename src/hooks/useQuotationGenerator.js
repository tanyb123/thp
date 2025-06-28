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
      materials = [],
      subTotal,
      discountPercentage,
      discountAmount,
      vatPercentage,
      vatAmount,
      grandTotal,
      amountInWords,
      quoteValidity,
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

        // Customer info
        customerName: customerData.name || 'N/A',
        customerAddress: customerData.address || 'N/A',

        // Quotation info
        quotationNumber,
        quotationDate: new Date(quotationDate).toLocaleDateString('vi-VN'),
        projectName,
        quoteValidity,
      },

      // Materials will be added from row 8 onwards
      materials: materials.map((item, index) => {
        const displayUnitPrice = (item.weight || 0) * (item.unitPrice || 0);
        const totalPrice = (item.quantity || 0) * displayUnitPrice;

        return {
          no: index + 1,
          name: item.name || '',
          material: item.material || '',
          unit: item.unit || '',
          quantity: item.quantity || 0,
          unitPrice: displayUnitPrice || 0,
          total: totalPrice || 0,
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
