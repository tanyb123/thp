import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ExpenseService from '../api/expenseService';

const AddCompanyExpenseScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [relatedDocId, setRelatedDocId] = useState('');
  const [expenseType, setExpenseType] = useState('other');

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [errors, setErrors] = useState({});

  // List of available expense types
  const expenseTypes = [
    { id: 'rent', label: 'Tiền thuê mặt bằng' },
    { id: 'utilities', label: 'Điện, nước, internet' },
    { id: 'administrative', label: 'Chi phí hành chính' },
    { id: 'taxes', label: 'Thuế, phí' },
    { id: 'insurance', label: 'Bảo hiểm' },
    { id: 'maintenance', label: 'Bảo trì thiết bị' },
    { id: 'transport', label: 'Vận chuyển' },
    { id: 'other', label: 'Chi phí khác' },
  ];

  // Check user role for access control
  const hasAccess =
    currentUser?.role === 'ke_toan' ||
    currentUser?.role === 'giam_doc' ||
    currentUser?.role === 'thuong_mai';
  if (!hasAccess) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Thêm Chi Phí Công Ty
          </Text>
        </View>

        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={48} color={theme.danger} />
          <Text style={[styles.accessDeniedText, { color: theme.text }]}>
            Bạn không có quyền truy cập tính năng này.
          </Text>
          <Text
            style={[styles.accessDeniedSubtext, { color: theme.textSecondary }]}
          >
            Chỉ kế toán, giám đốc và thương mại mới có thể thêm chi phí công ty.
          </Text>
        </View>
      </View>
    );
  }

  // Date picker handler
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('vi-VN');
  };

  // Format currency for display
  const formatCurrency = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Handle type selection
  const handleSelectType = (typeId) => {
    setExpenseType(typeId);
    setShowTypeModal(false);
  };

  // Get type label based on ID
  const getTypeLabel = (typeId) => {
    const type = expenseTypes.find((t) => t.id === typeId);
    return type ? type.label : 'Chi phí khác';
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!description.trim()) {
      newErrors.description = 'Vui lòng nhập mô tả chi phí';
    }

    if (!amount.trim()) {
      newErrors.amount = 'Vui lòng nhập số tiền';
    } else if (isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Số tiền phải lớn hơn 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSaveExpense = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const expenseData = {
        description,
        amount: parseFloat(amount.replace(/\./g, '')), // Remove thousand separators
        date,
        type: 'other', // Default type for the expenses collection
        expenseCategory: expenseType, // Additional field for company expenses
        relatedDocId: relatedDocId.trim() || null,
        createdBy: currentUser.uid,
      };

      const expenseId = await ExpenseService.addExpense(expenseData);

      Alert.alert('Thành công', 'Đã lưu chi phí công ty thành công', [
        {
          text: 'Thêm tiếp',
          onPress: () => {
            // Reset form but keep the date
            setDescription('');
            setAmount('');
            setRelatedDocId('');
            setExpenseType('other');
            // Keep the current date for convenience
          },
        },
        {
          text: 'Hoàn thành',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving company expense:', error);
      Alert.alert('Lỗi', 'Không thể lưu chi phí. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Thêm Chi Phí Công Ty
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[styles.card, { backgroundColor: theme.cardBackground }]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Thông tin chi phí
            </Text>

            {/* Description Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                Mô tả chi phí *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: errors.description
                      ? theme.danger
                      : theme.border,
                  },
                ]}
                placeholder="Nhập mô tả chi phí"
                placeholderTextColor={theme.textPlaceholder}
                value={description}
                onChangeText={setDescription}
              />
              {errors.description && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.description}
                </Text>
              )}
            </View>

            {/* Amount Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                Số tiền (VNĐ) *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: errors.amount ? theme.danger : theme.border,
                  },
                ]}
                placeholder="Nhập số tiền"
                placeholderTextColor={theme.textPlaceholder}
                keyboardType="numeric"
                value={formatCurrency(amount)}
                onChangeText={(text) => {
                  // Remove non-numeric characters for processing
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setAmount(numericValue);
                }}
              />
              {errors.amount && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.amount}
                </Text>
              )}
            </View>

            {/* Expense Type Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                Loại chi phí
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowTypeModal(true)}
              >
                <Text style={{ color: theme.text }}>
                  {getTypeLabel(expenseType)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Date Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                Ngày
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: theme.text }}>{formatDate(date)}</Text>
                <Ionicons
                  name="calendar"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}
            </View>

            {/* Document ID Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                Số hóa đơn/chứng từ (không bắt buộc)
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
                placeholder="Nhập số hóa đơn hoặc chứng từ"
                placeholderTextColor={theme.textPlaceholder}
                value={relatedDocId}
                onChangeText={setRelatedDocId}
              />
            </View>
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={{ color: theme.textSecondary }}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleSaveExpense}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={20}
                    color="#ffffff"
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.saveButtonText}>Lưu chi phí</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Expense Type Selection Modal */}
        <Modal
          visible={showTypeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTypeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContainer,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Chọn loại chi phí
                </Text>
                <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                {expenseTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeOption,
                      expenseType === type.id && {
                        backgroundColor: theme.primaryLight,
                      },
                    ]}
                    onPress={() => handleSelectType(type.id)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        {
                          color:
                            expenseType === type.id
                              ? theme.primary
                              : theme.text,
                        },
                      ]}
                    >
                      {type.label}
                    </Text>
                    {expenseType === type.id && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={theme.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
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
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '45%',
  },
  saveButton: {
    flexDirection: 'row',
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '45%',
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    maxHeight: '80%',
    borderRadius: 8,
    padding: 16,
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
  modalContent: {
    maxHeight: '80%',
  },
  typeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  typeOptionText: {
    fontSize: 16,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: '80%',
  },
});

export default AddCompanyExpenseScreen;
