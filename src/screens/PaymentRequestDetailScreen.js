// src/screens/PaymentRequestDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getPaymentRequestById,
  logPayment,
  updateMisaInvoiceNumber,
} from '../api/paymentService';
import DateTimePicker from '@react-native-community/datetimepicker';

const PaymentRequestDetailScreen = ({ route, navigation }) => {
  const { requestId } = route.params;
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // MISA Invoice Number
  const [misaInvoiceNumber, setMisaInvoiceNumber] = useState('');
  const [editingMisaInvoice, setEditingMisaInvoice] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadPaymentRequestData();
  }, [requestId]);

  const loadPaymentRequestData = async () => {
    try {
      setLoading(true);
      const data = await getPaymentRequestById(requestId);
      if (!data) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin yêu cầu thanh toán');
        navigation.goBack();
        return;
      }

      setPaymentRequest(data);
      setMisaInvoiceNumber(data.misaInvoiceNumber || '');
    } catch (error) {
      console.error('Error loading payment request:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin yêu cầu thanh toán');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMisaInvoice = async () => {
    try {
      setEditingMisaInvoice(false);
      await updateMisaInvoiceNumber(requestId, misaInvoiceNumber);

      // Update local state to reflect changes
      setPaymentRequest((prev) => ({
        ...prev,
        misaInvoiceNumber,
      }));

      Alert.alert('Thành công', 'Đã cập nhật mã số hóa đơn MISA');
    } catch (error) {
      console.error('Error updating MISA invoice number:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật mã số hóa đơn MISA');
    }
  };

  const handleAddPayment = async () => {
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

    // Check if payment amount exceeds remaining amount
    const remainingAmount =
      (paymentRequest?.amount || 0) - (paymentRequest?.totalPaid || 0);
    if (amountValue > remainingAmount) {
      Alert.alert(
        'Cảnh báo',
        `Số tiền thanh toán (${formatCurrency(
          amountValue
        )}) vượt quá số tiền còn lại (${formatCurrency(
          remainingAmount
        )}). Bạn có muốn tiếp tục?`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Tiếp tục', onPress: () => submitPayment(amountValue) },
        ]
      );
      return;
    }

    submitPayment(amountValue);
  };

  const submitPayment = async (amountValue) => {
    try {
      setSaving(true);

      // Create payment data
      const paymentData = {
        amountPaid: amountValue,
        paymentMethod: paymentMethod,
        paymentDate: paymentDate,
        notes: paymentNotes,
        loggedBy: currentUser?.uid,
        loggedByName: currentUser?.displayName || currentUser?.email,
      };

      await logPayment(requestId, paymentData);

      // Reset form
      setPaymentAmount('');
      setPaymentMethod('Chuyển khoản');
      setPaymentNotes('');
      setPaymentDate(new Date());
      setShowPaymentModal(false);

      // Reload data
      await loadPaymentRequestData();

      Alert.alert(
        'Thành công',
        `Đã thêm thanh toán: ${formatCurrency(amountValue)}`
      );
    } catch (error) {
      console.error('Error adding payment:', error);
      Alert.alert('Lỗi', 'Không thể thêm thanh toán. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa xác định';

    try {
      const date = timestamp.seconds
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);

      return date.toLocaleDateString('vi-VN');
    } catch (error) {
      return 'Ngày không hợp lệ';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return '#4CAF50'; // Green
      case 'partially_paid':
        return '#FF9800'; // Orange
      case 'overdue':
        return '#F44336'; // Red
      case 'pending':
      default:
        return '#2196F3'; // Blue
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid':
        return 'Đã thanh toán';
      case 'partially_paid':
        return 'Thanh toán một phần';
      case 'overdue':
        return 'Quá hạn';
      case 'pending':
      default:
        return 'Chờ thanh toán';
    }
  };

  const handlePaymentDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || paymentDate;
    setShowDatePicker(Platform.OS === 'ios');
    setPaymentDate(currentDate);
  };

  const handleAmountChange = (text) => {
    // Remove non-digit characters
    const numberOnly = text.replace(/[^0-9]/g, '');
    if (numberOnly === '') {
      setPaymentAmount('');
      return;
    }

    // Format as currency
    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(numberOnly);

    setPaymentAmount(formatted);
  };

  // Render project item
  const renderPaymentItem = ({ item }) => (
    <View
      style={[styles.paymentItem, { backgroundColor: theme.cardBackground }]}
    >
      <View style={styles.paymentHeader}>
        <View style={styles.paymentAmountContainer}>
          <Text style={[styles.paymentAmount, { color: theme.primary }]}>
            {formatCurrency(item.amountPaid)}
          </Text>
          {item.isManualPayment && (
            <View style={styles.manualPaymentBadge}>
              <Ionicons name="hand-left-outline" size={12} color="#FF9800" />
              <Text style={styles.manualPaymentText}>Thủ công</Text>
            </View>
          )}
        </View>
        <Text style={[styles.paymentDate, { color: theme.textSecondary }]}>
          {formatDate(item.paymentDate)}
        </Text>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.paymentMethodRow}>
          <Ionicons
            name={getPaymentMethodIcon(item.paymentMethod)}
            size={16}
            color={theme.textSecondary}
          />
          <Text style={[styles.paymentMethod, { color: theme.text }]}>
            {item.paymentMethod || 'Không có thông tin'}
          </Text>
        </View>

        {item.notes && (
          <View style={styles.paymentNotesRow}>
            <Ionicons
              name="document-text-outline"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.paymentNotes, { color: theme.textSecondary }]}>
              {item.notes}
            </Text>
          </View>
        )}

        {item.loggedByName && (
          <View style={styles.paymentLoggedByRow}>
            <Ionicons
              name="person-outline"
              size={16}
              color={theme.textSecondary}
            />
            <Text
              style={[styles.paymentLoggedBy, { color: theme.textSecondary }]}
            >
              Ghi nhận bởi: {item.loggedByName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // Helper function to get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'Chuyển khoản':
        return 'card-outline';
      case 'Tiền mặt':
        return 'cash-outline';
      case 'Séc':
        return 'document-text-outline';
      default:
        return 'wallet-outline';
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Chi tiết Yêu cầu Thanh toán
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Request Header */}
        <View
          style={[
            styles.requestHeader,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <View style={styles.requestHeaderRow}>
            <View style={styles.requestInfo}>
              <Text style={[styles.requestNumber, { color: theme.text }]}>
                {paymentRequest?.requestNumber || 'YCTT-???'}
              </Text>
              {paymentRequest?.isManualPayment && (
                <View style={styles.manualPaymentBadge}>
                  <Ionicons
                    name="hand-left-outline"
                    size={12}
                    color="#FF9800"
                  />
                  <Text style={styles.manualPaymentText}>Thủ công</Text>
                </View>
              )}
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(paymentRequest?.status) },
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(paymentRequest?.status)}
              </Text>
            </View>
          </View>

          <Text style={[styles.description, { color: theme.text }]}>
            {paymentRequest?.description || 'Không có mô tả'}
          </Text>

          {paymentRequest?.isManualPayment && (
            <View style={styles.manualPaymentInfo}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#FF9800"
              />
              <Text style={styles.manualPaymentInfoText}>
                Đây là thanh toán thủ công - đã hoàn thành ngay khi tạo
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Ngày yêu cầu:
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {formatDate(paymentRequest?.issueDate)}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Hạn thanh toán:
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color:
                      paymentRequest?.status === 'overdue'
                        ? '#F44336'
                        : theme.text,
                  },
                ]}
              >
                {formatDate(paymentRequest?.dueDate)}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Khách hàng:
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {paymentRequest?.customerName || 'Không xác định'}
              </Text>
            </View>
          </View>

          <View style={styles.amountRow}>
            <View>
              <Text
                style={[styles.amountLabel, { color: theme.textSecondary }]}
              >
                Số tiền yêu cầu:
              </Text>
              <Text style={[styles.amountValue, { color: theme.primary }]}>
                {formatCurrency(paymentRequest?.amount || 0)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[styles.amountLabel, { color: theme.textSecondary }]}
              >
                Đã thanh toán:
              </Text>
              <Text
                style={[
                  styles.amountValue,
                  {
                    color:
                      (paymentRequest?.totalPaid || 0) >=
                      (paymentRequest?.amount || 0)
                        ? '#4CAF50'
                        : theme.primary,
                  },
                ]}
              >
                {formatCurrency(paymentRequest?.totalPaid || 0)}
              </Text>
            </View>
          </View>

          {/* Tổng tiền đã thanh toán */}
          <View
            style={[
              styles.totalPaidContainer,
              { borderTopColor: theme.border },
            ]}
          >
            <View style={styles.totalPaidRow}>
              <Text
                style={[styles.totalPaidLabel, { color: theme.textSecondary }]}
              >
                Tổng tiền đã thanh toán:
              </Text>
              <Text style={[styles.totalPaidValue, { color: '#4CAF50' }]}>
                {formatCurrency(paymentRequest?.totalPaid || 0)}
              </Text>
            </View>

            <View style={styles.totalPaidRow}>
              <Text
                style={[styles.totalPaidLabel, { color: theme.textSecondary }]}
              >
                Còn lại:
              </Text>
              <Text
                style={[
                  styles.totalPaidValue,
                  {
                    color:
                      (paymentRequest?.amount || 0) -
                        (paymentRequest?.totalPaid || 0) >
                      0
                        ? '#FF9800'
                        : '#4CAF50',
                  },
                ]}
              >
                {formatCurrency(
                  (paymentRequest?.amount || 0) -
                    (paymentRequest?.totalPaid || 0)
                )}
              </Text>
            </View>

            {/* Nút thêm thanh toán thủ công */}
            <TouchableOpacity
              style={[
                styles.addManualPaymentButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={() => setShowPaymentModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.addManualPaymentText}>
                Thêm thanh toán thủ công
              </Text>
            </TouchableOpacity>
          </View>

          {/* MISA Invoice */}
          <View
            style={[styles.misaContainer, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.misaLabel, { color: theme.textSecondary }]}>
              Số hóa đơn MISA:
            </Text>

            {editingMisaInvoice ? (
              <View style={styles.misaInputContainer}>
                <TextInput
                  style={[
                    styles.misaInput,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={misaInvoiceNumber}
                  onChangeText={setMisaInvoiceNumber}
                  placeholder="Nhập số hóa đơn"
                  placeholderTextColor={theme.textMuted}
                />
                <TouchableOpacity
                  style={[
                    styles.misaButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={handleSaveMisaInvoice}
                >
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.misaButton,
                    { backgroundColor: theme.danger || '#F44336' },
                  ]}
                  onPress={() => {
                    setEditingMisaInvoice(false);
                    setMisaInvoiceNumber(
                      paymentRequest?.misaInvoiceNumber || ''
                    );
                  }}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.misaValueContainer}>
                <Text style={[styles.misaValue, { color: theme.text }]}>
                  {paymentRequest?.misaInvoiceNumber || 'Chưa có'}
                </Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditingMisaInvoice(true)}
                >
                  <Ionicons name="pencil" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Payment History */}
        <View
          style={[
            styles.paymentHistoryContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <View style={styles.paymentHistoryHeader}>
            <Text style={[styles.paymentHistoryTitle, { color: theme.text }]}>
              Lịch sử thanh toán
            </Text>
            <Text
              style={[
                styles.paymentHistoryCount,
                { color: theme.textSecondary },
              ]}
            >
              ({paymentRequest?.payments?.length || 0} thanh toán)
            </Text>
          </View>

          {paymentRequest?.payments && paymentRequest.payments.length > 0 ? (
            <FlatList
              data={paymentRequest.payments}
              renderItem={renderPaymentItem}
              keyExtractor={(item, index) => `payment-${index}`}
              scrollEnabled={false}
              contentContainerStyle={styles.paymentList}
            />
          ) : (
            <View style={styles.emptyPayments}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={theme.textMuted}
              />
              <Text
                style={[
                  styles.emptyPaymentsText,
                  { color: theme.textSecondary },
                ]}
              >
                Chưa có thanh toán nào được ghi nhận
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

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
              {/* Thông tin YCTT */}
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
                  Thông tin YCTT
                </Text>
                <Text style={[styles.modalInfoText, { color: theme.text }]}>
                  {paymentRequest?.requestNumber || 'YCTT-???'}
                </Text>
                <Text style={[styles.modalInfoText, { color: theme.text }]}>
                  Khách hàng: {paymentRequest?.customerName || 'Không xác định'}
                </Text>
                <Text style={[styles.modalInfoText, { color: theme.text }]}>
                  Số tiền: {formatCurrency(paymentRequest?.amount || 0)}
                </Text>
                <Text style={[styles.modalInfoText, { color: theme.text }]}>
                  Đã thanh toán:{' '}
                  {formatCurrency(paymentRequest?.totalPaid || 0)}
                </Text>
                <Text style={[styles.modalInfoText, { color: '#FF9800' }]}>
                  Còn lại:{' '}
                  {formatCurrency(
                    (paymentRequest?.amount || 0) -
                      (paymentRequest?.totalPaid || 0)
                  )}
                </Text>
              </View>

              {/* Form thanh toán */}
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
                    onChangeText={handleAmountChange}
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
                    onPress={() => setShowDatePicker(true)}
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
                  saving && { opacity: 0.6 },
                ]}
                onPress={handleAddPayment}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Thêm thanh toán</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={paymentDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setPaymentDate(selectedDate);
            }
          }}
        />
      )}
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
  requestHeader: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  requestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualPaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0', // Light orange background
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  manualPaymentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF9800', // Orange color
    marginLeft: 4,
  },
  manualPaymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#FFFDE7', // Light yellow background
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800', // Orange border
  },
  manualPaymentInfoText: {
    fontSize: 13,
    color: '#FF9800', // Orange color
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalPaidContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  totalPaidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalPaidLabel: {
    fontSize: 14,
  },
  totalPaidValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addManualPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 16,
  },
  addManualPaymentText: {
    color: '#FFFFFF',
    marginLeft: 4,
    fontSize: 14,
  },
  misaContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  misaLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  misaValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  misaValue: {
    fontSize: 16,
    flex: 1,
  },
  editButton: {
    padding: 4,
  },
  misaInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  misaInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  misaButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  paymentsSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    marginLeft: 4,
    fontSize: 14,
  },
  paymentItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  paymentAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentDate: {
    fontSize: 14,
  },
  paymentDetails: {
    marginTop: 4,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 14,
    marginLeft: 8,
  },
  paymentNotesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  paymentNotes: {
    fontSize: 13,
    marginLeft: 8,
  },
  paymentLoggedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  paymentLoggedBy: {
    fontSize: 13,
    marginLeft: 8,
  },
  emptyPayments: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 8,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalInfoSection: {
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalInfoTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalInfoText: {
    fontSize: 16,
    marginBottom: 4,
  },
  modalFormSection: {
    paddingTop: 16,
  },
  modalFormTitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 4,
    height: 40,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: -8, // Adjust for spacing between options
  },
  paymentMethodOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginVertical: 4,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  paymentMethodText: {
    fontSize: 14,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    height: 40,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  datePickerText: {
    marginLeft: 8,
    fontSize: 16,
  },
  formTextArea: {
    borderWidth: 1,
    borderRadius: 4,
    height: 80,
    paddingHorizontal: 8,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentHistoryContainer: {
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  paymentHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentHistoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentHistoryCount: {
    fontSize: 14,
  },
  paymentList: {
    paddingBottom: 16,
  },
  emptyPaymentsText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default PaymentRequestDetailScreen;
