// src/screens/AttendanceScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../config/firebaseConfig';
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import {
  setPresence,
  getAttendance,
  addOvertime,
} from '../api/attendanceService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getApp } from 'firebase/app';
import { useAuth } from '../contexts/AuthContext';

const AttendanceScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth(); // Get user from AuthContext
  const isAccountant = user?.role === 'ke_toan'; // Check if user is an accountant

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savingTarget, setSavingTarget] = useState(null); // 'present' | 'overtime' | 'export' | null
  const [attMap, setAttMap] = useState({}); // uid -> attendance doc
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeHours, setOvertimeHours] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const functions = getFunctions(getApp(), 'asia-southeast1');

  // Add default overtime hours
  const DEFAULT_OVERTIME_HOURS = 3; // Default 3 hours (20:30)

  // Format date for display
  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Format date for document ID
  const formatDateForDoc = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('displayName', 'asc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      setEmployees(list);
      await fetchAttendanceForDate(selectedDate);
    } catch (err) {
      console.error('Load employees err', err);
      Alert.alert('Lỗi', 'Không thể tải danh sách nhân viên');
      setLoading(false);
    }
  };

  const fetchAttendanceForDate = async (date) => {
    setLoading(true);
    try {
      if (!employees.length) return;

      // Format date to YYYY-MM-DD for attendance lookup
      const dateStr = formatDateForDoc(date);

      // load attendance info
      const dateFetchPromises = employees.map((emp) =>
        getAttendance(emp.uid, dateStr)
      );
      const results = await Promise.all(dateFetchPromises);
      const map = {};
      results.forEach((doc) => {
        if (doc) map[doc.userId] = doc;
      });
      setAttMap(map);
    } catch (err) {
      console.error('Load attendance err', err);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchAttendanceForDate(selectedDate);
    }
  }, [selectedDate, employees.length]);

  const togglePresent = async (emp) => {
    try {
      setSavingId(emp.uid);
      setSavingTarget('present');
      const current = attMap[emp.uid]?.present || false;
      const updated = await setPresence(emp.uid, !current, selectedDate);
      setAttMap((prev) => ({ ...prev, [emp.uid]: updated }));
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể cập nhật');
    } finally {
      setSavingId(null);
      setSavingTarget(null);
    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  // Add delete employee function
  const deleteEmployee = async (emp) => {
    try {
      setSavingId(emp.uid);
      await deleteDoc(doc(db, 'users', emp.uid));
      setEmployees((prev) => prev.filter((e) => e.uid !== emp.uid));
      Alert.alert('Thành công', 'Đã xóa nhân viên');
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể xóa nhân viên');
    } finally {
      setSavingId(null);
    }
  };

  // Improve markAllPresent to be more efficient
  const markAllPresent = async () => {
    try {
      // Use a temporary state to show loading indicators on each row
      const tempIds = employees.map((e) => e.uid);
      setSavingId('present_all'); // Special marker for bulk present
      setSavingTarget('present');
      const promises = employees.map((emp) =>
        setPresence(emp.uid, true, selectedDate)
      );
      await Promise.all(promises);

      // Update local state without full reload
      const newAttMap = { ...attMap };
      employees.forEach((emp) => {
        const uid = emp.uid;
        if (newAttMap[uid]) {
          newAttMap[uid].present = true;
        } else {
          newAttMap[uid] = {
            userId: uid,
            present: true,
            date: formatDateForDoc(selectedDate),
          };
        }
      });
      setAttMap(newAttMap);
      setSavingId(null);
      setSavingTarget(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể cập nhật tất cả');
      setSavingId(null);
      setSavingTarget(null);
    }
  };

  // Add markAllOvertime function
  const markAllOvertime = async () => {
    try {
      setSavingId('overtime_all');
      setSavingTarget('overtime');
      const promises = employees.map((emp) =>
        addOvertime(emp.uid, DEFAULT_OVERTIME_HOURS, selectedDate)
      );
      await Promise.all(promises);

      // Update local state
      const newAttMap = { ...attMap };
      employees.forEach((emp) => {
        const uid = emp.uid;
        if (newAttMap[uid]) {
          newAttMap[uid].overtime = DEFAULT_OVERTIME_HOURS;
        } else {
          newAttMap[uid] = {
            userId: uid,
            overtime: DEFAULT_OVERTIME_HOURS,
            date: formatDateForDoc(selectedDate),
          };
        }
      });
      setAttMap(newAttMap);
      setSavingId(null);
      setSavingTarget(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể cập nhật tăng ca');
      setSavingId(null);
      setSavingTarget(null);
    }
  };

  // Add a function to toggle overtime directly
  const toggleOvertime = async (emp) => {
    try {
      setSavingId(emp.uid);
      setSavingTarget('overtime');
      const current = attMap[emp.uid]?.overtime || 0;
      const newValue = current > 0 ? 0 : DEFAULT_OVERTIME_HOURS;
      const updated = await addOvertime(emp.uid, newValue, selectedDate);
      setAttMap((prev) => ({ ...prev, [emp.uid]: updated }));
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể cập nhật tăng ca');
    } finally {
      setSavingId(null);
      setSavingTarget(null);
    }
  };

  const handleAddOvertime = async () => {
    if (!selectedEmployee) return;

    const hours = parseFloat(overtimeHours);
    if (isNaN(hours) || hours < 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số giờ hợp lệ');
      return;
    }

    try {
      setSavingId(selectedEmployee.uid);
      await addOvertime(selectedEmployee.uid, hours, selectedDate);
      setShowOvertimeModal(false);
      setOvertimeHours('');
      setSelectedEmployee(null);
      await fetchAttendanceForDate(selectedDate);
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể thêm giờ tăng ca');
    } finally {
      setSavingId(null);
    }
  };

  const openOvertimeModal = (emp) => {
    setSelectedEmployee(emp);
    setOvertimeHours('');
    setShowOvertimeModal(true);
  };

  // Export attendance data to Excel
  const exportToExcel = async () => {
    try {
      setSavingId('export');
      setSavingTarget('export');

      // Get current year and month from selectedDate
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1; // JavaScript months are 0-indexed

      // Show confirmation alert
      Alert.alert(
        'Xuất báo cáo chấm công',
        `Xuất dữ liệu chấm công tháng ${month}/${year}?`,
        [
          {
            text: 'Hủy',
            style: 'cancel',
            onPress: () => setSavingId(null),
          },
          {
            text: 'Xuất Excel',
            onPress: async () => {
              try {
                // Get the Google access token
                // In a real app, you'd fetch this from your authentication service
                // For now, we'll assume you have a function to get it
                const accessToken = await getGoogleAccessToken();

                if (!accessToken) {
                  Alert.alert('Lỗi', 'Không thể lấy Google access token');
                  setSavingId(null);
                  setSavingTarget(null);
                  return;
                }

                // Call the Cloud Function to generate the Excel file
                const generateAttendanceExcel = httpsCallable(
                  functions,
                  'generateExcelAttendance'
                );
                const result = await generateAttendanceExcel({
                  year,
                  month,
                  accessToken,
                });

                // Check if successful
                if (result.data.success) {
                  // Open the Excel file in a browser
                  await WebBrowser.openBrowserAsync(result.data.fileUrl);
                  Alert.alert(
                    'Thành công',
                    'Đã tạo file Excel báo cáo chấm công'
                  );
                } else {
                  Alert.alert('Lỗi', 'Không thể tạo file Excel');
                }
              } catch (error) {
                console.error('Export Excel error:', error);
                Alert.alert('Lỗi', `Không thể xuất Excel: ${error.message}`);
              } finally {
                setSavingId(null);
                setSavingTarget(null);
              }
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            setSavingId(null);
            setSavingTarget(null);
          },
        }
      );
    } catch (error) {
      console.error('Export Excel prepare error:', error);
      Alert.alert('Lỗi', 'Không thể chuẩn bị xuất Excel');
      setSavingId(null);
      setSavingTarget(null);
    }
  };

  // Get Google access token using GoogleSignin - same approach as other Excel generators
  const getGoogleAccessToken = async () => {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        Alert.alert(
          'Chưa đăng nhập Google',
          'Vui lòng đăng nhập với Google để xuất dữ liệu.',
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Đăng nhập',
              onPress: async () => {
                try {
                  await GoogleSignin.hasPlayServices();
                  await GoogleSignin.signIn();
                  // After signing in, retry
                  exportToExcel();
                } catch (error) {
                  console.error('Google Sign In Error:', error);
                  Alert.alert('Lỗi', 'Không thể đăng nhập với Google.');
                }
              },
            },
          ]
        );
        return null;
      }

      // User is signed in, get token
      const tokens = await GoogleSignin.getTokens();
      if (!tokens || !tokens.accessToken) {
        throw new Error('Không lấy được token Google');
      }

      console.log('Đã lấy Google access token thành công');
      return tokens.accessToken;
    } catch (error) {
      console.error('Google token error:', error);
      Alert.alert(
        'Lỗi xác thực',
        'Không lấy được token Google: ' + error.message
      );
      return null;
    }
  };

  const renderItem = ({ item }) => {
    const attendance = attMap[item.uid];
    const present = attendance?.present;
    const overtime = attendance?.overtime || 0;
    const isSavingPresent =
      (savingId === item.uid && savingTarget === 'present') ||
      savingId === 'present_all';
    const isSavingOvertime =
      (savingId === item.uid && savingTarget === 'overtime') ||
      savingId === 'overtime_all';

    return (
      <View
        style={[
          styles.row,
          { backgroundColor: theme.card, marginBottom: 8, borderRadius: 8 },
        ]}
      >
        <View style={styles.employeeInfo}>
          <Text
            style={[styles.nameText, { color: theme.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.displayName || item.email || item.uid}
          </Text>
          <Text style={[styles.roleText, { color: theme.textSecondary }]}>
            {item.role ? getRoleLabel(item.role) : 'Nhân viên'}
          </Text>
        </View>

        {overtime > 0 && (
          <TouchableOpacity
            style={styles.overtimeBadge}
            onPress={() => !isAccountant && openOvertimeModal(item)}
            disabled={isAccountant}
          >
            <Ionicons
              name="time"
              size={12}
              color="#8B7500"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.overtimeText}>
              {overtime === 2.5 ? '20:30' : `+${overtime}h`}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.attendanceActions}>
          <TouchableOpacity
            onPress={() => !isAccountant && togglePresent(item)}
            disabled={isSavingPresent || isAccountant}
            style={styles.checkButton}
          >
            {isSavingPresent ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons
                name={present ? 'checkbox' : 'square-outline'}
                size={24}
                color={present ? theme.primary : theme.textMuted}
              />
            )}
          </TouchableOpacity>

          <View style={styles.overtimeActionContainer}>
            <TouchableOpacity
              onPress={() => !isAccountant && toggleOvertime(item)}
              disabled={isSavingOvertime || isAccountant}
              style={styles.checkButtonOvertime}
            >
              {isSavingOvertime ? (
                <ActivityIndicator
                  size="small"
                  color={theme.success || '#4CAF50'}
                />
              ) : (
                <Ionicons
                  name={overtime > 0 ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={
                    overtime > 0 ? theme.success || '#4CAF50' : theme.textMuted
                  }
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const addEmployee = async () => {
    if (!newName.trim()) {
      Alert.alert('Thiếu tên');
      return;
    }
    try {
      const usersRef = collection(db, 'users');
      await addDoc(usersRef, {
        displayName: newName,
        email: newEmail.trim() || '',
        role: 'cong_nhan',
        createdAt: serverTimestamp(),
      });
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      fetchEmployees();
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể thêm nhân viên');
    }
  };

  // Helper function to format overtime display
  const formatOvertimeForDisplay = (hours) => {
    return `+${hours}h`;
  };

  // Helper function to map role keys to display labels
  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Quản trị viên';
      case 'giam_doc':
        return 'Giám đốc';
      case 'pho_giam_doc':
        return 'Phó Giám đốc';
      case 'quan_ly':
        return 'Quản lý';
      case 'ky_su':
        return 'Kỹ sư';
      case 'ke_toan':
        return 'Kế toán';
      case 'thuong_mai':
        return 'Thương mại';
      case 'cong_nhan':
        return 'Công nhân';
      case 'user':
        return 'Người dùng';
      default:
        return 'Không xác định';
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Chấm Công & Tăng Ca
        </Text>

        <TouchableOpacity
          style={[styles.dateButton, { borderColor: theme.border }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={18} color={theme.primary} />
          <Text style={[styles.dateText, { color: theme.text }]}>
            {formatDisplayDate(selectedDate)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.actionBar}>
        {!isAccountant && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.secondary || '#FF9500' },
            ]}
            onPress={markAllPresent}
            disabled={savingId === 'all' || isAccountant}
          >
            {savingId === 'all' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="checkbox"
                  size={18}
                  color="#fff"
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>Chấm Công Tất Cả</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: theme.success || '#4CAF50' },
          ]}
          onPress={() => exportToExcel()}
          disabled={savingId === 'export'}
        >
          {savingId === 'export' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name="document-text"
                size={18}
                color="#fff"
                style={styles.actionIcon}
              />
              <Text style={styles.actionText}>Xuất Excel</Text>
            </>
          )}
        </TouchableOpacity>

        {isAccountant && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.info || '#007BFF' },
            ]}
            onPress={() => navigation.navigate('AssignSalary')}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color="#fff"
              style={styles.actionIcon}
            />
            <Text style={styles.actionText}>Gán Lương</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Employee list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          ListHeaderComponent={
            <>
              <View style={styles.listHeaderContainer}>
                <Text style={[styles.listHeaderLabel, { flex: 1 }]}>
                  Tên nhân viên
                </Text>
                <Text
                  style={[
                    styles.listHeaderLabel,
                    {
                      width: 80,
                      textAlign: 'center',
                      transform: [{ translateX: 3 }],
                    },
                  ]}
                >
                  Chấm công
                </Text>
                <Text
                  style={[
                    styles.listHeaderLabel,
                    {
                      width: 80,
                      textAlign: 'center',
                      transform: [{ translateX: 6 }],
                    },
                  ]}
                >
                  Tăng ca
                </Text>
              </View>
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
            </>
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Chưa có nhân viên nào
              </Text>
            </View>
          }
        />
      )}

      {/* Add employee button */}
      {!isAccountant && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Date picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {/* Add employee modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Thêm nhân viên
            </Text>
            <TextInput
              placeholder="Tên"
              value={newName}
              onChangeText={setNewName}
              style={[
                styles.input,
                { borderColor: theme.border, color: theme.text },
              ]}
              placeholderTextColor={theme.textMuted}
            />
            <TextInput
              placeholder="Email (tuỳ chọn)"
              value={newEmail}
              onChangeText={setNewEmail}
              style={[
                styles.input,
                { borderColor: theme.border, color: theme.text },
              ]}
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={{ color: theme.text }}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addEmployee}
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.saveButtonText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Overtime modal */}
      <Modal visible={showOvertimeModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Thêm giờ tăng ca
            </Text>
            <Text
              style={[
                styles.overtimeEmployeeName,
                { color: theme.textSecondary },
              ]}
            >
              {selectedEmployee?.displayName || ''}
            </Text>

            <TextInput
              placeholder="Số giờ tăng ca"
              value={overtimeHours}
              onChangeText={setOvertimeHours}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                { borderColor: theme.border, color: theme.text },
              ]}
              placeholderTextColor={theme.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowOvertimeModal(false)}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={{ color: theme.text }}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddOvertime}
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.saveButtonText}>Lưu</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateText: {
    marginHorizontal: 8,
    fontSize: 14,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    justifyContent: 'space-around',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
  },
  actionIcon: {
    marginRight: 6,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    width: '100%',
    marginTop: 8,
  },
  listHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  listHeaderLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  employeeInfo: {
    flex: 1,
    marginRight: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '500',
  },
  roleText: {
    fontSize: 12,
    marginTop: 2,
    flexBasis: '100%',
  },
  attendanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overtimeActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'center',
  },
  overtimeBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overtimeText: {
    color: '#8B7500',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkButton: {
    width: 80,
    alignItems: 'center',
  },
  checkButtonOvertime: {
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  overtimeEmployeeName: {
    marginBottom: 12,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default AttendanceScreen;
