//src/screens/HomeScreen.js
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getProjects } from '../api/projectService';
import { getCustomers } from '../api/customerService';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAttendance,
  clockIn,
  clockOut,
  addOvertime,
  getAttendanceStatus,
} from '../api/attendanceService';
import { useAuth } from '../contexts/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [attendance, setAttendance] = useState(null);
  const [attLoading, setAttLoading] = useState(true);

  const ROLE_CAN_ATTEND = ['ke_toan', 'cong_nhan', 'ky_su'];

  const canUseAttendance = ROLE_CAN_ATTEND.includes(
    (user?.role || '').toLowerCase()
  );

  // Kiểm tra role để hiển thị các chức năng đặc biệt
  const isWorker = (user?.role || '').toLowerCase() === 'cong_nhan';
  const isEngineer = (user?.role || '').toLowerCase() === 'ky_su';
  const isAccountant = (user?.role || '').toLowerCase() === 'ke_toan';
  const isDirector = (user?.role || '').toLowerCase() === 'giam_doc';
  const isManager = (user?.role || '').toLowerCase() === 'truong_phong';

  // Các module chính được phân loại
  const modules = [
    {
      id: 'production',
      title: 'Module Sản xuất',
      icon: 'build',
      color: '#FF6B35', // Cam
      description: 'Quản lý sản xuất & dự án',
      functions: [
        {
          name: 'Kiosk xưởng sản xuất',
          icon: 'business',
          screen: 'Kiosk',
        },
        {
          name: 'Bảng tiến độ dự án',
          icon: 'trending-up',
          screen: 'ProjectsScreen',
        },
        {
          name: 'Giao việc & Hướng dẫn',
          icon: 'clipboard',
          screen: 'WorkAllocation',
        },
        {
          name: 'Quản lý máy móc',
          icon: 'construct',
          screen: 'MachinesManagement',
        },
        {
          name: 'Lịch bảo trì',
          icon: 'calendar',
          screen: 'MaintenanceSchedule',
        },
        {
          name: 'Nhật ký bảo trì',
          icon: 'book',
          screen: 'MaintenanceLogs',
        },
        {
          name: 'Sự cố máy móc',
          icon: 'warning',
          screen: 'MachineIncidents',
        },
        {
          name: 'Kiểm tra chất lượng',
          icon: 'checkmark-circle',
          screen: 'QCChecklists',
        },
        { name: 'Báo cáo QC', icon: 'analytics', screen: 'QCReports' },
        {
          name: 'Biểu đồ Gantt',
          icon: 'bar-chart',
          screen: 'ProductionPlanGantt',
        },
        {
          name: 'Quản lý năng lực',
          icon: 'people',
          screen: 'CapacityPlanning',
        },
      ],
    },
    {
      id: 'finance',
      title: 'Module Tài chính',
      icon: 'cash',
      color: '#4CAF50', // Xanh lá
      description: 'Quản lý tài chính & lương',
      functions: [
        {
          name: 'Tạo phiếu lương',
          icon: 'card',
          screen: 'SalarySlipCreation',
        },
        {
          name: 'Báo cáo tổng lương',
          icon: 'stats-chart',
          screen: 'TotalSalaryReport',
        },
        {
          name: 'Xin ứng lương',
          icon: 'wallet',
          screen: 'AdvanceSalary',
        },
        {
          name: 'Khoản tiền ra',
          icon: 'cash-outline',
          screen: 'CompanyExpenses',
        },
        { name: 'Ví/Quỹ', icon: 'wallet-outline', screen: 'Wallet' },
        {
          name: 'Yêu cầu nạp',
          icon: 'add-circle',
          screen: 'CashInRequest',
        },
        { name: 'Thêm chi phí', icon: 'receipt', screen: 'ExpenseList' },
        {
          name: 'Báo cáo lợi nhuận',
          icon: 'trending-up',
          screen: 'ProjectProfitReport',
        },
      ],
    },
    {
      id: 'hr',
      title: 'Module Nhân sự',
      icon: 'people',
      color: '#2196F3', // Xanh dương
      description: 'Quản lý nhân viên & chấm công',
      functions: [
        { name: 'Xem chấm công', icon: 'time', screen: 'Attendance' },
        {
          name: 'Xin nghỉ phép',
          icon: 'calendar',
          screen: 'LeaveRequest',
        },
        {
          name: 'Bảng công việc',
          icon: 'list',
          screen: 'EmployeeTaskBoard',
        },
        {
          name: 'Báo cáo hiệu suất',
          icon: 'analytics',
          screen: 'WorkerPerformanceReport',
        },
        {
          name: 'Quản lý người dùng',
          icon: 'person',
          screen: 'UserManagement',
        },
      ],
    },
    {
      id: 'inventory',
      title: 'Module Kho',
      icon: 'cube',
      color: '#9C27B0', // Tím
      description: 'Quản lý kho & vật tư',
      functions: [
        { name: 'Vật tư tồn kho', icon: 'archive', screen: 'Inventory' },
        {
          name: 'Báo cáo kho',
          icon: 'stats-chart',
          screen: 'InventoryReport',
        },
        {
          name: 'Giao dịch kho',
          icon: 'swap-horizontal',
          screen: 'InventoryTransaction',
        },
        {
          name: 'Thêm vật tư',
          icon: 'add-circle',
          screen: 'AddInventoryItem',
        },
        {
          name: 'Quản lý nhà cung cấp',
          icon: 'storefront',
          screen: 'SupplierManagement',
        },
        {
          name: 'Quản lý vật liệu',
          icon: 'construct',
          screen: 'MaterialManagement',
        },
        {
          name: 'Báo cáo nhà cung cấp',
          icon: 'analytics',
          screen: 'SupplierAnalysisReport',
        },
      ],
    },
    {
      id: 'projects',
      title: 'Module Dự án',
      icon: 'folder',
      color: '#FF9800', // Cam đậm
      description: 'Quản lý dự án & khách hàng',
      functions: [
        {
          name: 'Quản lý dự án',
          icon: 'folder-open',
          screen: 'ProjectManagement',
        },
        {
          name: 'Quản lý khách hàng',
          icon: 'people-circle',
          screen: 'Customers',
        },
        {
          name: 'Tạo báo giá',
          icon: 'document-text',
          screen: 'Quotation',
        },
        {
          name: 'Quản lý phí cố định',
          icon: 'settings',
          screen: 'FixedFeesManagement',
        },
      ],
    },
    {
      id: 'reports',
      title: 'Module Báo cáo',
      icon: 'bar-chart',
      color: '#607D8B', // Xám xanh
      description: 'Báo cáo & phân tích',
      functions: [
        {
          name: 'Báo cáo tài chính',
          icon: 'stats-chart',
          screen: 'FinancialDashboard',
        },
        {
          name: 'Báo cáo dự án',
          icon: 'analytics',
          screen: 'ProjectCost',
        },
        {
          name: 'Báo cáo chi phí',
          icon: 'receipt',
          screen: 'MonthlyCostReport',
        },
        {
          name: 'Dashboard tổng quan',
          icon: 'grid',
          screen: 'DirectorDashboard',
        },
      ],
    },
  ];

  // State để quản lý module đang được chọn
  const [selectedModule, setSelectedModule] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (canUseAttendance) {
        fetchAttendance();
      }
    }, [canUseAttendance])
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectsData, customersData] = await Promise.all([
        getProjects(),
        getCustomers(),
      ]);

      setRecentProjects(projectsData.slice(0, 3));
      setRecentCustomers(customersData.slice(0, 3));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setAttLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const attendanceData = await getAttendanceStatus(today);
      setAttendance(attendanceData);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setAttLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      await clockIn();
      await fetchAttendance();
      Alert.alert('Thành công', 'Chấm công vào thành công!');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chấm công vào');
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOut();
      await fetchAttendance();
      Alert.alert('Thành công', 'Chấm công ra thành công!');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chấm công ra');
    }
  };

  const handleModulePress = (module) => {
    setSelectedModule(module);
  };

  const handleFunctionPress = (functionItem) => {
    if (functionItem.screen) {
      navigation.navigate(functionItem.screen);
    }
  };

  const handleBackToModules = () => {
    setSelectedModule(null);
  };

  const renderModuleGrid = () => {
    return (
      <View style={styles.modulesContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Chọn Module
        </Text>
        <View style={styles.modulesGrid}>
          {modules.map((module) => (
            <TouchableOpacity
              key={module.id}
              style={[styles.moduleCard, { backgroundColor: theme.card }]}
              onPress={() => handleModulePress(module)}
            >
              <View
                style={[
                  styles.moduleIconContainer,
                  { backgroundColor: module.color + '20' },
                ]}
              >
                <Ionicons name={module.icon} size={28} color={module.color} />
              </View>
              <Text style={[styles.moduleTitle, { color: theme.text }]}>
                {module.title}
              </Text>
              <Text
                style={[
                  styles.moduleDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {module.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderFunctionsGrid = () => {
    if (!selectedModule) return null;

    return (
      <View style={styles.functionsContainer}>
        <View style={styles.functionsHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToModules}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.functionsTitle, { color: theme.text }]}>
            {selectedModule.title}
          </Text>
        </View>

        <View style={styles.functionsGrid}>
          {selectedModule.functions.map((functionItem, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.functionCard, { backgroundColor: theme.card }]}
              onPress={() => handleFunctionPress(functionItem)}
            >
              <View
                style={[
                  styles.functionIconContainer,
                  { backgroundColor: selectedModule.color + '20' },
                ]}
              >
                <Ionicons
                  name={functionItem.icon}
                  size={24}
                  color={selectedModule.color}
                />
              </View>
              <Text style={[styles.functionText, { color: theme.text }]}>
                {functionItem.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderAttendanceSection = () => {
    if (!canUseAttendance) return null;

    return (
      <View
        style={[styles.attendanceContainer, { backgroundColor: theme.card }]}
      >
        <Text style={[styles.attendanceTitle, { color: theme.text }]}>
          Chấm công hôm nay
        </Text>
        {attLoading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <View style={styles.attendanceButtons}>
            {!attendance?.clockIn ? (
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleClockIn}
              >
                <Ionicons name="time" size={20} color="white" />
                <Text style={styles.attendanceButtonText}>Chấm công vào</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: theme.danger },
                ]}
                onPress={handleClockOut}
              >
                <Ionicons name="time" size={20} color="white" />
                <Text style={styles.attendanceButtonText}>Chấm công ra</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Đang tải...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Xin chào, {user?.displayName || user?.email || 'Người dùng'}
          </Text>
          <Text style={[styles.subGreeting, { color: theme.textSecondary }]}>
            Bạn đang tìm kiếm gì?
          </Text>
        </View>

        {renderAttendanceSection()}

        {selectedModule ? renderFunctionsGrid() : renderModuleGrid()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 16,
    fontWeight: '600',
  },
  attendanceContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  attendanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  attendanceButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  attendanceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modulesContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  moduleCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  moduleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  moduleDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  functionsContainer: {
    paddingHorizontal: 20,
  },
  functionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  functionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  functionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  functionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  functionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  functionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default HomeScreen;
