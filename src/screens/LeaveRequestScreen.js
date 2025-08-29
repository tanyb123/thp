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
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  submitLeaveRequest,
  fetchLeaveRequestsByUser,
} from '../api/requestService';

const LeaveRequestScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const loadLeaveRequests = async () => {
    try {
      setLoading(true);
      if (!user?.uid) return;
      const requests = await fetchLeaveRequestsByUser(user.uid);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Lỗi khi tải đơn xin nghỉ:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách đơn xin nghỉ');
    } finally {
      setLoading(false);
    }
  };

  const getLeaveTypeLabel = (type) => {
    switch (type) {
      case 'annual':
        return 'Nghỉ phép năm';
      case 'sick':
        return 'Nghỉ ốm';
      case 'personal':
        return 'Nghỉ việc riêng';
      case 'maternity':
        return 'Nghỉ thai sản';
      default:
        return 'Khác';
    }
  };

  const getLeaveTypeIcon = (type) => {
    switch (type) {
      case 'annual':
        return 'beach-outline';
      case 'sick':
        return 'medical-outline';
      case 'personal':
        return 'person-outline';
      case 'maternity':
        return 'heart-outline';
      default:
        return 'calendar-outline';
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
    return d.toLocaleDateString('vi-VN');
  };

  const calculateDays = (start, end) => {
    const s = start?.toDate ? start.toDate() : new Date(start);
    const e = end?.toDate ? end.toDate() : new Date(end);
    const diffTime = Math.abs(e - s);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end date
  };

  const handleSubmitLeaveRequest = async () => {
    if (!reason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do nghỉ phép');
      return;
    }

    // Cho phép nghỉ 1 ngày: endDate có thể bằng startDate
    if (endDate < startDate) {
      Alert.alert('Lỗi', 'Ngày kết thúc không được trước ngày bắt đầu');
      return;
    }

    try {
      setLoading(true);
      await submitLeaveRequest({
        userId: user.uid,
        userName: user?.displayName || user?.email || '',
        type: leaveType,
        startDate,
        endDate,
        reason,
      });

      Alert.alert(
        'Thành công',
        'Đơn xin nghỉ phép đã được gửi và đang chờ duyệt'
      );
      setShowForm(false);
      resetForm();
      await loadLeaveRequests();
    } catch (error) {
      console.error('Lỗi khi gửi đơn xin nghỉ:', error);
      Alert.alert('Lỗi', 'Không thể gửi đơn xin nghỉ phép');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLeaveType('annual');
    setStartDate(new Date());
    setEndDate(new Date());
    setReason('');
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      // Nếu ngày bắt đầu sau ngày kết thúc hiện tại thì cập nhật ngày kết thúc = ngày bắt đầu (nghỉ 1 ngày)
      if (selectedDate > endDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  if (loading && leaveRequests.length === 0) {
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
          Xin Nghỉ Phép
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
            Thống kê nghỉ phép
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {leaveRequests.filter((r) => r.status === 'approved').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Đã duyệt
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>
                {leaveRequests.filter((r) => r.status === 'pending').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Chờ duyệt
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F44336' }]}>
                {leaveRequests.filter((r) => r.status === 'rejected').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Từ chối
              </Text>
            </View>
          </View>
        </View>

        {/* Danh sách đơn xin nghỉ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Lịch sử đơn xin nghỉ
          </Text>

          {leaveRequests.length > 0 ? (
            leaveRequests.map((request) => (
              <View
                key={request.id}
                style={[
                  styles.requestCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestType}>
                    <Ionicons
                      name={getLeaveTypeIcon(request.type)}
                      size={20}
                      color={theme.primary}
                    />
                    <Text
                      style={[styles.requestTypeText, { color: theme.text }]}
                    >
                      {getLeaveTypeLabel(request.type)}
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
                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[styles.dateText, { color: theme.textSecondary }]}
                    >
                      {formatDate(request.startDate)} -{' '}
                      {formatDate(request.endDate)}
                    </Text>
                    <Text style={[styles.daysText, { color: theme.primary }]}>
                      ({calculateDays(request.startDate, request.endDate)} ngày)
                    </Text>
                  </View>

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
              <Ionicons
                name="document-outline"
                size={48}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Chưa có đơn xin nghỉ nào
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal form xin nghỉ phép */}
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
                Đăng ký nghỉ phép
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowForm(false)}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              {/* Loại nghỉ phép */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Loại nghỉ phép
                </Text>
                <View style={styles.typeSelector}>
                  {[
                    {
                      key: 'annual',
                      label: 'Nghỉ phép năm',
                      icon: 'beach-outline',
                    },
                    { key: 'sick', label: 'Nghỉ ốm', icon: 'medical-outline' },
                    {
                      key: 'personal',
                      label: 'Việc riêng',
                      icon: 'person-outline',
                    },
                    {
                      key: 'maternity',
                      label: 'Thai sản',
                      icon: 'heart-outline',
                    },
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.typeOption,
                        {
                          backgroundColor:
                            leaveType === type.key ? theme.primary : theme.card,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setLeaveType(type.key)}
                    >
                      <Ionicons
                        name={type.icon}
                        size={20}
                        color={leaveType === type.key ? '#fff' : theme.text}
                      />
                      <Text
                        style={[
                          styles.typeOptionText,
                          {
                            color: leaveType === type.key ? '#fff' : theme.text,
                          },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Ngày bắt đầu */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Ngày bắt đầu
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dateInput,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.dateInputText, { color: theme.text }]}>
                    {formatDate(startDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Ngày kết thúc */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Ngày kết thúc
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dateInput,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.dateInputText, { color: theme.text }]}>
                    {formatDate(endDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Lý do */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Lý do nghỉ phép
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
                  placeholder="Nhập lý do nghỉ phép..."
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
                  Số ngày nghỉ: {calculateDays(startDate, endDate)} ngày
                </Text>
                <Text
                  style={[
                    styles.summaryInfoText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Loại: {getLeaveTypeLabel(leaveType)}
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
                onPress={handleSubmitLeaveRequest}
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

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={onStartDateChange}
          minimumDate={new Date()}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={onEndDateChange}
          minimumDate={startDate}
        />
      )}
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
    fontSize: 24,
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
  requestType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestTypeText: {
    fontSize: 16,
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
  },
  daysText: {
    fontSize: 14,
    fontWeight: '500',
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
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submittedText: {
    fontSize: 12,
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
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    minWidth: '45%',
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  dateInputText: {
    fontSize: 16,
  },
  reasonInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
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

export default LeaveRequestScreen;


