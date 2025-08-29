//src/screens/FinalizeQuotationScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Sharing from 'expo-sharing';
import { auth } from '../config/firebaseConfig';
import { saveQuotation } from '../api/quotationService';
import useQuotationGenerator from '../hooks/useQuotationGenerator';
import useContractGenerator from '../hooks/useContractGenerator';

// HTML2PDF API key
// const HTML2PDF_API_KEY = 'Uvwhf4HC3SED5GIYlCx1F8A6jq2r3iJEt3FH8C16u1LprY5J5hBNXGIVfsLtqRxH';
// const HTML2PDF_API_URL = 'https://api.html2pdf.app/v1/generate';

// Hàm chuyển đổi số thành chữ tiếng Việt
const convertNumberToWords = (number) => {
  // Mảng từ ngữ cho các số
  const units = [
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
  const teens = [
    'mười',
    'mười một',
    'mười hai',
    'mười ba',
    'mười bốn',
    'mười lăm',
    'mười sáu',
    'mười bảy',
    'mười tám',
    'mười chín',
  ];
  const tens = [
    '',
    'mười',
    'hai mươi',
    'ba mươi',
    'bốn mươi',
    'năm mươi',
    'sáu mươi',
    'bảy mươi',
    'tám mươi',
    'chín mươi',
  ];
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  // Hàm xử lý số có 3 chữ số
  const handleHundreds = (num, isFirstGroup) => {
    let result = '';
    const originalNum = num;

    // Xử lý hàng trăm
    if (num >= 100) {
      result += units[Math.floor(num / 100)] + ' trăm ';
      num %= 100;
    }

    // Xử lý hàng chục và đơn vị
    if (num > 0) {
      // Chỉ thêm "lẻ" nếu nó không phải là nhóm đầu tiên (nhóm đơn vị) và số có 1 chữ số
      // hoặc nếu hàng trăm của nhóm đó > 0
      if (num < 10 && !isFirstGroup && originalNum > 99) {
        if (num === 1 && Math.floor(originalNum / 100) > 0) {
          result += 'linh một'; // Sử dụng "linh một" thay vì "lẻ một"
        } else {
          result += 'lẻ ' + units[num];
        }
      } else if (num < 10) {
        result += units[num];
      } else if (num < 20) {
        // Nếu số dư < 20, sử dụng mảng teens
        result += teens[num - 10];
      } else {
        // Nếu số dư >= 20
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        result += tens[ten];
        if (unit > 0) {
          // Xử lý trường hợp đặc biệt cho "mốt" và "lăm"
          if (unit === 1 && ten > 1) {
            result += ' mốt';
          } else if (unit === 5 && ten > 0) {
            result += ' lăm';
          } else {
            result += ' ' + units[unit];
          }
        }
      }
    }

    return result.trim();
  };

  // Hàm chính để chuyển đổi số thành chữ
  const convert = (num) => {
    if (num === 0) return 'không';

    let result = '';
    let scaleIndex = 0;

    // Xử lý số theo từng nhóm 3 chữ số
    while (num > 0) {
      const group = num % 1000;
      if (group !== 0) {
        const isFirstGroup = scaleIndex === 0;
        const groupText = handleHundreds(group, isFirstGroup);
        result =
          groupText +
          (scaleIndex > 0 ? ' ' + scales[scaleIndex] + ' ' : '') +
          result;
      }

      num = Math.floor(num / 1000);
      scaleIndex++;
    }

    return result.trim().replace(/\s\s+/g, ' '); // Loại bỏ khoảng trắng thừa
  };

  // Xử lý số tiền (chỉ lấy phần nguyên)
  const integerPart = Math.floor(number);

  let result = convert(integerPart) + ' đồng';

  // Viết hoa chữ cái đầu
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const FinalizeQuotationScreen = ({ route, navigation }) => {
  const {
    materials: newMaterials,
    subTotal: newSubTotal,
    projectId,
    projectName,
    customerData,
    initialData,
    isRequote,
    originalQuotationId,
    isManualQuotation,
  } = route.params;

  // Determine if we are re-quoting and calculate subTotal accordingly
  const isRequoting = !!initialData;
  const materialsData = isRequoting ? initialData.materials : newMaterials;

  const subTotalData = isRequoting
    ? initialData.materials.reduce(
        (acc, item) => acc + (item.totalPrice || 0),
        0
      )
    : newSubTotal;

  // Initialize the quotation generator hook
  const {
    generateExcelQuotation,
    shareExcelQuotation,
    isLoading: isExcelLoading,
    excelUrl,
    pdfUrl,
    sharePdfQuotation,
    isPdfLoading,
  } = useQuotationGenerator({
    projectId,
    customerData,
    materials: materialsData,
  });

  // Initialize the contract generator hook
  const {
    generateContract,
    shareContractDoc,
    isLoading: isContractLoading,
    contractDocUrl,
  } = useContractGenerator({
    projectId,
    customerData,
    materials: materialsData,
    quotationData: {
      deliveryTime,
      paymentTerms,
      warrantyTerms,
    },
  });

  // Use initialData if it exists (for re-quoting), otherwise use new data
  const sourceData = initialData || route.params;

  // State cho các trường nhập liệu
  const [discountPercentage, setDiscountPercentage] = useState(
    sourceData.discountPercentage?.toString() || '0'
  );
  const [vatPercentage, setVatPercentage] = useState(
    sourceData.vatPercentage?.toString() || '10'
  );
  const [quoteValidity, setQuoteValidity] = useState(
    sourceData.quoteValidity || '7 ngày'
  );
  const [deliveryTime, setDeliveryTime] = useState(
    sourceData.deliveryTime || '15 ngày'
  );
  const [notes, setNotes] = useState(sourceData.notes || '');
  const [paymentTerms, setPaymentTerms] = useState(
    sourceData.paymentTerms ||
      'Đợt 1: Thanh toán 50% ngay sau khi ký hợp đồng.\nĐợt 2: Thanh toán 50% còn lại sau khi nghiệm thu và bàn giao.'
  );
  const [warrantyTerms, setWarrantyTerms] = useState(
    sourceData.warrantyTerms || 'Bảo hành 12 tháng cho toàn bộ công trình.'
  );
  const [otherTerms, setOtherTerms] = useState(sourceData.otherTerms || '');
  const [bankDetails, setBankDetails] = useState(
    sourceData.bankDetails ||
      'Tên tài khoản: CÔNG TY TNHH ABC\nSố tài khoản: 123456789\nNgân hàng: Vietcombank - Chi nhánh XYZ'
  );

  // State cho các giá trị tính toán
  const [discountAmount, setDiscountAmount] = useState(0);
  const [afterDiscountTotal, setAfterDiscountTotal] = useState(subTotalData);
  const [vatAmount, setVatAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(subTotalData);
  const [amountInWords, setAmountInWords] = useState('');

  // State cho quá trình tạo Excel

  const [materials, setMaterials] = useState(materialsData || []);

  // Tính toán lại các giá trị khi người dùng thay đổi đầu vào
  useEffect(() => {
    // Defensive calculations to prevent NaN issues
    const safeSubTotal = Number(subTotalData) || 0;
    const discountPercent = parseFloat(discountPercentage) || 0;
    const vatPercent = parseFloat(vatPercentage) || 0;

    // Calculate all financial values as local constants
    const calculatedDiscountAmount = (safeSubTotal * discountPercent) / 100;
    const calculatedAfterDiscountTotal =
      safeSubTotal - calculatedDiscountAmount;
    const calculatedVatAmount =
      (calculatedAfterDiscountTotal * vatPercent) / 100;
    const calculatedGrandTotal =
      calculatedAfterDiscountTotal + calculatedVatAmount;
    const calculatedAmountInWords = convertNumberToWords(calculatedGrandTotal);

    // Update all states at once
    setDiscountAmount(calculatedDiscountAmount);
    setAfterDiscountTotal(calculatedAfterDiscountTotal);
    setVatAmount(calculatedVatAmount);
    setGrandTotal(calculatedGrandTotal);
    setAmountInWords(calculatedAmountInWords);
  }, [subTotalData, discountPercentage, vatPercentage]);

  // Hàm tạo báo giá Excel
  const handleGenerateExcel = async () => {
    try {
      const userId = auth.currentUser?.uid;

      if (!userId) {
        Alert.alert('Lỗi', 'Bạn cần đăng nhập để tạo báo giá Excel.');
        return;
      }

      const effectiveProjectId = projectId || route?.params?.projectId;

      if (!effectiveProjectId) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin dự án. Vui lòng thử lại.');
        return;
      }

      // 1. Chuẩn bị dữ liệu báo giá
      const quotationNumber = `THP-${new Date().getFullYear()}-${Math.floor(
        Math.random() * 1000
      )
        .toString()
        .padStart(3, '0')}`;

      // Assemble the complete quotation data
      const quotationData = {
        // Core Info
        quotationNumber,
        createdBy: userId,
        projectName: projectName,
        quotationDate: new Date().toISOString(),

        // Customer Info - Đảm bảo dữ liệu khách hàng được gửi đúng định dạng
        metadata: {
          projectName: projectName,
          customerName: customerData?.name || '',
          customerAddress: customerData?.address || '',
          customerPhone: customerData?.phone || '',
          customerEmail: customerData?.email || '',
          customerTaxCode: customerData?.taxCode || '',
          customerContactPerson: customerData?.contactPerson || '',
          quotationNumber: quotationNumber,
          quoteValidity: quoteValidity,
          deliveryTime: deliveryTime,
        },

        // Financial Snapshot
        subTotal: subTotalData,
        discountPercentage: parseFloat(discountPercentage) || 0,
        discountAmount: discountAmount,
        afterDiscountTotal: afterDiscountTotal,
        vatPercentage: parseFloat(vatPercentage) || 0,
        vatAmount: vatAmount,
        grandTotal: grandTotal,
        amountInWords: amountInWords,

        // Materials Snapshot
        materials: materials.map((material) => ({
          no: material.stt || material.no || material.id || 0,
          stt: material.stt || material.no || material.id || 0, // Thêm trường stt để đảm bảo tương thích
          name: material.name || material.description || '',
          material: material.material || material.type || '',
          unit: material.unit || 'cái',
          quantity: material.quantity || 0,
          unitPrice: material.unitPrice || material.price || 0,
          total: material.totalPrice || material.total || 0,
          weight: material.weight || 0,
        })),

        // Terms Snapshot
        quoteValidity: quoteValidity,
        deliveryTime: deliveryTime,
        paymentTerms: paymentTerms,
        warrantyTerms: warrantyTerms,
        otherTerms: otherTerms,
        bankDetails: bankDetails,
        notes: notes,

        // Tổng hợp thông tin tài chính
        summary: {
          subTotal: subTotalData,
          vatPercentage: parseFloat(vatPercentage) || 0,
          vatAmount: vatAmount,
          grandTotal: grandTotal,
        },
      };

      // Gọi function tạo báo giá Excel
      const url = await generateExcelQuotation(quotationData);

      if (url) {
        Alert.alert(
          'Thành công',
          'Đã tạo báo giá Excel thành công. Bạn có muốn chia sẻ file Excel không?',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Chia sẻ', onPress: () => shareExcelQuotation() },
          ]
        );
      }
    } catch (error) {
      console.error('Error generating Excel:', error);
      Alert.alert(
        'Lỗi',
        `Không thể tạo báo giá Excel: ${error.message || 'Unknown error'}`
      );
    }
  };

  // Function to handle contract generation
  const handleGenerateContract = async () => {
    try {
      await generateContract();
    } catch (error) {
      console.error('Error generating contract:', error);
      Alert.alert('Lỗi', 'Không thể tạo hợp đồng: ' + error.message);
    }
  };

  // Format số tiền VND
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hoàn thiện báo giá</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Hiển thị tổng tiền vật tư */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tổng cộng vật tư</Text>
          <Text style={styles.subTotalValue}>
            {formatCurrency(subTotalData)}
          </Text>
        </View>

        {/* Phần nhập chiết khấu và VAT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Điều chỉnh giá</Text>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Chiết khấu (%)</Text>
            <TextInput
              style={styles.input}
              value={discountPercentage}
              onChangeText={setDiscountPercentage}
              keyboardType="numeric"
              placeholder="0"
              maxLength={5}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Thuế VAT (%)</Text>
            <TextInput
              style={styles.input}
              value={vatPercentage}
              onChangeText={setVatPercentage}
              keyboardType="numeric"
              placeholder="10"
              maxLength={5}
            />
          </View>
        </View>

        {/* Phần tóm tắt tính toán */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tóm tắt</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng cộng vật tư:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(subTotalData)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Chiết khấu ({discountPercentage}%):
            </Text>
            <Text style={styles.summaryValue}>
              - {formatCurrency(discountAmount)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng cộng sau chiết khấu:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(afterDiscountTotal)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Tiền thuế VAT ({vatPercentage}%):
            </Text>
            <Text style={styles.summaryValue}>{formatCurrency(vatAmount)}</Text>
          </View>

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TỔNG CỘNG ĐÃ BAO GỒM VAT:</Text>
            <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
          </View>

          <View style={styles.wordsContainer}>
            <Text style={styles.wordsLabel}>Bằng chữ:</Text>
            <Text style={styles.wordsValue}>{amountInWords}</Text>
          </View>
        </View>

        {/* Phần điều khoản */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Điều khoản báo giá</Text>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Hiệu lực báo giá</Text>
            <TextInput
              style={styles.input}
              value={quoteValidity}
              onChangeText={setQuoteValidity}
              placeholder="7 ngày"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Thời gian giao hàng</Text>
            <TextInput
              style={styles.input}
              value={deliveryTime}
              onChangeText={setDeliveryTime}
              placeholder="15 ngày"
            />
          </View>

          <View style={styles.notesContainer}>
            <Text style={styles.inputLabel}>Ghi chú</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Nhập ghi chú (ví dụ: + SƠN EPOXY)"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.notesContainer}>
            <Text style={styles.inputLabel}>Phương thức thanh toán</Text>
            <TextInput
              style={styles.notesInput}
              value={paymentTerms}
              onChangeText={setPaymentTerms}
              placeholder="Nhập phương thức thanh toán"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.notesContainer}>
            <Text style={styles.inputLabel}>Điều khoản bảo hành</Text>
            <TextInput
              style={styles.notesInput}
              value={warrantyTerms}
              onChangeText={setWarrantyTerms}
              placeholder="Nhập điều khoản bảo hành"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.notesContainer}>
            <Text style={styles.inputLabel}>Thông tin ngân hàng</Text>
            <TextInput
              style={styles.notesInput}
              value={bankDetails}
              onChangeText={setBankDetails}
              placeholder="Nhập thông tin ngân hàng"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.notesContainer}>
            <Text style={styles.inputLabel}>Điều khoản khác</Text>
            <TextInput
              style={styles.notesInput}
              value={otherTerms}
              onChangeText={setOtherTerms}
              placeholder="Nhập các điều khoản khác"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* Nút tạo Excel */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#FF9800' }]}
          onPress={handleGenerateExcel}
          disabled={isExcelLoading}
        >
          {isExcelLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name="document-text"
                size={20}
                color="white"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.buttonText}>Tạo Báo Giá Excel</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Hợp đồng chuyển sang mục riêng ở màn hình chính */}

        {excelUrl && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#009688' }]}
            onPress={shareExcelQuotation}
          >
            <Ionicons
              name="share-social"
              size={20}
              color="white"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.buttonText}>Chia Sẻ Excel</Text>
          </TouchableOpacity>
        )}

        {pdfUrl && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#3F51B5' }]}
            onPress={sharePdfQuotation}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color="white"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.buttonText}>Chia Sẻ PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  subTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: '#555',
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    width: '40%',
    textAlign: 'right',
  },
  notesContainer: {
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginTop: 8,
    height: 80,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#555',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    borderBottomWidth: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  wordsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  wordsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  wordsValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    fontStyle: 'italic',
  },
  footer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    marginHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FinalizeQuotationScreen;
