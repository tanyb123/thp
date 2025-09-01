import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import salaryService from '../api/salaryService';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const SalarySlipCreationScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [fixedFees, setFixedFees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [attendanceInfo, setAttendanceInfo] = useState(null);
  const [advancePayments, setAdvancePayments] = useState([]);
  const [autoDeductions, setAutoDeductions] = useState([]);
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    deductions: [],
    allowances: [],
    bonuses: [],
    notes: '',
  });

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeModalType, setFeeModalType] = useState(''); // 'deduction', 'allowance', 'bonus'
  const [newFee, setNewFee] = useState({ name: '', amount: '' });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Load employees, fixed fees, etc.
      const [employeesData, fees] = await Promise.all([
        salaryService.getAllEmployees(),
        salaryService.getAllFixedFees(),
      ]);
      setEmployees(employeesData);
      setFixedFees(fees);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSalarySlip = async () => {
    if (!selectedEmployee) {
      Alert.alert('Lỗi', 'Vui lòng chọn nhân viên');
      return;
    }

    try {
      setLoading(true);

      // Sử dụng function tự động tạo phiếu lương
      const salaryData = {
        employeeId: selectedEmployee.id,
        month: formData.month,
        year: formData.year,
        deductions: formData.deductions,
        allowances: formData.allowances,
        bonuses: formData.bonuses,
        notes: formData.notes,
      };

      const salarySlip = await salaryService.createSalarySlipAuto(salaryData);

      Alert.alert(
        'Thành công',
        'Đã tạo phiếu lương. Bạn có muốn xuất Excel ngay không?',
        [
          { text: 'Không', style: 'cancel' },
          { text: 'Có', onPress: () => exportToExcel(salarySlip.id) },
        ]
      );

      // Reset form
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        deductions: [],
        allowances: [],
        bonuses: [],
        notes: '',
      });
      setSelectedEmployee(null);
      setEmployeeInfo(null);
      setAttendanceInfo(null);
    } catch (error) {
      console.error('Lỗi khi tạo phiếu lương:', error);
      Alert.alert('Lỗi', 'Không thể tạo phiếu lương');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async (salarySlipId) => {
    try {
      setLoading(true);

      // Đảm bảo user đã đăng nhập Google
      const signedIn = await GoogleSignin.isSignedIn();
      if (!signedIn) {
        Alert.alert(
          'Chưa đăng nhập Google',
          'Vui lòng đăng nhập với Google để xuất phiếu lương Excel.',
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Đăng nhập',
              onPress: async () => {
                try {
                  await GoogleSignin.hasPlayServices();
                  await GoogleSignin.signIn();
                  // Sau khi đăng nhập, thử lại
                  exportToExcel(salarySlipId);
                } catch (error) {
                  console.error('Google Sign In Error:', error);
                  Alert.alert('Lỗi', 'Không thể đăng nhập với Google.');
                }
              },
            },
          ]
        );
        return;
      }

      // Lấy access token từ Google Signin
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) {
        throw new Error('Không thể lấy quyền truy cập Google Drive');
      }

      console.log('Đã lấy Google access token thành công');

      // Gọi Cloud Function để xuất Excel - giống hệt quotation
      const { getFunctions, httpsCallable } = require('firebase/functions');
      const functions = getFunctions(undefined, 'asia-southeast1');
      const exportSalarySlip = httpsCallable(
        functions,
        'exportSalarySlipToDrive'
      );

      console.log('Gọi Firebase function với salarySlipId:', salarySlipId);
      const result = await exportSalarySlip({
        salarySlipId,
        accessToken,
      });

      console.log('Firebase function result:', JSON.stringify(result.data));

      if (result.data.success) {
        Alert.alert(
          'Thành công',
          `Đã xuất phiếu lương Excel vào Google Drive\nFile: ${result.data.fileName}\nFolder: PHIEU LUONG`
        );
      } else {
        throw new Error('Xuất Excel thất bại');
      }
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      Alert.alert('Lỗi', `Không thể xuất Excel: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addFee = (type) => {
    setFeeModalType(type);
    setNewFee({ name: '', amount: '' });
    setShowFeeModal(true);
  };

  // Tự động load thông tin nhân viên và chấm công khi chọn nhân viên
  const handleEmployeeSelect = async (employee) => {
    setSelectedEmployee(employee);

    try {
      setLoading(true);

      // Load thông tin lương của nhân viên
      const salaryInfo = await salaryService.getEmployeeSalaryInfo(employee.id);
      setEmployeeInfo(salaryInfo);

      // Load thông tin chấm công của tháng/năm hiện tại
      const attendance = await salaryService.getEmployeeAttendance(
        employee.id,
        formData.month,
        formData.year
      );
      setAttendanceInfo(attendance);

      // 3. Lấy thông tin ứng lương đã được duyệt
      const advances = await salaryService.getAdvancePayments(
        employee.id,
        formData.month,
        formData.year
      );
      setAdvancePayments(advances);

      // 4. Lấy danh sách phí cố định và tính khoản trừ dựa trên lương ước tính
      const estimatedGrossSalary = calculateEstimatedGrossSalary(
        salaryInfo,
        attendance
      );
      const fixedFeesList = await salaryService.getAllFixedFees();
      const autoDeductionsList = computeFixedDeductions(
        fixedFeesList,
        estimatedGrossSalary
      );
      setAutoDeductions(autoDeductionsList);

      console.log('=== DEBUG EMPLOYEE SELECT ===');
      console.log('Employee:', employee);
      console.log('Salary Info:', salaryInfo);
      console.log('Attendance Info:', attendance);
      console.log('Advance Payments:', advances);
      console.log('Auto Deductions:', autoDeductionsList);
    } catch (error) {
      console.error('Lỗi khi load thông tin nhân viên:', error);
      Alert.alert('Lỗi', 'Không thể load thông tin nhân viên');
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedGrossSalary = (empInfo, attendance) => {
    if (!empInfo || !attendance) return 0;

    const salaryByDays =
      (empInfo.dailySalary || 0) * (attendance.workingDays || 0);
    const overtimeSalary =
      (empInfo.dailySalary || 0) * 1.5 * (attendance.totalOvertime || 0);

    return salaryByDays + overtimeSalary;
  };

  // Tính các khoản trừ cố định từ cấu hình phí cố định
  const computeFixedDeductions = (fees, grossSalary) => {
    if (!Array.isArray(fees)) return [];
    const results = [];
    fees.forEach((fee) => {
      if (!fee?.isActive) return;
      if (fee.type !== 'deduction' && fee.type !== 'insurance') return;

      let amount = 0;
      if (fee.calculationType === 'percentage') {
        amount = ((grossSalary || 0) * Number(fee.percentage || 0)) / 100;
      } else {
        amount = Number(fee.amount || 0);
      }

      if (amount > 0) {
        results.push({
          name: fee.name,
          amount: Math.floor(amount),
          percentage:
            fee.calculationType === 'percentage'
              ? Number(fee.percentage)
              : undefined,
        });
      }
    });
    return results;
  };

  // Load lại thông tin chấm công khi thay đổi tháng/năm
  const handleMonthYearChange = async () => {
    if (!selectedEmployee) return;

    try {
      setLoading(true);

      // Load lại thông tin chấm công
      const attendance = await salaryService.getEmployeeAttendance(
        selectedEmployee.id,
        formData.month,
        formData.year
      );
      setAttendanceInfo(attendance);

      // Load lại ứng lương của tháng này
      const advances = await salaryService.getAdvancePayments(
        selectedEmployee.id,
        formData.month,
        formData.year
      );
      setAdvancePayments(advances);

      // Tính lại các khoản trừ cố định dựa trên cấu hình
      const estimatedGrossSalary = calculateEstimatedGrossSalary(
        employeeInfo,
        attendance
      );
      const fixedFeesList = await salaryService.getAllFixedFees();
      const autoDeductionsList = computeFixedDeductions(
        fixedFeesList,
        estimatedGrossSalary
      );
      setAutoDeductions(autoDeductionsList);
    } catch (error) {
      console.error('Lỗi khi load thông tin chấm công:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFee = () => {
    if (!newFee.name.trim() || !newFee.amount.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const fee = {
      id: Date.now().toString(),
      name: newFee.name,
      amount: parseFloat(newFee.amount),
    };

    if (feeModalType === 'deduction') {
      setFormData({
        ...formData,
        deductions: [...formData.deductions, fee],
      });
    } else if (feeModalType === 'allowance') {
      setFormData({
        ...formData,
        allowances: [...formData.allowances, fee],
      });
    } else if (feeModalType === 'bonus') {
      setFormData({
        ...formData,
        bonuses: [...formData.bonuses, fee],
      });
    }

    setShowFeeModal(false);
  };

  const removeFee = (type, feeId) => {
    if (type === 'deduction') {
      setFormData({
        ...formData,
        deductions: formData.deductions.filter((f) => f.id !== feeId),
      });
    } else if (type === 'allowance') {
      setFormData({
        ...formData,
        allowances: formData.allowances.filter((f) => f.id !== feeId),
      });
    } else if (type === 'bonus') {
      setFormData({
        ...formData,
        bonuses: formData.bonuses.filter((f) => f.id !== feeId),
      });
    }
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
            Đang xử lý...
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
        <Text style={styles.headerTitle}>Tạo phiếu lương</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Thông tin nhân viên */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Thông tin nhân viên
          </Text>

          <TouchableOpacity
            style={[styles.employeeSelector, { borderColor: theme.border }]}
            onPress={() => setShowEmployeeModal(true)}
          >
            {selectedEmployee ? (
              <Text style={[styles.employeeName, { color: theme.text }]}>
                {selectedEmployee.name}
              </Text>
            ) : (
              <Text
                style={[styles.placeholderText, { color: theme.textMuted }]}
              >
                Chọn nhân viên
              </Text>
            )}
            <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
          </TouchableOpacity>

          {/* Hiển thị thông tin tự động */}
          {selectedEmployee && employeeInfo && (
            <View style={styles.autoInfoContainer}>
              <Text style={[styles.autoInfoTitle, { color: theme.primary }]}>
                Thông tin tự động từ hệ thống
              </Text>

              <View style={styles.autoInfoGrid}>
                <View style={styles.autoInfoItem}>
                  <Text
                    style={[
                      styles.autoInfoLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Lương theo ngày
                  </Text>
                  <Text style={[styles.autoInfoValue, { color: theme.text }]}>
                    {formatCurrency(employeeInfo.dailySalary)}
                  </Text>
                </View>

                <View style={styles.autoInfoItem}>
                  <Text
                    style={[
                      styles.autoInfoLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Lương tháng (dự kiến)
                  </Text>
                  <Text
                    style={[styles.autoInfoValue, { color: theme.primary }]}
                  >
                    {formatCurrency(
                      // Nếu có lương cố định theo tháng thì dùng cái đó
                      employeeInfo.monthlySalary &&
                        employeeInfo.monthlySalary > 0
                        ? employeeInfo.monthlySalary
                        : (employeeInfo.dailySalary || 0) *
                            (attendanceInfo?.workingDays || 0)
                    )}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Thông tin lương cơ bản */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Thông tin lương cơ bản
          </Text>

          <View style={styles.formRow}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>
                Tháng
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={formData.month.toString()}
                onChangeText={(text) => {
                  setFormData({ ...formData, month: parseInt(text) || 1 });
                  handleMonthYearChange();
                }}
                keyboardType="numeric"
                placeholder="1-12"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Năm</Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={formData.year.toString()}
                onChangeText={(text) => {
                  setFormData({ ...formData, year: parseInt(text) || 2024 });
                  handleMonthYearChange();
                }}
                keyboardType="numeric"
                placeholder="2024"
              />
            </View>
          </View>

          {/* Hiển thị thông tin chấm công tự động */}
          {selectedEmployee && attendanceInfo && (
            <View style={styles.attendanceInfoContainer}>
              <Text
                style={[styles.attendanceInfoTitle, { color: theme.primary }]}
              >
                Thông tin chấm công tháng {formData.month}/{formData.year}
              </Text>

              <View style={styles.attendanceInfoGrid}>
                <View style={styles.attendanceInfoItem}>
                  <Text
                    style={[
                      styles.attendanceInfoLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Số ngày công
                  </Text>
                  <Text
                    style={[styles.attendanceInfoValue, { color: theme.text }]}
                  >
                    {attendanceInfo.workingDays} ngày
                  </Text>
                </View>

                <View style={styles.attendanceInfoItem}>
                  <Text
                    style={[
                      styles.attendanceInfoLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Số ngày tăng ca
                  </Text>
                  <Text
                    style={[styles.attendanceInfoValue, { color: theme.text }]}
                  >
                    {attendanceInfo.totalOvertime} ngày
                  </Text>
                </View>
              </View>

              {/* Debug Info */}
              <View style={styles.debugInfoContainer}>
                <Text
                  style={[
                    styles.debugInfoTitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  Debug Info:
                </Text>
                <Text
                  style={[styles.debugInfoText, { color: theme.textSecondary }]}
                >
                  Số ngày công: {attendanceInfo.workingDays} ngày
                </Text>
                <Text
                  style={[styles.debugInfoText, { color: theme.textSecondary }]}
                >
                  Số ngày tăng ca: {attendanceInfo.totalOvertime} ngày
                </Text>
                <Text
                  style={[styles.debugInfoText, { color: theme.textSecondary }]}
                >
                  Records: {attendanceInfo.attendances?.length || 0}
                </Text>

                {/* Test Button */}
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={async () => {
                    try {
                      const debugData = await salaryService.debugAttendanceData(
                        selectedEmployee.id,
                        formData.month,
                        formData.year
                      );
                      console.log('Manual Debug Result:', debugData);
                      Alert.alert(
                        'Debug',
                        `Found ${debugData.length} records. Check console for details.`
                      );
                    } catch (error) {
                      console.error('Debug error:', error);
                      Alert.alert('Debug Error', error.message);
                    }
                  }}
                >
                  <Text style={styles.testButtonText}>Test Debug</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Khấu trừ */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Khấu trừ (Tự động từ hệ thống)
            </Text>
            <Text
              style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
            >
              Bảo hiểm và phụ phí được tính tự động
            </Text>
          </View>

          {/* Khấu trừ tự động từ Fixed Fees */}
          {autoDeductions.length > 0 && (
            <View style={styles.autoDeductionsContainer}>
              <Text
                style={[styles.autoDeductionsTitle, { color: theme.primary }]}
              >
                Khấu trừ tự động:
              </Text>

              {autoDeductions.map((deduction, index) => (
                <View key={index} style={styles.autoDeductionItem}>
                  <Text
                    style={[styles.autoDeductionName, { color: theme.text }]}
                  >
                    {deduction.name}{' '}
                    {deduction.percentage
                      ? `(${deduction.percentage}% lương)`
                      : ''}
                  </Text>
                  <Text
                    style={[styles.autoDeductionAmount, { color: '#F44336' }]}
                  >
                    {formatCurrency(deduction.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Ứng lương tự động */}
          {advancePayments.length > 0 && (
            <View style={styles.autoDeductionsContainer}>
              <Text
                style={[styles.autoDeductionsTitle, { color: theme.primary }]}
              >
                Ứng lương đã duyệt (sẽ tự động trừ):
              </Text>

              {advancePayments.map((advance, index) => (
                <View key={index} style={styles.autoDeductionItem}>
                  <Text
                    style={[styles.autoDeductionName, { color: theme.text }]}
                  >
                    {advance.reason || 'Ứng lương trước'}
                  </Text>
                  <Text
                    style={[styles.autoDeductionAmount, { color: '#F44336' }]}
                  >
                    {formatCurrency(advance.approvedAmount || advance.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Khấu trừ thủ công (nếu cần) */}
          <View style={styles.manualDeductionsContainer}>
            <Text
              style={[
                styles.manualDeductionsTitle,
                { color: theme.textSecondary },
              ]}
            >
              Khấu trừ thủ công (nếu cần):
            </Text>

            {formData.deductions.map((deduction) => (
              <View key={deduction.id} style={styles.feeItem}>
                <View style={styles.feeInfo}>
                  <Text style={[styles.feeName, { color: theme.text }]}>
                    {deduction.name}
                  </Text>
                  <Text style={[styles.feeAmount, { color: '#F44336' }]}>
                    {formatCurrency(deduction.amount)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFee('deduction', deduction.id)}
                >
                  <Ionicons name="close-circle" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: '#F44336' }]}
              onPress={() => addFee('deduction')}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Phụ cấp */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Phụ cấp
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => addFee('allowance')}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {formData.allowances.map((allowance) => (
            <View key={allowance.id} style={styles.feeItem}>
              <View style={styles.feeInfo}>
                <Text style={[styles.feeName, { color: theme.text }]}>
                  {allowance.name}
                </Text>
                <Text style={[styles.feeAmount, { color: '#4CAF50' }]}>
                  {formatCurrency(allowance.amount)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFee('allowance', allowance.id)}
              >
                <Ionicons name="close-circle" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Thưởng */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Thưởng
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: '#FF9800' }]}
              onPress={() => addFee('bonus')}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {formData.bonuses.map((bonus) => (
            <View key={bonus.id} style={styles.feeItem}>
              <View style={styles.feeInfo}>
                <Text style={[styles.feeName, { color: theme.text }]}>
                  {bonus.name}
                </Text>
                <Text style={[styles.feeAmount, { color: '#FF9800' }]}>
                  {formatCurrency(bonus.amount)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFee('bonus', bonus.id)}
              >
                <Ionicons name="close-circle" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Tổng kết phiếu lương */}
        {selectedEmployee && employeeInfo && attendanceInfo && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Tổng kết lương
              </Text>
            </View>

            <View style={styles.summaryContainer}>
              {/* Lương gộp */}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.text }]}>
                  Lương theo ngày:
                </Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>
                  {formatCurrency(
                    (employeeInfo.dailySalary || 0) *
                      (attendanceInfo.workingDays || 0)
                  )}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.text }]}>
                  Lương tăng ca:
                </Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>
                  {formatCurrency(
                    (employeeInfo.dailySalary || 0) *
                      1.5 *
                      (attendanceInfo.totalOvertime || 0)
                  )}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.text }]}>
                  Tổng phụ cấp:
                </Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {formatCurrency(
                    formData.allowances.reduce(
                      (sum, item) => sum + parseFloat(item.amount),
                      0
                    )
                  )}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.text }]}>
                  Tổng thưởng:
                </Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {formatCurrency(
                    formData.bonuses.reduce(
                      (sum, item) => sum + parseFloat(item.amount),
                      0
                    )
                  )}
                </Text>
              </View>

              <View style={[styles.summaryRow, styles.summaryDivider]}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: theme.text, fontWeight: '600' },
                  ]}
                >
                  Tổng lương gộp:
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: theme.primary, fontWeight: '600' },
                  ]}
                >
                  {formatCurrency(
                    (employeeInfo.dailySalary || 0) *
                      (attendanceInfo.workingDays || 0) +
                      (employeeInfo.dailySalary || 0) *
                        1.5 *
                        (attendanceInfo.totalOvertime || 0) +
                      formData.allowances.reduce(
                        (sum, item) => sum + parseFloat(item.amount),
                        0
                      ) +
                      formData.bonuses.reduce(
                        (sum, item) => sum + parseFloat(item.amount),
                        0
                      )
                  )}
                </Text>
              </View>

              {/* Khấu trừ */}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.text }]}>
                  Khấu trừ tự động:
                </Text>
                <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                  -
                  {formatCurrency(
                    autoDeductions.reduce(
                      (sum, item) => sum + parseFloat(item.amount),
                      0
                    )
                  )}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.text }]}>
                  Ứng lương trừ:
                </Text>
                <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                  -
                  {formatCurrency(
                    advancePayments.reduce(
                      (sum, item) =>
                        sum + parseFloat(item.approvedAmount || item.amount),
                      0
                    )
                  )}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.text }]}>
                  Khấu trừ khác:
                </Text>
                <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                  -
                  {formatCurrency(
                    formData.deductions.reduce(
                      (sum, item) => sum + parseFloat(item.amount),
                      0
                    )
                  )}
                </Text>
              </View>

              {/* Lương thực nhận */}
              <View style={[styles.summaryRow, styles.netSalaryRow]}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: theme.text, fontWeight: 'bold', fontSize: 16 },
                  ]}
                >
                  LƯƠNG THỰC NHẬN:
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: '#4CAF50', fontWeight: 'bold', fontSize: 18 },
                  ]}
                >
                  {formatCurrency(
                    (employeeInfo.dailySalary || 0) *
                      (attendanceInfo.workingDays || 0) +
                      (employeeInfo.dailySalary || 0) *
                        1.5 *
                        (attendanceInfo.totalOvertime || 0) +
                      formData.allowances.reduce(
                        (sum, item) => sum + parseFloat(item.amount),
                        0
                      ) +
                      formData.bonuses.reduce(
                        (sum, item) => sum + parseFloat(item.amount),
                        0
                      ) -
                      autoDeductions.reduce(
                        (sum, item) => sum + parseFloat(item.amount),
                        0
                      ) -
                      advancePayments.reduce(
                        (sum, item) =>
                          sum + parseFloat(item.approvedAmount || item.amount),
                        0
                      ) -
                      formData.deductions.reduce(
                        (sum, item) => sum + parseFloat(item.amount),
                        0
                      )
                  )}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Ghi chú */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Ghi chú
          </Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            placeholder="Ghi chú về phiếu lương..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Nút tạo phiếu lương */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={handleCreateSalarySlip}
          disabled={loading}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Tạo phiếu lương</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal chọn nhân viên */}
      <Modal
        visible={showEmployeeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmployeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.background }]}
          >
            <View
              style={[styles.modalHeader, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.modalTitle}>Chọn nhân viên</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowEmployeeModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {employees.length === 0 ? (
                <Text style={[styles.modalText, { color: theme.text }]}>
                  Không có nhân viên nào
                </Text>
              ) : (
                employees.map((employee) => (
                  <TouchableOpacity
                    key={employee.id}
                    style={[
                      styles.employeeItem,
                      {
                        backgroundColor:
                          selectedEmployee?.id === employee.id
                            ? theme.primary + '20'
                            : theme.background,
                      },
                    ]}
                    onPress={() => {
                      handleEmployeeSelect(employee);
                      setShowEmployeeModal(false);
                    }}
                  >
                    <View style={styles.employeeItemInfo}>
                      <Text
                        style={[styles.employeeItemName, { color: theme.text }]}
                      >
                        {employee.name}
                      </Text>
                      <Text
                        style={[
                          styles.employeeItemRole,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {employee.role}
                      </Text>
                      <Text
                        style={[
                          styles.employeeItemSalary,
                          { color: theme.primary },
                        ]}
                      >
                        Lương theo ngày:{' '}
                        {formatCurrency(employee.dailySalary || 0)}
                      </Text>
                      <Text
                        style={[
                          styles.employeeItemSalary,
                          { color: theme.primary },
                        ]}
                      >
                        Lương cố định tháng:{' '}
                        {formatCurrency(employee.monthlySalary || 0)}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.textMuted}
                    />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal thêm phí */}
      <Modal
        visible={showFeeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.background }]}
          >
            <View
              style={[styles.modalHeader, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.modalTitle}>
                Thêm{' '}
                {feeModalType === 'deduction'
                  ? 'khấu trừ'
                  : feeModalType === 'allowance'
                  ? 'phụ cấp'
                  : 'thưởng'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFeeModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Tên
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={newFee.name}
                  onChangeText={(text) => setNewFee({ ...newFee, name: text })}
                  placeholder="Nhập tên..."
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>
                  Số tiền (VNĐ)
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={newFee.amount}
                  onChangeText={(text) =>
                    setNewFee({ ...newFee, amount: text })
                  }
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.textMuted },
                ]}
                onPress={() => setShowFeeModal(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveFee}
              >
                <Text style={styles.modalButtonText}>Thêm</Text>
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
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  employeeSelector: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '500',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formGroup: {
    flex: 1,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
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
  addButton: {
    padding: 8,
    borderRadius: 8,
  },
  feeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  feeInfo: {
    flex: 1,
  },
  feeName: {
    fontSize: 14,
    fontWeight: '500',
  },
  feeAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  autoInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  autoInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  autoInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  autoInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  autoInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  autoInfoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  autoDeductionsContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
    borderRadius: 8,
  },
  autoDeductionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  autoDeductionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  autoDeductionName: {
    fontSize: 14,
    flex: 1,
  },
  autoDeductionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  manualDeductionsContainer: {
    marginTop: 16,
  },
  manualDeductionsTitle: {
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  debugInfoContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#FFC107',
  },
  debugInfoTitle: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  debugInfoText: {
    fontSize: 10,
    marginBottom: 2,
  },
  testButton: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#FFC107',
    borderRadius: 4,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 10,
    color: '#000',
    fontWeight: '600',
  },
  attendanceInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  attendanceInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  attendanceInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  attendanceInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  attendanceInfoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  employeeItemInfo: {
    flex: 1,
  },
  employeeItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeItemRole: {
    fontSize: 14,
    marginBottom: 4,
  },
  employeeItemSalary: {
    fontSize: 14,
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  summaryContainer: {
    paddingVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  summaryLabel: {
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  summaryDivider: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.2)',
    marginVertical: 8,
  },
  netSalaryRow: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
    marginTop: 8,
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
  modalText: {
    fontSize: 16,
    textAlign: 'center',
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

export default SalarySlipCreationScreen;
