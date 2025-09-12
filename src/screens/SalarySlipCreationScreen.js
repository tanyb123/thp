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
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import salaryService from '../api/salaryService';
import { getUsers } from '../api/userService';
import * as Clipboard from 'expo-clipboard';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Helper function to format currency
const formatCurrency = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 VNĐ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

const SalarySlipCreationScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null); // salary, insurance base, leave balance
  const [attendanceInfo, setAttendanceInfo] = useState(null); // attendance summary
  const [autoDeductions, setAutoDeductions] = useState([]);
  const [advancePayments, setAdvancePayments] = useState([]);
  const [systemSettings, setSystemSettings] = useState(null);

  // Modal kết quả sau khi tạo
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [lastCreatedSlip, setLastCreatedSlip] = useState(null);

  // Quản lý slip hiện tại theo kỳ lương đang chọn
  const [currentSlip, setCurrentSlip] = useState(null);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [exportLink, setExportLink] = useState('');

  const formatDateVN = (d) => {
    try {
      const date = d?.toDate ? d.toDate() : new Date(d);
      if (isNaN(date)) return '';
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    allowances: [],
    bonuses: [],
    deductions: [], // Manual deductions only
    notes: '',
  });

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeModalType, setFeeModalType] = useState(''); // 'allowance' | 'bonus' | 'deduction'
  const [newFee, setNewFee] = useState({ name: '', amount: '' });
  const [otModalVisible, setOtModalVisible] = useState(false);

  // Map fee type to localized label
  const feeTypeLabel = (type) => {
    switch (type) {
      case 'allowance':
        return 'phụ cấp'; // yêu cầu: "thêm phụ cấp"
      case 'bonus':
        return 'Thưởng'; // yêu cầu: "thêm Thưởng"
      case 'deduction':
        return 'khấu trừ';
      default:
        return type || '';
    }
  };

  // Load employees
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoading(true);
        const users = await getUsers();
        setEmployees(users);
      } catch (error) {
        Alert.alert('Lỗi', 'Không thể tải danh sách nhân viên.');
      } finally {
        setLoading(false);
      }
    };
    loadEmployees();
  }, []);

  const resetForm = () => {
    setSelectedEmployee(null);
    setEmployeeInfo(null);
    setAttendanceInfo(null);
    setAutoDeductions([]);
    setSystemSettings(null);
    setFormData({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      allowances: [],
      bonuses: [],
      deductions: [],
      notes: '',
    });
  };

  // Load employee details and attendance when an employee is selected
  const handleEmployeeSelect = async (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeModal(false);
    await fetchEmployeeData(employee.id, formData.month, formData.year);
  };

  // Fetch all necessary data for the selected employee and period
  const fetchEmployeeData = async (employeeId, month, year) => {
    try {
      setLoading(true);
      // Lấy đồng thời tất cả dữ liệu cần thiết
      const [details, attendance, settings, advances] = await Promise.all([
        salaryService.getEmployeeDetails(employeeId),
        salaryService.getEmployeeAttendance(employeeId, month, year),
        salaryService.getSystemSettings(),
        salaryService.getAdvancePayments(employeeId, month, year),
      ]);

      console.log('DEBUG fetchEmployeeData advances:', advances);

      // Tính khấu trừ tự động để hiển thị (dùng lương đóng BHXH cố định)
      const autoDeds = await salaryService.getAutoDeductions(
        details.insuranceContributionBase || 0
      );

      setEmployeeInfo(details);
      setAttendanceInfo(attendance);
      setSystemSettings(settings);
      setAutoDeductions(autoDeds);
      setAdvancePayments(Array.isArray(advances) ? advances : []);
    } catch (error) {
      Alert.alert(
        'Lỗi',
        `Không thể tải dữ liệu cho nhân viên: ${error.message}`
      );
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  // Refetch data when month/year changes
  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeData(selectedEmployee.id, formData.month, formData.year);
    }
  }, [formData.month, formData.year]);

  // Fetch current slip for selected employee & period and clear previous export state
  const refreshCurrentSlip = async () => {
    if (!selectedEmployee) return;
    try {
      const slips = await salaryService.getSalarySlips({
        employeeId: selectedEmployee.id,
        month: formData.month,
        year: formData.year,
      });
      setCurrentSlip(slips && slips.length > 0 ? slips[0] : null);
      setExportLink('');
    } catch (e) {
      setCurrentSlip(null);
    }
  };

  useEffect(() => {
    refreshCurrentSlip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, formData.month, formData.year]);

  // Main function to create the salary slip
  // Sao chép link mở phiếu lương trong ứng dụng (deep link) từ lastCreatedSlip
  const handleCopyAppLink = async () => {
    try {
      if (!lastCreatedSlip?.id) return;
      const appLink = `thpapp://salary-slips/${lastCreatedSlip.id}`;
      await Clipboard.setStringAsync(appLink);
      Alert.alert('Đã sao chép', 'Link trong ứng dụng đã được sao chép.');
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể sao chép link ứng dụng.');
    }
  };

  // Xuất Excel và cho phép mở/copy link Google Drive
  const handleExportToExcel = async (specificSlipId) => {
    // Ưu tiên kỳ đang xem (currentSlip) để tránh nhầm tháng trước đó
    const targetSlipId =
      specificSlipId || currentSlip?.id || lastCreatedSlip?.id;
    if (
      !targetSlipId ||
      typeof targetSlipId !== 'string' ||
      targetSlipId.trim().length === 0
    ) {
      Alert.alert(
        'Thông báo',
        'Không tìm thấy hoặc ID phiếu lương không hợp lệ cho kỳ này. Vui lòng tạo trước.'
      );
      return;
    }
    try {
      setExporting(true);
      const signedIn = await GoogleSignin.isSignedIn();
      if (!signedIn) {
        await GoogleSignin.hasPlayServices();
        await GoogleSignin.signIn();
      }
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) throw new Error('Không lấy được quyền truy cập Google');

      const { getFunctions, httpsCallable } = require('firebase/functions');
      const functions = getFunctions(undefined, 'asia-southeast1');
      const exportSalarySlip = httpsCallable(
        functions,
        'exportSalarySlipToDrive'
      );
      const result = await exportSalarySlip({
        salarySlipId: targetSlipId,
        accessToken,
      });

      const fileUrl = result?.data?.fileUrl;
      if (fileUrl) {
        if (resultModalVisible) {
          setExportLink(fileUrl);
        } else {
          Alert.alert('Xuất thành công', 'Bạn muốn làm gì với link?', [
            { text: 'Mở link', onPress: () => Linking.openURL(fileUrl) },
            {
              text: 'Sao chép',
              onPress: async () => {
                await Clipboard.setStringAsync(fileUrl);
                Alert.alert('Đã sao chép');
              },
            },
            { text: 'Đóng', style: 'cancel' },
          ]);
        }
      } else {
        Alert.alert(
          'Thông báo',
          'Xuất Excel thành công nhưng không nhận được link.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Lỗi',
        `Không thể xuất Excel: ${error?.message || 'Unknown'}`
      );
    } finally {
      setExporting(false);
    }
  };

  const handleCreateSalarySlip = async () => {
    if (!selectedEmployee) {
      Alert.alert('Lỗi', 'Vui lòng chọn một nhân viên.');
      return;
    }

    try {
      setLoading(true);
      // Frontend only collects manual inputs
      const payload = {
        employeeId: selectedEmployee.id,
        month: formData.month,
        year: formData.year,
        allowances: formData.allowances,
        bonuses: formData.bonuses,
        deductions: formData.deductions, // Manual deductions only
        notes: formData.notes,
      };

      // Backend handles all calculations
      const created = await salaryService.createSalarySlipAuto(payload);
      setLastCreatedSlip(created);
      setResultModalVisible(true);
      resetForm();
    } catch (error) {
      Alert.alert('Lỗi', `Không thể tạo phiếu lương: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- UI Helper Functions for Modals ---
  const addFee = (type) => {
    setFeeModalType(type);
    setNewFee({ name: '', amount: '' });
    setShowFeeModal(true);
  };

  const handleSaveFee = () => {
    if (!newFee.name.trim() || !newFee.amount.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    const fee = {
      id: Date.now().toString(),
      name: newFee.name,
      amount: parseFloat(newFee.amount),
    };
    setFormData((prev) => ({
      ...prev,
      [`${feeModalType}s`]: [...prev[`${feeModalType}s`], fee],
    }));
    setShowFeeModal(false);
  };

  const removeFee = (type, feeId) => {
    setFormData((prev) => ({
      ...prev,
      [`${type}s`]: prev[`${type}s`].filter((f) => f.id !== feeId),
    }));
  };

  // --- RENDER FUNCTIONS ---

  const renderEmployeeInfo = () =>
    selectedEmployee && employeeInfo ? (
      <View style={styles.autoInfoContainer}>
        <View style={styles.autoInfoGrid}>
          <InfoBox
            label={
              employeeInfo?.salaryType === 'daily'
                ? 'Lương Theo Ngày'
                : 'Lương Hợp Đồng'
            }
            value={formatCurrency(
              employeeInfo?.salaryType === 'daily'
                ? employeeInfo?.dailySalary || 0
                : employeeInfo?.monthlySalary || 0
            )}
          />
          <InfoBox
            label="Lương Đóng BH"
            value={formatCurrency(employeeInfo.insuranceContributionBase)}
          />
          <InfoBox
            label="Phép Năm Còn Lại"
            value={`${employeeInfo.annualLeaveBalance} ngày`}
          />
        </View>
      </View>
    ) : null;

  const handleDebugOT = async () => {
    try {
      if (!selectedEmployee) return;
      const res = await salaryService.getEmployeeAttendance(
        selectedEmployee.id,
        formData.month,
        formData.year
      );
      console.log('DEBUG OT MONTH (frontend echo)', res);
      Alert.alert(
        'Debug OT',
        `Kỳ ${formData.month}/${formData.year}\nNgày công: ${res.actualWorkDays}\nOT Thường/CN/Lễ: ${res.overtimeHours.normal} / ${res.overtimeHours.sunday} / ${res.overtimeHours.holiday}`
      );
    } catch (e) {
      Alert.alert('Debug OT lỗi', e?.message || 'Unknown');
    }
  };

  const renderAttendanceInfo = () =>
    selectedEmployee && attendanceInfo ? (
      <View style={styles.attendanceInfoContainer}>
        <Text style={[styles.attendanceInfoTitle, { color: theme.primary }]}>
          Thông tin chấm công tháng {formData.month}/{formData.year}
        </Text>
        <View style={styles.attendanceInfoGrid}>
          <InfoBox
            label="Ngày công thực tế"
            value={`${attendanceInfo.actualWorkDays} ngày`}
          />
          <InfoBox
            label="Nghỉ phép"
            value={`${attendanceInfo.paidLeaveDays} ngày`}
          />
          <InfoBox
            label="Giờ OT (Thường/CN/Lễ)"
            value={`${attendanceInfo.overtimeHours.normal} / ${attendanceInfo.overtimeHours.sunday} / ${attendanceInfo.overtimeHours.holiday}`}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.modalButton,
            {
              marginTop: 8,
              alignSelf: 'flex-end',
              backgroundColor: theme.primary,
            },
          ]}
          onPress={handleDebugOT}
        >
          <Text style={{ color: '#fff' }}>Debug OT</Text>
        </TouchableOpacity>
      </View>
    ) : null;

  const renderSalaryPreview = () => {
    if (!employeeInfo || !attendanceInfo || !systemSettings) return null;

    // Bước 1: Lấy tất cả các biến cần thiết từ state.
    const { salaryType, dailySalary, monthlySalary } = employeeInfo;
    const { actualWorkDays, paidLeaveDays, overtimeHours } = attendanceInfo;
    const { standardWorkingDays, overtimeMultipliers } = systemSettings;

    // Bước 2: Tính toán các giá trị cơ bản.
    const effectiveDays = actualWorkDays + paidLeaveDays;

    // ----- SỬA LỖI LOGIC CỐT LÕI NẰM Ở ĐÂY -----
    let baseSalary = 0;
    let hourlyRate = 0;

    if (salaryType === 'daily') {
      // Áp dụng công thức cho lương ngày
      baseSalary = (dailySalary || 0) * effectiveDays;
      hourlyRate = (dailySalary || 0) / 8;
    } else {
      // Áp dụng công thức cho lương tháng (mặc định)
      baseSalary = (monthlySalary / standardWorkingDays) * effectiveDays;
      hourlyRate = monthlySalary / standardWorkingDays / 8;
    }
    // ---------------------------------------------

    // Bước 3: Tiếp tục các phép tính còn lại với baseSalary và hourlyRate đã chính xác.
    // Đơn giá giờ OT (hiển thị xem trước) theo hệ số từ settings, với fallback an toàn
    const mNormal = overtimeMultipliers?.normal ?? 1.5;
    const mSunday = mNormal; // CN cùng đơn giá như ngày thường theo yêu cầu
    const mHoliday = overtimeMultipliers?.holiday ?? 3.0;

    const overtimeHourlyRate = {
      normal: hourlyRate * mNormal,
      sunday: hourlyRate * mSunday,
      holiday: hourlyRate * mHoliday,
    };

    // Chuẩn hóa OT ngày thường theo bội số 3 giờ (tối đa 3h/ngày) – hiển thị preview an toàn
    const normalHoursRaw = overtimeHours.normal || 0;
    const normalizedNormalHours = Math.floor(normalHoursRaw / 3) * 3;

    const totalOvertimePay =
      normalizedNormalHours * overtimeHourlyRate.normal +
      (overtimeHours.sunday || 0) * overtimeHourlyRate.sunday +
      (overtimeHours.holiday || 0) * overtimeHourlyRate.holiday;

    const totalAllowances = formData.allowances.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const totalBonuses = formData.bonuses.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );

    const grossSalary =
      baseSalary + totalOvertimePay + totalAllowances + totalBonuses;

    const totalAuto = autoDeductions.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const totalManual = formData.deductions.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const totalAdvances = advancePayments.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const totalDeductions = totalAuto + totalManual + totalAdvances;

    const netSalary = grossSalary - totalDeductions;

    // Bước 4: Render giao diện với kết quả đúng.
    return (
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Xem trước (Ước tính)
        </Text>
        <SummaryRow
          label="Lương cơ bản (theo ngày công)"
          value={formatCurrency(baseSalary)}
        />
        <SummaryRow
          label="Tổng lương tăng ca"
          value={formatCurrency(totalOvertimePay)}
          isAddition={true}
        />
        <SummaryRow
          label="Đơn giá giờ OT (Th/CN/Lễ)"
          value={`${formatCurrency(
            overtimeHourlyRate.normal
          )} / ${formatCurrency(overtimeHourlyRate.sunday)} / ${formatCurrency(
            overtimeHourlyRate.holiday
          )}`}
        />
        <SummaryRow
          label={`Chi tiết OT Thường (${overtimeHours.normal || 0}h)`}
          value={formatCurrency(
            (overtimeHours.normal || 0) * overtimeHourlyRate.normal
          )}
        />
        <SummaryRow
          label={`Chi tiết OT Chủ nhật (${overtimeHours.sunday || 0}h)`}
          value={formatCurrency(
            (overtimeHours.sunday || 0) * overtimeHourlyRate.sunday
          )}
        />
        <SummaryRow
          label={`Chi tiết OT Ngày lễ (${overtimeHours.holiday || 0}h)`}
          value={formatCurrency(
            (overtimeHours.holiday || 0) * overtimeHourlyRate.holiday
          )}
        />
        <SummaryRow
          label="Tổng Phụ Cấp"
          value={formatCurrency(totalAllowances)}
          isAddition={true}
        />
        <SummaryRow
          label="Tổng Thưởng"
          value={formatCurrency(totalBonuses)}
          isAddition={true}
        />
        <SummaryRow
          label="TỔNG THU NHẬP (GROSS)"
          value={formatCurrency(grossSalary)}
          isTotal={true}
        />
        <SummaryRow
          label="Tổng khấu trừ (BH + khác)"
          value={formatCurrency(-totalDeductions)}
        />
        <SummaryRow
          label="THỰC NHẬN (ƯỚC TÍNH)"
          value={formatCurrency(netSalary)}
          isTotal={true}
        />
        <Text style={[styles.previewNote, { color: theme.textMuted }]}>
          *Đây là ước tính hiển thị. Số liệu chính xác sẽ do backend tính toán.
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color={theme.primary}
        style={{ flex: 1 }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo Phiếu Lương Mới</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Employee Selection */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            1. Chọn nhân viên
          </Text>
          <TouchableOpacity
            style={[styles.selector, { borderColor: theme.border }]}
            onPress={() => setShowEmployeeModal(true)}
          >
            <Text style={{ color: theme.text }}>
              {selectedEmployee
                ? selectedEmployee.displayName || selectedEmployee.name || 'N/A'
                : 'Chọn nhân viên'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
          </TouchableOpacity>
          {renderEmployeeInfo()}
        </View>

        {/* Period and Attendance */}
        {selectedEmployee && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              2. Chọn kỳ lương
            </Text>
            <View style={styles.formRow}>
              {/* Month dropdown trigger */}
              <TouchableOpacity
                style={[
                  styles.formInput,
                  { justifyContent: 'center', borderColor: theme.border },
                ]}
                onPress={() => setMonthPickerVisible(true)}
              >
                <Text style={{ color: theme.text }}>
                  Tháng {formData.month}
                </Text>
              </TouchableOpacity>
              {/* Year numeric input remains */}
              <TextInput
                style={[
                  styles.formInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
                value={formData.year.toString()}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    year: parseInt(text) || new Date().getFullYear(),
                  })
                }
                keyboardType="numeric"
              />
            </View>
            {renderAttendanceInfo()}

            {/* Export current period's slip if exists */}
            {currentSlip ? (
              <TouchableOpacity
                style={[
                  styles.createButton,
                  { backgroundColor: theme.primary, marginTop: 8 },
                ]}
                onPress={() => handleExportToExcel()}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>
                    Xuất Excel kỳ {formData.month}/{formData.year}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>
                Chưa có phiếu lương của kỳ này.
              </Text>
            )}
          </View>
        )}

        {/* Manual Inputs */}
        {selectedEmployee && (
          <>
            <FeeSection
              type="allowance"
              title="3. Phụ cấp (Nhập tay)"
              data={formData.allowances}
              onAdd={() => addFee('allowance')}
              onRemove={(id) => removeFee('allowance', id)}
              theme={theme}
            />
            <FeeSection
              type="bonus"
              title="4. Thưởng (Nhập tay)"
              data={formData.bonuses}
              onAdd={() => addFee('bonus')}
              onRemove={(id) => removeFee('bonus', id)}
              theme={theme}
            />

            {/* Approved Advance Payments (read-only) */}
            <View style={[styles.section, { backgroundColor: theme.card }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  5. Ứng lương đã duyệt (tự trừ)
                </Text>
              </View>
              {advancePayments && advancePayments.length > 0 ? (
                <>
                  {advancePayments.map((item) => (
                    <View key={item.id} style={styles.feeItem}>
                      <Text style={{ color: theme.text }}>
                        {formatDateVN(item.requestDate)} -{' '}
                        {item.reason || 'Không có lý do'}
                      </Text>
                      <Text style={{ color: theme.text }}>
                        {formatCurrency(item.amount || 0)}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.feeItem, { borderBottomWidth: 0 }]}>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>
                      Tổng ứng lương
                    </Text>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>
                      {formatCurrency(
                        advancePayments.reduce((s, x) => s + (x.amount || 0), 0)
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <View>
                  <Text style={{ color: theme.textSecondary }}>
                    Không có yêu cầu ứng lương đã duyệt.
                  </Text>
                  <Text
                    style={{
                      color: theme.textMuted,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Debug: {JSON.stringify(advancePayments)}
                  </Text>
                </View>
              )}
            </View>

            {/* Auto Deductions (read-only) */}
            <View style={[styles.section, { backgroundColor: theme.card }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  6. Khấu trừ tự động (BHXH, BHYT, BHTN)
                </Text>
              </View>
              {autoDeductions && autoDeductions.length > 0 ? (
                autoDeductions.map((item, idx) => (
                  <View key={idx} style={styles.feeItem}>
                    <Text style={{ color: theme.text }}>{item.name}</Text>
                    <Text style={{ color: theme.text }}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: theme.textSecondary }}>
                  Không có khấu trừ tự động.
                </Text>
              )}
            </View>

            <FeeSection
              type="deduction"
              title="7. Khấu trừ khác (VD: phạt, viếng tang...)"
              data={formData.deductions}
              onAdd={() => addFee('deduction')}
              onRemove={(id) => removeFee('deduction', id)}
              theme={theme}
            />
          </>
        )}

        {/* Notes */}
        {selectedEmployee && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              7. Ghi chú
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                { color: theme.text, borderColor: theme.border },
              ]}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              multiline
            />
          </View>
        )}

        {/* Salary Preview */}
        {renderSalaryPreview()}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={handleCreateSalarySlip}
          disabled={!selectedEmployee}
        >
          <Text style={styles.createButtonText}>Tạo Phiếu Lương</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Employee Modal */}
      <Modal
        visible={showEmployeeModal}
        transparent={true}
        onRequestClose={() => setShowEmployeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Chọn Nhân Viên
            </Text>
            <ScrollView>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  style={styles.employeeItem}
                  onPress={() => handleEmployeeSelect(emp)}
                >
                  <Text style={{ color: theme.text }}>
                    {emp.displayName || emp.name || emp.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowEmployeeModal(false)}
            >
              <Text style={{ color: theme.text }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Month Picker Modal */}
      <Modal
        visible={monthPickerVisible}
        transparent={true}
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.card, width: '90%', maxHeight: '70%' },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Chọn Tháng
            </Text>
            <ScrollView>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.employeeItem,
                    {
                      backgroundColor:
                        m === formData.month
                          ? theme.primary + '20'
                          : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setFormData((prev) => ({ ...prev, month: m }));
                    setMonthPickerVisible(false);
                  }}
                >
                  <Text style={{ color: theme.text }}>Tháng {m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setMonthPickerVisible(false)}
            >
              <Text style={{ color: theme.text }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fee Modal */}
      <Modal
        visible={showFeeModal}
        transparent={true}
        onRequestClose={() => setShowFeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Thêm {feeTypeLabel(feeModalType)}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { color: theme.text, borderColor: theme.border, marginTop: 12 },
              ]}
              placeholder="Tên"
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.primary}
              value={newFee.name}
              onChangeText={(text) => setNewFee({ ...newFee, name: text })}
              returnKeyType="next"
              underlineColorAndroid="transparent"
            />
            <TextInput
              style={[
                styles.modalInput,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Số tiền"
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.primary}
              value={newFee.amount}
              onChangeText={(text) => setNewFee({ ...newFee, amount: text })}
              keyboardType={
                Platform.OS === 'ios'
                  ? 'numbers-and-punctuation'
                  : 'decimal-pad'
              }
              returnKeyType="done"
            />
            <View style={styles.formRow}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowFeeModal(false)}
              >
                <Text style={{ color: theme.text }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveFee}
              >
                <Text style={{ color: '#fff' }}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OT Breakdown Modal */}
      <Modal
        visible={otModalVisible}
        transparent={true}
        onRequestClose={() => setOtModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.card, width: '92%', maxHeight: '80%' },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Danh sách ngày OT
            </Text>
            <ScrollView>
              {attendanceInfo?.overtimeDetails &&
              attendanceInfo.overtimeDetails.length > 0 ? (
                attendanceInfo.overtimeDetails.map((d, idx) => (
                  <View key={idx} style={styles.feeItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '600' }}>
                        {d.date} • {d.type.toUpperCase()}
                      </Text>
                      <Text
                        style={{ color: theme.textSecondary, fontSize: 12 }}
                      >
                        Giờ: {d.hours}h • Vào: {d.clockIn || '-'} • Ra:{' '}
                        {d.clockOut || '-'} • Công: {d.workedHours || 0}h
                      </Text>
                      {d.reason ? (
                        <Text
                          style={{ color: theme.textSecondary, fontSize: 12 }}
                        >
                          Lý do: {d.reason}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>
                      {d.hours}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: theme.text }}>
                  Không có ngày OT trong kỳ.
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setOtModalVisible(false)}
            >
              <Text style={{ color: theme.text }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Result Modal: hiển thị sau khi tạo phiếu lương thành công */}
      <Modal
        visible={resultModalVisible}
        transparent={true}
        onRequestClose={() => setResultModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.card, width: '92%' },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Tạo Phiếu Lương Thành Công
            </Text>
            {lastCreatedSlip?.employeeName ? (
              <Text
                style={{
                  color: theme.text,
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                Phiếu của {lastCreatedSlip.employeeName}
              </Text>
            ) : null}

            {/* Nút xuất Excel */}
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: theme.primary, marginBottom: 12 },
              ]}
              onPress={() => handleExportToExcel(lastCreatedSlip?.id)}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff' }}>
                  Xuất Excel & Lấy Link Drive
                </Text>
              )}
            </TouchableOpacity>

            {/* Hiển thị link Drive sau khi export thành công */}
            {exportLink ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: theme.textSecondary, marginBottom: 6 }}>
                  Link Google Drive:
                </Text>
                <Text
                  style={{ color: theme.text, marginBottom: 10 }}
                  numberOfLines={2}
                >
                  {exportLink}
                </Text>
                <View style={styles.formRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={async () => {
                      await Clipboard.setStringAsync(exportLink);
                    }}
                  >
                    <Text style={{ color: '#fff' }}>Copy link Drive</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => Linking.openURL(exportLink)}
                  >
                    <Text style={{ color: '#fff' }}>Mở link</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Nút sao chép link ứng dụng */}
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: theme.primary, marginBottom: 12 },
              ]}
              onPress={handleCopyAppLink}
            >
              <Text style={{ color: '#fff' }}>Sao chép Link trong App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setResultModalVisible(false)}
            >
              <Text style={{ color: theme.text }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Reusable Components ---
const InfoBox = ({ label, value }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.autoInfoItem}>
      <Text style={[styles.autoInfoLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.autoInfoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
};

const FeeSection = ({ type, title, data, onAdd, onRemove, theme }) => (
  <View style={[styles.section, { backgroundColor: theme.card }]}>
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <TouchableOpacity onPress={onAdd}>
        <Ionicons name="add-circle" size={28} color={theme.primary} />
      </TouchableOpacity>
    </View>
    {data.map((item) => (
      <View key={item.id} style={styles.feeItem}>
        <Text style={{ color: theme.text }}>{item.name}</Text>
        <Text style={{ color: theme.text }}>{formatCurrency(item.amount)}</Text>
        <TouchableOpacity onPress={() => onRemove(item.id)}>
          <Ionicons name="remove-circle" size={24} color={theme.error} />
        </TouchableOpacity>
      </View>
    ))}
  </View>
);

const SummaryRow = ({ label, value, isAddition = false, isTotal = false }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.summaryRow, isTotal && styles.summaryDivider]}>
      <Text
        style={[
          styles.summaryLabel,
          { color: theme.text, fontWeight: isTotal ? 'bold' : 'normal' },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          {
            color: isAddition ? theme.success : theme.text,
            fontWeight: isTotal ? 'bold' : 'normal',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16 },
  section: { padding: 16, borderRadius: 12, marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  selector: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formRow: { flexDirection: 'row', gap: 12 },
  // Dedicated style for modal inputs to avoid clipping
  modalInput: {
    height: 52,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    textAlignVertical: 'center',
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  formInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  autoInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  autoInfoGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  autoInfoItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  autoInfoLabel: { fontSize: 12, marginBottom: 4, textAlign: 'center' },
  autoInfoValue: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  attendanceInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
  },
  attendanceInfoTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  attendanceInfoGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  feeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewNote: { fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  summaryDivider: { borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  createButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: { padding: 16, borderRadius: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  employeeItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: { marginTop: 16, padding: 12, alignItems: 'center' },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
});

export default SalarySlipCreationScreen;
