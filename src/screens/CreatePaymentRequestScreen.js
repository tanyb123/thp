// src/screens/CreatePaymentRequestScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getProjectById } from '../api/projectService';
import { createPaymentRequest, logPayment } from '../api/paymentService';
import { getQuotationsByProject } from '../api/quotationService';
import DateTimePicker from '@react-native-community/datetimepicker';

const CreatePaymentRequestScreen = ({ route, navigation }) => {
  const { projectId } = route.params;
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [requestNumber, setRequestNumber] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);

  // Quotation and payment info
  const [latestQuotation, setLatestQuotation] = useState(null);
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);
  const [loadingQuotation, setLoadingQuotation] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        const projectData = await getProjectById(projectId);
        if (!projectData) {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin dự án');
          navigation.goBack();
          return;
        }
        setProject(projectData);

        // Generate a default request number
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const randomNum = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');
        setRequestNumber(`YCTT-${year}${month}${day}-${randomNum}`);
      } catch (error) {
        console.error('Error loading project:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin dự án');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, navigation]);

  // Load quotation and payment info
  const loadQuotationAndPaymentInfo = async () => {
    try {
      setLoadingQuotation(true);

      // Get latest quotation
      const quotations = await getQuotationsByProject(projectId);
      if (quotations && quotations.length > 0) {
        const latestQuote = quotations[0];
        setLatestQuotation(latestQuote);

        // Debug: log all fields of the quotation
        console.log('Latest quotation data:', latestQuote);
        console.log('Available fields:', Object.keys(latestQuote));

        // Check multiple possible field names for total amount
        const totalAmount =
          latestQuote.grandTotal ||
          latestQuote.totalAmount ||
          latestQuote.amount ||
          latestQuote.total ||
          latestQuote.quotationAmount ||
          latestQuote.finalAmount ||
          0;

        console.log('Found total amount:', totalAmount);
        console.log('Field values:', {
          grandTotal: latestQuote.grandTotal,
          totalAmount: latestQuote.totalAmount,
          amount: latestQuote.amount,
          total: latestQuote.total,
          quotationAmount: latestQuote.quotationAmount,
          finalAmount: latestQuote.finalAmount,
          afterDiscountTotal: latestQuote.afterDiscountTotal,
          subTotal: latestQuote.subTotal,
        });
      }

      // Get total paid amount from existing payment requests
      const { getPaymentRequestsByProject } = await import(
        '../api/paymentService'
      );
      const paymentRequests = await getPaymentRequestsByProject(projectId);

      const totalPaid = paymentRequests.reduce((sum, request) => {
        return sum + (request.totalPaid || 0);
      }, 0);

      setTotalPaidAmount(totalPaid);

      console.log('Total paid:', totalPaid);
    } catch (error) {
      console.error('Error loading quotation and payment info:', error);
    } finally {
      setLoadingQuotation(false);
    }
  };

  // Helper function to get quotation total amount
  const getQuotationTotalAmount = (quotation) => {
    if (!quotation) return 0;

    // Check multiple possible field names for total amount
    return (
      quotation.grandTotal ||
      quotation.totalAmount ||
      quotation.amount ||
      quotation.total ||
      quotation.quotationAmount ||
      quotation.finalAmount ||
      quotation.afterDiscountTotal ||
      quotation.subTotal ||
      0
    );
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return date.toLocaleDateString('vi-VN');
  };

  // Handle payment amount change
  const handlePaymentAmountChange = (text) => {
    // Remove all non-numeric characters
    const numberOnly = text.replace(/[^0-9]/g, '');

    if (numberOnly === '') {
      setPaymentAmount('');
      return;
    }

    // Format with commas
    const formatted = new Intl.NumberFormat('vi-VN').format(numberOnly);
    setPaymentAmount(formatted);
  };

  // Handle add manual payment
  const handleAddManualPayment = async () => {
    if (!paymentAmount) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền thanh toán');
      return;
    }

    // Parse amount from formatted string
    const amountValue = parseFloat(paymentAmount.replace(/[^0-9]/g, ''));

    if (amountValue <= 0) {
      Alert.alert('Lỗi', 'Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    try {
      setAddingPayment(true);

      // Tạo YCTT cho thanh toán thủ công
      const manualPaymentRequestData = {
        projectId,
        requestNumber: `YCTT-MANUAL-${Date.now()}`,
        amount: amountValue,
        description: `Thanh toán thủ công: ${
          paymentNotes || 'Không có ghi chú'
        }`,
        issueDate: new Date(),
        dueDate: paymentDate,
        customerName: project?.customerName || 'Không xác định',
        customerId: project?.customerId,
        status: 'paid', // Đánh dấu là đã thanh toán
        totalPaid: amountValue, // Đã thanh toán toàn bộ
        misaInvoiceNumber: '',
        isManualPayment: true, // Đánh dấu đây là thanh toán thủ công
      };

      // Tạo YCTT
      const requestId = await createPaymentRequest(
        manualPaymentRequestData,
        currentUser?.uid
      );

      // Tạo payment record
      const paymentData = {
        amountPaid: amountValue,
        paymentMethod: paymentMethod,
        paymentDate: paymentDate,
        notes: paymentNotes || 'Thanh toán thủ công',
        loggedBy: currentUser?.uid,
        loggedByName: currentUser?.displayName || currentUser?.email,
        isManualPayment: true,
      };

      // Lưu thanh toán vào database
      await logPayment(requestId, paymentData);

      Alert.alert(
        'Thành công',
        `Đã tạo YCTT và thêm thanh toán thủ công: ${formatCurrency(
          amountValue
        )}`,
        [
          {
            text: 'Xem chi tiết',
            onPress: () =>
              navigation.navigate('PaymentRequestDetail', { requestId }),
          },
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setPaymentAmount('');
              setPaymentMethod('Chuyển khoản');
              setPaymentNotes('');
              setPaymentDate(new Date());
              setShowPaymentModal(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error adding manual payment:', error);
      Alert.alert('Lỗi', 'Không thể thêm thanh toán. Vui lòng thử lại.');
    } finally {
      setAddingPayment(false);
    }
  };

  const handleSave = async () => {
    // Validate form
    if (!amount) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền');
      return;
    }

    if (!description) {
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả');
      return;
    }

    if (!requestNumber) {
      Alert.alert('Lỗi', 'Vui lòng nhập số yêu cầu thanh toán');
      return;
    }

    try {
      setSaving(true);

      const amountValue = parseFloat(amount.replace(/[^0-9]/g, ''));

      // Create payment request
      const paymentRequestData = {
        projectId,
        customerId: project.customerId,
        customerName: project.customerName,
        requestNumber,
        amount: amountValue,
        description,
        status: 'pending',
        issueDate: new Date(),
        dueDate,
        misaInvoiceNumber: '',
      };

      await createPaymentRequest(paymentRequestData, currentUser.uid);

      Alert.alert('Thành công', 'Đã tạo yêu cầu thanh toán mới', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error creating payment request:', error);
      Alert.alert('Lỗi', 'Không thể tạo yêu cầu thanh toán');
    } finally {
      setSaving(false);
    }
  };

  // Format currency input
  const handleAmountChange = (text) => {
    // Remove non-digit characters
    const numberOnly = text.replace(/[^0-9]/g, '');
    if (numberOnly === '') {
      setAmount('');
      return;
    }

    // Format as currency
    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(numberOnly);

    setAmount(formatted);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Tạo Yêu cầu Thanh toán
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Đang tải dữ liệu...
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* Project Info */}
            <View
              style={[
                styles.projectInfo,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Text style={[styles.projectName, { color: theme.text }]}>
                {project?.name || 'Không có tên'}
              </Text>
              <Text
                style={[styles.customerName, { color: theme.textSecondary }]}
              >
                {project?.customerName || 'Không có khách hàng'}
              </Text>
            </View>

            {/* Form Fields */}
            <View
              style={[
                styles.formContainer,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              {/* Request Number */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Số yêu cầu thanh toán
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={requestNumber}
                  onChangeText={setRequestNumber}
                  placeholder="Nhập số yêu cầu thanh toán"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Amount */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Số tiền
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="Nhập số tiền"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Mô tả</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Nhập mô tả cho yêu cầu thanh toán"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Due Date */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Hạn thanh toán
                </Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: theme.text }}>
                    {formatDate(dueDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Manual Payment Button */}
              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={[
                    styles.manualPaymentButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={async () => {
                    await loadQuotationAndPaymentInfo();
                    setShowPaymentModal(true);
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.manualPaymentButtonText}>
                    Thêm thanh toán thủ công
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary },
                saving && { opacity: 0.6 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveButtonText}>
                    Lưu yêu cầu thanh toán
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={handleDueDateChange}
          />
        )}

        {/* Payment Modal */}
        <Modal
          visible={showPaymentModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPaymentModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Thêm thanh toán thủ công
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPaymentModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Project Info */}
                <View
                  style={[
                    styles.modalInfoSection,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalInfoTitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Thông tin dự án
                  </Text>
                  <Text style={[styles.modalInfoText, { color: theme.text }]}>
                    {project?.name || 'Không có tên'}
                  </Text>
                  <Text style={[styles.modalInfoText, { color: theme.text }]}>
                    Khách hàng: {project?.customerName || 'Không xác định'}
                  </Text>
                </View>

                {/* Quotation and Payment Summary */}
                {loadingQuotation ? (
                  <View style={styles.loadingSection}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text
                      style={[
                        styles.loadingText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Đang tải thông tin báo giá...
                    </Text>
                  </View>
                ) : latestQuotation ? (
                  <View
                    style={[
                      styles.quotationSection,
                      { borderBottomColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quotationTitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Báo giá gần nhất
                    </Text>
                    <View style={styles.quotationInfo}>
                      <Text
                        style={[styles.quotationText, { color: theme.text }]}
                      >
                        Tổng báo giá:{' '}
                        {formatCurrency(
                          getQuotationTotalAmount(latestQuotation)
                        )}
                      </Text>
                      <Text
                        style={[styles.quotationText, { color: theme.text }]}
                      >
                        Đã thanh toán: {formatCurrency(totalPaidAmount)}
                      </Text>
                      <Text
                        style={[styles.quotationText, { color: '#FF9800' }]}
                      >
                        Còn lại:{' '}
                        {formatCurrency(
                          (getQuotationTotalAmount(latestQuotation) || 0) -
                            totalPaidAmount
                        )}
                      </Text>
                    </View>
                    <View style={styles.paymentProgress}>
                      <Text
                        style={[
                          styles.progressText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Tiến độ thanh toán: {formatCurrency(totalPaidAmount)} /{' '}
                        {formatCurrency(
                          getQuotationTotalAmount(latestQuotation) || 0
                        )}
                      </Text>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(
                                100,
                                (totalPaidAmount /
                                  (getQuotationTotalAmount(latestQuotation) ||
                                    1)) *
                                  100
                              )}%`,
                              backgroundColor:
                                totalPaidAmount >=
                                (getQuotationTotalAmount(latestQuotation) || 0)
                                  ? '#4CAF50'
                                  : theme.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noQuotationSection}>
                    <Ionicons
                      name="document-outline"
                      size={24}
                      color={theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.noQuotationText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Chưa có báo giá cho dự án này
                    </Text>
                  </View>
                )}

                {/* Payment Form */}
                <View style={styles.modalFormSection}>
                  <Text style={[styles.modalFormTitle, { color: theme.text }]}>
                    Thông tin thanh toán
                  </Text>

                  <View style={styles.formGroup}>
                    <Text
                      style={[styles.formLabel, { color: theme.textSecondary }]}
                    >
                      Số tiền thanh toán *
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: theme.inputBackground,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      value={paymentAmount}
                      onChangeText={handlePaymentAmountChange}
                      placeholder="Nhập số tiền"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text
                      style={[styles.formLabel, { color: theme.textSecondary }]}
                    >
                      Phương thức thanh toán
                    </Text>
                    <View style={styles.paymentMethodContainer}>
                      {['Chuyển khoản', 'Tiền mặt', 'Séc', 'Khác'].map(
                        (method) => (
                          <TouchableOpacity
                            key={method}
                            style={[
                              styles.paymentMethodOption,
                              {
                                backgroundColor:
                                  paymentMethod === method
                                    ? theme.primary
                                    : theme.inputBackground,
                                borderColor: theme.border,
                              },
                            ]}
                            onPress={() => setPaymentMethod(method)}
                          >
                            <Text
                              style={[
                                styles.paymentMethodText,
                                {
                                  color:
                                    paymentMethod === method
                                      ? '#FFFFFF'
                                      : theme.text,
                                },
                              ]}
                            >
                              {method}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text
                      style={[styles.formLabel, { color: theme.textSecondary }]}
                    >
                      Ngày thanh toán
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.datePickerButton,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setShowPaymentDatePicker(true)}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={theme.text}
                      />
                      <Text
                        style={[styles.datePickerText, { color: theme.text }]}
                      >
                        {formatDate(paymentDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text
                      style={[styles.formLabel, { color: theme.textSecondary }]}
                    >
                      Ghi chú
                    </Text>
                    <TextInput
                      style={[
                        styles.formTextArea,
                        {
                          backgroundColor: theme.inputBackground,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      value={paymentNotes}
                      onChangeText={setPaymentNotes}
                      placeholder="Nhập ghi chú (tùy chọn)"
                      placeholderTextColor={theme.textMuted}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowPaymentModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.saveButton,
                    { backgroundColor: theme.primary },
                    addingPayment && { opacity: 0.6 },
                  ]}
                  onPress={handleAddManualPayment}
                  disabled={addingPayment}
                >
                  {addingPayment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Thêm thanh toán</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Payment Date Picker */}
        {showPaymentDatePicker && (
          <DateTimePicker
            value={paymentDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowPaymentDatePicker(false);
              if (selectedDate) {
                setPaymentDate(selectedDate);
              }
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  projectInfo: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
  },
  formContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  dateText: {
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    textAlign: 'center',
  },
  manualPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  manualPaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 16,
    backgroundColor: '#fff',
  },
  modalInfoSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  modalInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  modalFormSection: {
    marginTop: 16,
  },
  modalFormTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    borderColor: '#ddd',
    color: '#333',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  paymentMethodOption: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginVertical: 5,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  datePickerText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderColor: '#ddd',
    color: '#333',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#0066cc',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingSection: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  quotationSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quotationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  quotationInfo: {
    marginBottom: 10,
  },
  quotationText: {
    fontSize: 14,
    marginBottom: 2,
  },
  paymentProgress: {
    marginTop: 10,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  noQuotationSection: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  noQuotationText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default CreatePaymentRequestScreen;
