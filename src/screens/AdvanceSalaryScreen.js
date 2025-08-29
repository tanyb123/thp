import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  submitAdvanceSalaryRequest,
  fetchAdvanceRequestsByUser,
} from '../api/requestService';

const AdvanceSalaryScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [requestDate, setRequestDate] = useState(new Date());
  const [expectedPaymentDate, setExpectedPaymentDate] = useState(new Date());

  useEffect(() => {
    loadAdvanceRequests();
  }, []);

  const loadAdvanceRequests = async () => {
    try {
      setLoading(true);
      if (!user?.uid) return;
      const requests = await fetchAdvanceRequestsByUser(user.uid);
      setAdvanceRequests(requests);
    } catch (error) {
      console.error('Lỗi khi tải đơn xin ứng lương:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách đơn xin ứng lương');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Chờ duyệt';
      case 'approved':
        return 'Đã duyệt';
      case 'rejected':
        return 'Từ chối';
      default:
        return 'Không xác định';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FF9800';
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const handleSubmitAdvanceRequest = async () => {
    if (!amount.trim() || isNaN(parseFloat(amount))) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do ứng lương');
      return;
    }

    const amountValue = parseFloat(amount);
    if (amountValue <= 0) {
      Alert.alert('Lỗi', 'Số tiền phải lớn hơn 0');
      return;
    }

    try {
      setLoading(true);
      await submitAdvanceSalaryRequest({
        userId: user.uid,
        userName: user?.displayName || user?.email || '',
        amount: amountValue,
        reason,
        requestDate,
        expectedPaymentDate,
      });

      Alert.alert(
        'Thành công',
        'Đơn xin ứng lương đã được gửi và đang chờ duyệt'
      );
      setShowForm(false);
      resetForm();
      await loadAdvanceRequests();
    } catch (error) {
      console.error('Lỗi khi gửi đơn xin ứng lương:', error);
      Alert.alert('Lỗi', 'Không thể gửi đơn xin ứng lương');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setReason('');
    setRequestDate(new Date());
    setExpectedPaymentDate(new Date());
  };

  const getTotalRequested = () => {
    return advanceRequests.reduce((total, request) => {
      return total + request.amount;
    }, 0);
  };

  const getTotalApproved = () => {
    return advanceRequests
      .filter((request) => request.status === 'approved')
      .reduce((total, request) => {
        return total + (request.approvedAmount || request.amount);
      }, 0);
  };

  const getTotalPending = () => {
    return advanceRequests
      .filter((request) => request.status === 'pending')
      .reduce((total, request) => {
        return total + request.amount;
      }, 0);
  };

  if (loading && advanceRequests.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
        />
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
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Xin Ứng Lương
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Thống kê */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.statsTitle, { color: theme.text }]}>
            Thống kê ứng lương
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {formatCurrency(getTotalApproved())}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Đã duyệt
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>
                {formatCurrency(getTotalPending())}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Chờ duyệt
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>
                {formatCurrency(getTotalRequested())}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Tổng yêu cầu
              </Text>
            </View>
          </View>
        </View>

        {/* Danh sách đơn xin ứng lương */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Lịch sử đơn xin ứng lương
          </Text>

          {advanceRequests.length > 0 ? (
            advanceRequests.map((request) => (
              <View
                key={request.id}
                style={[
                  styles.requestCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.amountInfo}>
                    <Ionicons
                      name="cash-outline"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.amountText, { color: theme.text }]}>
                      {formatCurrency(request.amount)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(request.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusLabel(request.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <View style={styles.reasonRow}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text style={[styles.reasonText, { color: theme.text }]}>
                      {request.reason}
                    </Text>
                  </View>

                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[styles.dateText, { color: theme.textSecondary }]}
                    >
                      Ngày yêu cầu: {formatDate(request.requestDate)}
                    </Text>
                  </View>

                  <View style={styles.dateRow}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[styles.dateText, { color: theme.textSecondary }]}
                    >
                      Dự kiến chi: {formatDate(request.expectedPaymentDate)}
                    </Text>
                  </View>

                  <View style={styles.submittedRow}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.submittedText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Gửi lúc: {formatDate(request.submittedAt)}
                    </Text>
                  </View>

                  {request.status === 'approved' && request.approvedAmount && (
                    <View style={styles.approvedRow}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[styles.approvedText, { color: theme.primary }]}
                      >
                        Số tiền được duyệt:{' '}
                        {formatCurrency(request.approvedAmount)}
                      </Text>
                    </View>
                  )}

                  {request.status === 'rejected' && request.rejectionReason && (
                    <View style={styles.rejectedRow}>
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={theme.error}
                      />
                      <Text
                        style={[styles.rejectedText, { color: theme.error }]}
                      >
                        Lý do từ chối: {request.rejectionReason}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons name="cash-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Chưa có đơn xin ứng lương nào
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal form xin ứng lương */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Đăng ký ứng lương
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowForm(false)}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              {/* Số tiền */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Số tiền ứng lương (VND)
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder="Nhập số tiền..."
                  placeholderTextColor={theme.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                {amount && !isNaN(parseFloat(amount)) && (
                  <Text
                    style={[
                      styles.amountPreview,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {formatCurrency(parseFloat(amount))}
                  </Text>
                )}
              </View>

              {/* Lý do */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Lý do ứng lương
                </Text>
                <TextInput
                  style={[
                    styles.reasonInput,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder="Nhập lý do ứng lương..."
                  placeholderTextColor={theme.textMuted}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Thông tin tổng quan */}
              <View
                style={[
                  styles.summaryInfo,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text style={[styles.summaryInfoTitle, { color: theme.text }]}>
                  Tổng quan
                </Text>
                <Text
                  style={[
                    styles.summaryInfoText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Số tiền yêu cầu:{' '}
                  {amount ? formatCurrency(parseFloat(amount)) : '0 VND'}
                </Text>
              </View>
            </ScrollView>

            {/* Nút gửi */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setShowForm(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                  Hủy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleSubmitAdvanceRequest}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Gửi đơn</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  requestCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
  requestDetails: {
    gap: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reasonText: {
    fontSize: 14,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
  },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submittedText: {
    fontSize: 12,
  },
  approvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approvedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rejectedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rejectedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '80%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  formScroll: {
    padding: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  amountInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  amountPreview: {
    fontSize: 14,
    marginTop: 4,
    fontStyle: 'italic',
  },
  reasonInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  dateDisplayText: {
    fontSize: 16,
  },
  summaryInfo: {
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  summaryInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryInfoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  formActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});

export default AdvanceSalaryScreen;


