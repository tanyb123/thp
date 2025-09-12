import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import salaryService from '../api/salaryService';

const FixedFeesManagementScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'deduction',
    amount: '',
    percentage: '',
    calculationType: 'fixed', // 'fixed' hoặc 'percentage'
    description: '',
    isActive: true,
  });

  const feeTypes = [
    { key: 'deduction', label: 'Khấu trừ', color: '#F44336' },
    { key: 'allowance', label: 'Phụ cấp', color: '#4CAF50' },
    { key: 'insurance', label: 'Bảo hiểm', color: '#2196F3' },
  ];

  useEffect(() => {
    loadFees();
  }, []);

  const loadFees = async () => {
    try {
      setLoading(true);
      const feesData = await salaryService.getAllFixedFees();
      setFees(feesData);
    } catch (error) {
      console.error('Lỗi khi tải danh sách phí:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách phí cố định');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFee = () => {
    setEditingFee(null);
    setFormData({
      name: '',
      type: 'deduction',
      amount: '',
      percentage: '',
      calculationType: 'fixed',
      description: '',
      isActive: true,
    });
    setModalVisible(true);
  };

  const handleEditFee = (fee) => {
    setEditingFee(fee);
    setFormData({
      name: fee.name,
      type: fee.type,
      amount: fee.amount ? fee.amount.toString() : '',
      percentage: fee.percentage ? fee.percentage.toString() : '',
      calculationType: fee.calculationType || 'fixed',
      description: fee.description,
      isActive: fee.isActive,
    });
    setModalVisible(true);
  };

  const handleDeleteFee = async (feeId) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa loại phí này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await salaryService.deleteFixedFee(feeId);
            Alert.alert('Thành công', 'Đã xóa loại phí');
            loadFees();
          } catch (error) {
            console.error('Lỗi khi xóa phí:', error);
            Alert.alert('Lỗi', 'Không thể xóa loại phí');
          }
        },
      },
    ]);
  };

  const handleSaveFee = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên phí');
      return;
    }

    if (formData.calculationType === 'fixed' && !formData.amount.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền cố định');
      return;
    }

    if (
      formData.calculationType === 'percentage' &&
      !formData.percentage.trim()
    ) {
      Alert.alert('Lỗi', 'Vui lòng nhập phần trăm');
      return;
    }

    try {
      if (editingFee) {
        await salaryService.updateFixedFee(editingFee.id, formData);
        Alert.alert('Thành công', 'Đã cập nhật loại phí');
      } else {
        await salaryService.createFixedFee(formData);
        Alert.alert('Thành công', 'Đã tạo loại phí mới');
      }

      setModalVisible(false);
      loadFees();
    } catch (error) {
      console.error('Lỗi khi lưu phí:', error);
      Alert.alert('Lỗi', error.message || 'Không thể lưu loại phí');
    }
  };

  const getFeeTypeLabel = (type) => {
    const feeType = feeTypes.find((ft) => ft.key === type);
    return feeType ? feeType.label : type;
  };

  const getFeeTypeColor = (type) => {
    const feeType = feeTypes.find((ft) => ft.key === type);
    return feeType ? feeType.color : '#666';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải danh sách phí cố định...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý phí cố định</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddFee}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Thống kê */}
        <View style={[styles.statsContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>
            Thống kê
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.primary }]}>
                {fees.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Tổng số loại phí
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
                {fees.filter((f) => f.type === 'allowance').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Phụ cấp
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#F44336' }]}>
                {fees.filter((f) => f.type === 'deduction').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Khấu trừ
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#2196F3' }]}>
                {fees.filter((f) => f.type === 'insurance').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Bảo hiểm
              </Text>
            </View>
          </View>
        </View>

        {/* Danh sách phí cố định */}
        <View style={styles.feesContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Danh sách phí cố định
          </Text>

          {fees.length === 0 ? (
            <View
              style={[styles.emptyContainer, { backgroundColor: theme.card }]}
            >
              <Ionicons
                name="document-outline"
                size={48}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Chưa có loại phí cố định nào
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: theme.primary }]}
                onPress={handleAddFee}
              >
                <Text style={styles.emptyButtonText}>
                  Thêm loại phí đầu tiên
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            fees.map((fee) => (
              <View
                key={fee.id}
                style={[styles.feeCard, { backgroundColor: theme.card }]}
              >
                <View style={styles.feeHeader}>
                  <View style={styles.feeInfo}>
                    <Text style={[styles.feeName, { color: theme.text }]}>
                      {fee.name}
                    </Text>
                    <View
                      style={[
                        styles.feeType,
                        { backgroundColor: getFeeTypeColor(fee.type) },
                      ]}
                    >
                      <Text style={styles.feeTypeText}>
                        {getFeeTypeLabel(fee.type)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.feeActions}>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: theme.primary },
                      ]}
                      onPress={() => handleEditFee(fee)}
                    >
                      <Ionicons name="create-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: '#F44336' },
                      ]}
                      onPress={() => handleDeleteFee(fee.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.feeDetails}>
                  {fee.calculationType === 'percentage' ? (
                    <Text style={[styles.feeAmount, { color: theme.primary }]}>
                      {fee.percentage}% lương
                    </Text>
                  ) : (
                    <Text style={[styles.feeAmount, { color: theme.primary }]}>
                      {formatCurrency(fee.amount || 0)}
                    </Text>
                  )}
                  {fee.description && (
                    <Text
                      style={[
                        styles.feeDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {fee.description}
                    </Text>
                  )}
                </View>

                <View style={styles.feeStatus}>
                  <View
                    style={[
                      styles.statusIndicator,
                      { backgroundColor: fee.isActive ? '#4CAF50' : '#F44336' },
                    ]}
                  />
                  <Text
                    style={[styles.statusText, { color: theme.textSecondary }]}
                  >
                    {fee.isActive ? 'Đang hoạt động' : 'Đã tắt'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal thêm/sửa phí */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.background }]}
          >
            <View
              style={[styles.modalHeader, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.modalTitle}>
                {editingFee ? 'Sửa loại phí' : 'Thêm loại phí mới'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Tên loại phí */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Tên loại phí *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                  placeholder="VD: Bảo hiểm xã hội, Phụ cấp ăn trưa..."
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Loại phí */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Loại phí *
                </Text>
                <View style={styles.typeSelector}>
                  {feeTypes.map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.typeOption,
                        formData.type === type.key && {
                          backgroundColor: type.color,
                        },
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, type: type.key })
                      }
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          formData.type === type.key && { color: '#fff' },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Cách tính phí */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Cách tính phí *
                </Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formData.calculationType === 'fixed' && {
                        backgroundColor: theme.primary,
                      },
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, calculationType: 'fixed' })
                    }
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        formData.calculationType === 'fixed' && {
                          color: '#fff',
                        },
                      ]}
                    >
                      Số tiền cố định
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      formData.calculationType === 'percentage' && {
                        backgroundColor: theme.primary,
                      },
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        calculationType: 'percentage',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        formData.calculationType === 'percentage' && {
                          color: '#fff',
                        },
                      ]}
                    >
                      Theo phần trăm lương
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Số tiền hoặc phần trăm */}
              {formData.calculationType === 'fixed' ? (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>
                    Số tiền (VNĐ) *
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    value={formData.amount}
                    onChangeText={(text) =>
                      setFormData({ ...formData, amount: text })
                    }
                    placeholder="VD: 500000"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>
                    Phần trăm (%) *
                  </Text>
                  <View style={styles.percentageInputContainer}>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          color: theme.text,
                          flex: 1,
                        },
                      ]}
                      value={formData.percentage}
                      onChangeText={(text) =>
                        setFormData({ ...formData, percentage: text })
                      }
                      placeholder="VD: 8"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                    />
                    <Text
                      style={[styles.percentageSymbol, { color: theme.text }]}
                    >
                      %
                    </Text>
                  </View>
                  <Text style={[styles.formHint, { color: theme.textMuted }]}>
                    VD: BHXH = 8%, BHYT = 1.5%, BHTN = 1%
                  </Text>
                </View>
              )}

              {/* Mô tả */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Mô tả
                </Text>
                <TextInput
                  style={[
                    styles.formTextArea,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                  placeholder="Mô tả chi tiết về loại phí này..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Trạng thái */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>
                    Đang hoạt động
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.switch,
                      {
                        backgroundColor: formData.isActive
                          ? theme.primary
                          : theme.textMuted,
                      },
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, isActive: !formData.isActive })
                    }
                  >
                    <View
                      style={[
                        styles.switchThumb,
                        {
                          backgroundColor: '#fff',
                          transform: [
                            { translateX: formData.isActive ? 20 : 0 },
                          ],
                        },
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.textMuted },
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveFee}
              >
                <Text style={styles.modalButtonText}>
                  {editingFee ? 'Cập nhật' : 'Thêm mới'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  statsContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  feesContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  feeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  feeInfo: {
    flex: 1,
  },
  feeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  feeType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  feeTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  feeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  percentageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  formHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  feeDetails: {
    marginBottom: 12,
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  feeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  feeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  formTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FixedFeesManagementScreen;
