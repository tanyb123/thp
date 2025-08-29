import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { httpsCallable, getFunctions } from 'firebase/functions';
import app, { functions as firebaseFunctions } from '../config/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { saveQuotation } from '../api/quotationService';

// Import hook quản lý kho
import useInventory from './useInventory';

/**
 * Custom hook for generating quotations in Excel format
 * @param {Object} options - Configuration options
 * @returns {Object} - Functions and state for quotation generation
 */
const useQuotationGenerator = ({ projectId, customerData, materials }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [excelUrl, setExcelUrl] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // Trong hook useQuotationGenerator, thêm đoạn code sau
  const { inventoryItems, fetchInventoryItems } = useInventory();

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
        // Handle note rows differently. If isNote flag is already true OR
        // unit & quantity are both empty/zero and material field empty, treat as note.
        const startsWithPlus = (item.name || '').trim().startsWith('+');
        const nameIsNote = (item.name || '').toUpperCase().includes('GHI CHÚ');
        const inferredNote =
          item.isNote ||
          nameIsNote ||
          startsWithPlus ||
          ((!item.unit || item.unit === '') &&
            (!item.material || item.material === '') &&
            (item.quantity === null ||
              item.quantity === undefined ||
              item.quantity === 0));
        if (inferredNote) {
          return {
            isNote: true,
            no: null, // No sequence number for notes
            stt: null,
            name: item.name || '',
            material: '', // No material for notes
            unit: '', // No unit for notes
            quantity: null, // No quantity for notes
            unitPrice: null,
            total: null,
            weight: null,
          };
        }

        const weight = item.weight ?? 0;
        const inputUnitPrice = item.unitPrice || item.price || 0;

        // Nếu không có trọng lượng (báo giá thủ công) -> dùng đơn giá trực tiếp
        const calculatedUnitPrice =
          weight && weight > 0 ? weight * inputUnitPrice : inputUnitPrice;

        const quantity = item.quantity || 0;
        const totalPrice = quantity * calculatedUnitPrice;

        // Đảm bảo giá trị STT được lưu đúng định dạng
        console.log(
          `Formatting Item STT: ${item.stt}, Type: ${typeof item.stt}`
        );

        // Xác định giá trị STT cuối cùng
        let finalStt = '';
        if (
          item.stt !== undefined &&
          item.stt !== null &&
          String(item.stt).trim() !== ''
        ) {
          finalStt = String(item.stt).trim();
        } else if (
          item.no !== undefined &&
          item.no !== null &&
          String(item.no).trim() !== ''
        ) {
          finalStt = String(item.no).trim();
        } else {
          finalStt = String(index + 1);
        }

        return {
          isNote: false,
          no: finalStt,
          stt: finalStt, // Đảm bảo stt cũng được gán giá trị
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

      // Ensure we have a Google access token
      const signedIn = await GoogleSignin.isSignedIn();
      if (!signedIn) {
        await GoogleSignin.signIn();
      }
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) {
        throw new Error('Không thể lấy Google access token');
      }

      // Call cloud function to generate Excel file (with user token)
      const generateExcelFunc = httpsCallable(
        firebaseFunctions,
        'generateExcelQuotation'
      );
      const result = await generateExcelFunc({
        formattedData,
        projectId,
        accessToken,
      });

      // Get the Excel file URL
      const { excelUrl, spreadsheetId } = result.data;
      setExcelUrl(excelUrl);

      // Automatically convert to PDF
      const pdfUrl = await convertExcelToPdf(
        spreadsheetId,
        quotationData.quotationNumber
      );

      // Save quotation metadata to Firestore with both URLs
      await saveQuotation(projectId, {
        ...quotationData,
        excelUrl,
        pdfUrl: pdfUrl || excelUrl, // Using the PDF URL if available, otherwise Excel URL
        createdBy: quotationData.createdBy,
      });

      // Offer PDF share if available
      if (pdfUrl) {
        try {
          await Sharing.shareAsync(pdfUrl);
        } catch (_) {}
      }

      return { excelUrl, pdfUrl, spreadsheetId };
    } catch (error) {
      console.error('Error generating Excel quotation:', error);
      Alert.alert('Lỗi', 'Không thể tạo báo giá Excel: ' + error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert Excel to PDF using the new Cloud Function
   * @param {string} spreadsheetId - ID of the Google Sheet to convert
   * @param {string} fileName - Name for the generated PDF file
   * @returns {Promise<string>} URL to the generated PDF file
   */
  const convertExcelToPdf = async (spreadsheetId, fileName) => {
    if (!spreadsheetId) {
      console.error('Missing spreadsheetId for PDF conversion');
      return null;
    }

    try {
      setIsPdfLoading(true);

      // Get Google access token
      const { accessToken } = await GoogleSignin.getTokens();

      // Call the PDF function deployed in us-central1
      const functionsUS = getFunctions(app, 'us-central1');
      const exportToPdfFunc = httpsCallable(functionsUS, 'exportSheetToPdf');

      const result = await exportToPdfFunc({
        spreadsheetId,
        fileName,
        projectId,
        accessToken,
      });

      // Get the PDF file URL
      const { pdfUrl } = result.data;
      setPdfUrl(pdfUrl);

      return pdfUrl;
    } catch (error) {
      console.error('Error converting Excel to PDF:', error);
      Alert.alert(
        'Thông báo',
        'Đã tạo báo giá Excel thành công, nhưng không thể chuyển đổi sang PDF. Bạn vẫn có thể chia sẻ file Excel.'
      );
      return null;
    } finally {
      setIsPdfLoading(false);
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

  // Quick share PDF helper if needed elsewhere
  const sharePdf = async () => {
    if (!pdfUrl) {
      Alert.alert('Lỗi', 'Chưa có file báo giá PDF để chia sẻ.');
      return;
    }
    try {
      await Sharing.shareAsync(pdfUrl);
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ PDF: ' + error.message);
    }
  };

  /**
   * Share the generated PDF file
   */
  const sharePdfQuotation = async () => {
    try {
      if (!pdfUrl) {
        Alert.alert('Lỗi', 'Chưa có file báo giá PDF để chia sẻ.');
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}quotation.pdf`;
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);

      if (downloadResult.status === 200) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Lỗi', 'Không thể tải file báo giá PDF.');
      }
    } catch (error) {
      console.error('Error sharing PDF quotation:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ báo giá PDF: ' + error.message);
    }
  };

  // Thêm hàm tìm kiếm vật tư từ kho
  const searchInventoryItems = async (keyword) => {
    if (!inventoryItems.length) {
      await fetchInventoryItems();
    }

    if (!keyword) return [];

    const normalizedKeyword = keyword.toLowerCase().trim();
    return inventoryItems.filter(
      (item) =>
        item.name?.toLowerCase().includes(normalizedKeyword) ||
        item.code?.toLowerCase().includes(normalizedKeyword) ||
        item.material?.toLowerCase().includes(normalizedKeyword)
    );
  };

  // Thêm hàm áp dụng vật tư từ kho vào báo giá
  const applyInventoryItemToQuotation = (item) => {
    if (!item) return;

    const newMaterial = {
      name: item.name,
      material: item.material || '',
      unit: item.unit || '',
      quantity: 1,
      unitPrice: item.price || 0,
      weight: item.weight || 0,
      total: 1 * (item.price || 0),
    };

    // Assuming 'materials' state is managed by the parent component or passed as a prop
    // For now, we'll just add it to the current materials array for display
    // In a real app, you'd update the 'materials' prop or state
    // setMaterials(prevMaterials => [...prevMaterials, newMaterial]); // This line would cause an error if 'materials' is not a state variable
    // calculateTotals([...materials, newMaterial]); // This line would cause an error if 'materials' is not a state variable
  };

  return {
    generateExcelQuotation,
    convertExcelToPdf,
    shareExcelQuotation,
    sharePdf,
    sharePdfQuotation,
    isLoading,
    isPdfLoading,
    excelUrl,
    pdfUrl,
    searchInventoryItems,
    applyInventoryItemToQuotation,
    inventoryItems,
  };
};

export default useQuotationGenerator;
