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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAuth } from 'firebase/auth';
import { getQuotationHTML } from '../config/quotationHtmlTemplate';
import { saveQuotation } from '../api/quotationService';

// Hàm chuyển đổi số thành chữ tiếng Việt
const convertNumberToWords = (number) => {
  // Mảng từ ngữ cho các số
  const units = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const teens = ['mười', 'mười một', 'mười hai', 'mười ba', 'mười bốn', 'mười lăm', 'mười sáu', 'mười bảy', 'mười tám', 'mười chín'];
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  // Hàm xử lý số có 3 chữ số
  const handleHundreds = (num) => {
    let result = '';
    
    // Xử lý hàng trăm
    if (num >= 100) {
      result += units[Math.floor(num / 100)] + ' trăm ';
      num %= 100;
    }
    
    // Xử lý hàng chục và đơn vị
    if (num > 0) {
      if (num < 10) {
        // Nếu số dư < 10, thêm "lẻ" và đơn vị
        result += 'lẻ ' + units[num];
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
        const groupText = handleHundreds(group);
        result = groupText + (scaleIndex > 0 ? ' ' + scales[scaleIndex] + ' ' : '') + result;
      }
      
      num = Math.floor(num / 1000);
      scaleIndex++;
    }
    
    return result.trim();
  };

  // Xử lý số tiền
  const integerPart = Math.floor(number);
  const decimalPart = Math.round((number - integerPart) * 100);
  
  let result = convert(integerPart) + ' đồng';
  
  if (decimalPart > 0) {
    result += ' và ' + convert(decimalPart) + ' xu';
  }
  
  // Viết hoa chữ cái đầu
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const FinalizeQuotationScreen = ({ route, navigation }) => {
  const { materials, subTotal, projectId, projectName, customerData } = route.params;
  
  // State cho các trường nhập liệu
  const [discountPercentage, setDiscountPercentage] = useState('0');
  const [vatPercentage, setVatPercentage] = useState('10');
  const [quoteValidity, setQuoteValidity] = useState('7 ngày');
  const [deliveryTime, setDeliveryTime] = useState('15 ngày');
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Thanh toán 50% giá trị đơn hàng khi ký hợp đồng, 50% còn lại khi nghiệm thu bàn giao.');
  const [warrantyTerms, setWarrantyTerms] = useState('Bảo hành 12 tháng kể từ ngày nghiệm thu bàn giao cho các lỗi kỹ thuật.');
  const [otherTerms, setOtherTerms] = useState('Báo giá có hiệu lực trong vòng 30 ngày kể từ ngày phát hành. Giá trên chưa bao gồm chi phí vận chuyển và lắp đặt nếu có.');
  const [bankDetails, setBankDetails] = useState('Tên tài khoản: CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ XÂY DỰNG HOÀNG KHANG\nSố tài khoản: 123456789\nNgân hàng: Vietcombank - Chi nhánh TP. Hồ Chí Minh');
  
  // State cho các giá trị tính toán
  const [discountAmount, setDiscountAmount] = useState(0);
  const [afterDiscountTotal, setAfterDiscountTotal] = useState(subTotal);
  const [vatAmount, setVatAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(subTotal);
  const [amountInWords, setAmountInWords] = useState('');
  
  // State cho quá trình tạo PDF
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  
  // Tính toán lại các giá trị khi người dùng thay đổi đầu vào
  useEffect(() => {
    // Chuyển đổi phần trăm thành số
    const discountPercent = parseFloat(discountPercentage) || 0;
    const vatPercent = parseFloat(vatPercentage) || 0;
    
    // Tính số tiền chiết khấu
    const calculatedDiscountAmount = (subTotal * discountPercent) / 100;
    setDiscountAmount(calculatedDiscountAmount);
    
    // Tính tổng sau chiết khấu
    const calculatedAfterDiscountTotal = subTotal - calculatedDiscountAmount;
    setAfterDiscountTotal(calculatedAfterDiscountTotal);
    
    // Tính tiền thuế VAT
    const calculatedVatAmount = (calculatedAfterDiscountTotal * vatPercent) / 100;
    setVatAmount(calculatedVatAmount);
    
    // Tính tổng cộng cuối cùng
    const calculatedGrandTotal = calculatedAfterDiscountTotal + calculatedVatAmount;
    setGrandTotal(calculatedGrandTotal);
    
    // Chuyển đổi thành chữ
    setAmountInWords(convertNumberToWords(calculatedGrandTotal));
  }, [subTotal, discountPercentage, vatPercentage]);
  
  // Hàm xử lý khi người dùng nhấn nút tạo PDF
  const handleGeneratePDF = async () => {
    try {
      setIsGenerating(true);
      
      // Check if RNHTMLtoPDF is available (will be null in Expo Go)
      if (!RNHTMLtoPDF) {
        Alert.alert(
          "Lỗi",
          "Không thể tạo PDF. Thư viện chưa được liên kết đúng cách. Vui lòng chạy trên Development Build.",
          [
            {
              text: "OK",
              onPress: () => setIsGenerating(false)
            }
          ]
        );
        return;
      }
      
      // Get current user
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      
      if (!userId) {
        Alert.alert('Lỗi', 'Bạn cần đăng nhập để tạo báo giá.');
        setIsGenerating(false);
        return;
      }
      
      // Chuẩn bị dữ liệu cho PDF
      const quotationData = {
        projectId,
        projectName,
        customerName: customerData?.name || 'Khách hàng',
        customerAddress: customerData?.address || '',
        customerPhone: customerData?.phone || '',
        customerEmail: customerData?.email || '',
        quotationDate: new Date().toLocaleDateString('vi-VN'),
        validUntil: quoteValidity,
        materials,
        notes,
        subtotal: subTotal,
        discount: parseFloat(discountPercentage) || 0,
        discountAmount,
        vatRate: parseFloat(vatPercentage) || 0,
        vatAmount,
        totalWithVat: grandTotal,
        totalInWords: amountInWords,
        paymentTerms,
        deliveryTerms: deliveryTime,
        warrantyTerms,
        otherTerms,
        bankDetails,
        quotationNumber: `HK-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
      };
      
      // Generate HTML from template
      const html = getQuotationHTML(quotationData);
      
      // Generate PDF
      const options = {
        html,
        fileName: `Quotation_${quotationData.quotationNumber}`,
        directory: 'Documents',
        base64: false,
      };
      
      console.log('Attempting to generate PDF with options:', options);
      
      const file = await RNHTMLtoPDF.convert(options);
      console.log('PDF generated at:', file.filePath);
      
      // Save to Firebase
      const savedQuotation = await saveQuotation(
        projectId,
        quotationData,
        file.filePath,
        userId
      );
      
      // Store PDF URL for sharing
      setPdfUrl(savedQuotation.pdfUrl);
      
      // Show success message
      Alert.alert(
        'Thành công',
        'Đã tạo báo giá thành công!',
        [
          {
            text: 'Chia sẻ PDF',
            onPress: () => sharePdf(file.filePath),
          },
          {
            text: 'OK',
          },
        ]
      );
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Provide more detailed error message
      let errorMessage = 'Không thể tạo báo giá.';
      
      if (error.message && error.message.includes("null")) {
        errorMessage += ' Thư viện PDF không khả dụng trong Expo Go. Vui lòng sử dụng Development Build.';
      } else if (error.message) {
        errorMessage += ' ' + error.message;
      }
      
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Hàm chia sẻ PDF
  const sharePdf = async (filePath) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert('Lỗi', 'Chia sẻ không khả dụng trên thiết bị này');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ tài liệu.');
    }
  };
  
  // Format số tiền VND
  const formatCurrency = (amount) => {
    return amount.toLocaleString('vi-VN') + ' đ';
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
          <Text style={styles.subTotalValue}>{formatCurrency(subTotal)}</Text>
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
            <Text style={styles.summaryValue}>{formatCurrency(subTotal)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Chiết khấu ({discountPercentage}%):</Text>
            <Text style={styles.summaryValue}>- {formatCurrency(discountAmount)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng cộng sau chiết khấu:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(afterDiscountTotal)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tiền thuế VAT ({vatPercentage}%):</Text>
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
      
      {/* Nút tạo PDF */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.generateButton}
          onPress={handleGeneratePDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={24} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.generateButtonText}>Tạo và Lưu Báo giá PDF</Text>
            </>
          )}
        </TouchableOpacity>
        
        {pdfUrl && (
          <TouchableOpacity 
            style={[styles.generateButton, { marginTop: 10, backgroundColor: '#0066cc' }]}
            onPress={() => sharePdf(pdfUrl)}
          >
            <Ionicons name="share-outline" size={24} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.generateButtonText}>Chia sẻ PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
  generateButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FinalizeQuotationScreen; 