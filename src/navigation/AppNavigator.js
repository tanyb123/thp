import React from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import messaging from '@react-native-firebase/messaging';
import { useEffect, useState } from 'react';
import { collection, where, query, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// Import các màn hình
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import CustomerManagementScreen from '../screens/CustomerManagementScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import AddCustomerScreen from '../screens/AddCustomerScreen';
import EditCustomerScreen from '../screens/EditCustomerScreen';

// Import các màn hình quản lý dự án
import ProjectManagementScreen from '../screens/ProjectManagementScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import AddProjectScreen from '../screens/AddProjectScreen';
import EditProjectScreen from '../screens/EditProjectScreen';
import FinalizeQuotationScreen from '../screens/FinalizeQuotationScreen';
import QuotationScreen from '../screens/QuotationScreen';
import ManualQuotationScreen from '../screens/ManualQuotationScreen';
import StageDetailScreen from '../screens/StageDetailScreen';
import MaterialPurchaseScreen from '../screens/MaterialPurchaseScreen';
import CreateProposalScreen from '../screens/CreateProposalScreen';
import ProposalListScreen from '../screens/ProposalListScreen';
import CreatePOScreen from '../screens/CreatePOScreen';
import POListScreen from '../screens/POListScreen';
import CreateDeliveryNoteScreen from '../screens/CreateDeliveryNoteScreen';
import ProjectCostScreen from '../screens/ProjectCostScreen';
// import StagingScreen from '../screens/StagingScreen';

// Import màn hình tài khoản
import AccountScreen from '../screens/AccountScreen';

// Import màn hình báo cáo công việc
import TaskReportScreen from '../screens/TaskReportScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import UserManagementScreen from '../screens/UserManagementScreen';

// Import màn hình dashboard cho giám đốc
import DirectorDashboardScreen from '../screens/DirectorDashboardScreen';

// Import màn hình cài đặt icon
import IconSettingsScreen from '../screens/IconSettingsScreen';
import CustomIconDebug from '../components/CustomIconDebug';
import DebtDashboard from '../screens/DebtDashboard';
import NotificationsScreen from '../screens/NotificationsScreen'; // Import NotificationsScreen
import FinancialDashboardScreen from '../screens/FinancialDashboardScreen';

// Import các màn hình quản lý nhà cung cấp
import SupplierManagementScreen from '../screens/SupplierManagementScreen';
import AddSupplierScreen from '../screens/AddSupplierScreen';
import EditSupplierScreen from '../screens/EditSupplierScreen';
import SupplierDetailScreen from '../screens/SupplierDetailScreen';
import ConfirmPOReceiptScreen from '../screens/ConfirmPOReceiptScreen';

// Import màn hình quản lý kho
import InventoryScreen from '../screens/InventoryScreen';
import AddInventoryItemScreen from '../screens/AddInventoryItemScreen';
import EditInventoryItemScreen from '../screens/EditInventoryItemScreen';
import InventoryItemDetailScreen from '../screens/InventoryItemDetailScreen';
import InventoryTransactionScreen from '../screens/InventoryTransactionScreen';
import InventoryReportScreen from '../screens/InventoryReportScreen';
import AssignSalaryScreen from '../screens/AssignSalaryScreen';

// Import màn hình quản lý lương
import FixedFeesManagementScreen from '../screens/FixedFeesManagementScreen';
import SalarySlipCreationScreen from '../screens/SalarySlipCreationScreen';
import TotalSalaryReportScreen from '../screens/TotalSalaryReportScreen';
import MachinesManagementScreen from '../screens/MachinesManagementScreen';
import MaintenanceScheduleScreen from '../screens/MaintenanceScheduleScreen';
import MaintenanceLogsScreen from '../screens/MaintenanceLogsScreen';
import MachineIncidentsScreen from '../screens/MachineIncidentsScreen';
import QCChecklistsScreen from '../screens/QCChecklistsScreen';
import QCChecklistDetailScreen from '../screens/QCChecklistDetailScreen';
import QCInspectionsScreen from '../screens/QCInspectionsScreen';
import QCNonconformanceScreen from '../screens/QCNonconformanceScreen';
import QCReportsScreen from '../screens/QCReportsScreen';
import ProductionPlanGanttScreen from '../screens/ProductionPlanGanttScreen';
import CapacityPlanningScreen from '../screens/CapacityPlanningScreen';
import ProjectProfitReportScreen from '../screens/ProjectProfitReportScreen';
import WorkerPerformanceReportScreen from '../screens/WorkerPerformanceReportScreen';
import SupplierAnalysisReportScreen from '../screens/SupplierAnalysisReportScreen';
import EmployeeTaskBoardScreen from '../screens/EmployeeTaskBoardScreen';

// Import expense tracking screens
import ExpenseListScreen from '../screens/ExpenseListScreen';

// Import the AddCompanyExpenseScreen
import AddCompanyExpenseScreen from '../screens/AddCompanyExpenseScreen';
import CompanyExpensesScreen from '../screens/CompanyExpensesScreen';
import WalletScreen from '../screens/WalletScreen';
import CashInRequestScreen from '../screens/CashInRequestScreen';
import PendingCashInApprovalsScreen from '../screens/PendingCashInApprovalsScreen';

// Import material management screen
import MaterialManagementScreen from '../screens/MaterialManagementScreen';
import MonthlyCostReportScreen from '../screens/MonthlyCostReportScreen';
import CustomerImportScreen from '../screens/CustomerImportScreen';

// Import the payment screens
import PaymentRequestListScreen from '../screens/PaymentRequestListScreen';
import CreatePaymentRequestScreen from '../screens/CreatePaymentRequestScreen';
import PaymentRequestDetailScreen from '../screens/PaymentRequestDetailScreen';

// Import production screens
import KioskScreen from '../screens/KioskScreen';
import StarboardScreen from '../screens/StarboardScreen';
import ProductionDashboard from '../screens/ProductionDashboard';
import WorkAllocationScreen from '../screens/WorkAllocationScreen';
import ProjectsScreen from '../screens/ProjectsScreen';

// Import AI Chat screen
import AIChatScreen from '../screens/AIChatScreen';

// Import Worker screens
import WorkerAttendanceScreen from '../screens/WorkerAttendanceScreen';
import LeaveRequestScreen from '../screens/LeaveRequestScreen';
import AdvanceSalaryScreen from '../screens/AdvanceSalaryScreen';

// Import Project Discussion screen
import ProjectDiscussionScreen from '../screens/ProjectDiscussionScreen';

// Import MachinesManagementScreen
// (đã import ở trên)

// Tạo Stack Navigator cho quản lý dự án
const ProjectStack = createNativeStackNavigator();

const ProjectStackNavigator = () => {
  const { theme } = useTheme();

  return (
    <ProjectStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTitleStyle: {
          color: theme.text,
        },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <ProjectStack.Screen
        name="ProjectManagement"
        component={ProjectManagementScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="AddProject"
        component={AddProjectScreen}
        options={{ title: 'Thêm Dự án Mới', headerRight: null }}
      />
      <ProjectStack.Screen
        name="EditProject"
        component={EditProjectScreen}
        options={{ title: 'Chỉnh sửa Dự án', headerRight: null }}
      />
      <ProjectStack.Screen
        name="Quotation"
        component={QuotationScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="ManualQuotation"
        component={ManualQuotationScreen}
        options={{ title: 'Báo giá Thủ công' }}
      />
      <ProjectStack.Screen
        name="FinalizeQuotation"
        component={FinalizeQuotationScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="StageDetail"
        component={StageDetailScreen}
        options={{ title: 'Chi tiết Công đoạn' }}
      />
      <ProjectStack.Screen
        name="MaterialPurchase"
        component={MaterialPurchaseScreen}
        options={{ title: 'Quản lý Mua Vật Tư' }}
      />
      <ProjectStack.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{ headerShown: false }}
      />
      <ProjectStack.Screen
        name="CreateProposal"
        component={CreateProposalScreen}
        options={{ title: 'Tạo Đề Xuất' }}
      />
      <ProjectStack.Screen
        name="CreatePO"
        component={CreatePOScreen}
        options={{ title: 'Tạo PO' }}
      />
      <ProjectStack.Screen
        name="ProposalList"
        component={ProposalListScreen}
        options={{ title: 'Duyệt Đề Xuất' }}
      />
      <ProjectStack.Screen
        name="POList"
        component={POListScreen}
        options={{ title: 'Đơn đặt hàng' }}
      />
      <ProjectStack.Screen
        name="ProjectCost"
        component={ProjectCostScreen}
        options={{ title: 'Chi phí dự án', headerShown: false }}
      />
      <ProjectStack.Screen
        name="ProjectDiscussion"
        component={ProjectDiscussionScreen}
        options={{ headerShown: false }}
      />
    </ProjectStack.Navigator>
  );
};

// Tạo Stack Navigator cho quản lý kho
const InventoryStack = createNativeStackNavigator();

const InventoryStackNavigator = () => {
  const { theme } = useTheme();

  return (
    <InventoryStack.Navigator
      initialRouteName="InventoryMain"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTitleStyle: {
          color: theme.text,
        },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <InventoryStack.Screen
        name="InventoryMain"
        component={InventoryScreen}
        options={({ navigation }) => ({
          title: 'Quản lý Kho',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('AddInventoryItem')}
              style={{
                marginRight: 15,
                backgroundColor: theme.primary,
                width: 36,
                height: 36,
                borderRadius: 18,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        })}
      />
      <InventoryStack.Screen
        name="AddInventoryItem"
        component={AddInventoryItemScreen}
        options={({ navigation }) => ({
          title: 'Thêm Vật Tư Mới',
          headerTitleAlign: 'center', // Căn giữa hoàn toàn
          headerTitleStyle: {
            textAlign: 'center',
            flex: 1,
            marginLeft: -60, // Tăng khoảng cách để căn giữa tốt hơn
            marginRight: -20, // Thêm margin bên phải để cân bằng
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('InventoryMain')}
              style={{ marginLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        })}
      />
      <InventoryStack.Screen
        name="EditInventoryItem"
        component={EditInventoryItemScreen}
        options={({ navigation }) => ({
          title: 'Chỉnh sửa Vật Tư',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('InventoryMain')}
              style={{ marginLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        })}
      />
      <InventoryStack.Screen
        name="InventoryItemDetail"
        component={InventoryItemDetailScreen}
        options={({ navigation }) => ({
          title: 'Chi Tiết Vật Tư',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('InventoryMain')}
              style={{ marginLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        })}
      />
      <InventoryStack.Screen
        name="InventoryTransaction"
        component={InventoryTransactionScreen}
        options={({ navigation }) => ({
          title: 'Giao Dịch Kho',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('InventoryMain')}
              style={{ marginLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        })}
      />
      <InventoryStack.Screen
        name="InventoryReport"
        component={InventoryReportScreen}
        options={({ navigation }) => ({
          title: 'Báo Cáo Kho',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('InventoryMain')}
              style={{ marginLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        })}
      />
    </InventoryStack.Navigator>
  );
};

// Tạo Tab Navigator
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [pendingAdvanceCount, setPendingAdvanceCount] = useState(0);

  // Check if user has director role - support both English and Vietnamese role names
  const isDirector = ['director', 'Giám đốc', 'giam_doc'].includes(user?.role);
  const canManageAttendance = ['pho_giam_doc'].includes(user?.role);
  const canManageUsers = ['admin', 'giam_doc'].includes(user?.role);
  // Kiểm tra quyền truy cập vào module kho
  const canAccessInventory = ['thuong_mai', 'ky_su', 'ke_toan'].includes(
    user?.role
  );

  console.log(
    'User role:',
    user?.role,
    'Is Director:',
    isDirector,
    'Can Access Inventory:',
    canAccessInventory
  );

  // Realtime badge for pending approval requests
  useEffect(() => {
    const leaveQ = query(
      collection(db, 'leave_requests'),
      where('status', '==', 'pending')
    );
    const advQ = query(
      collection(db, 'advance_requests'),
      where('status', '==', 'pending')
    );
    const un1 = onSnapshot(leaveQ, (snap) => {
      setPendingLeaveCount(snap.size || 0);
    });
    const un2 = onSnapshot(advQ, (snap) => {
      setPendingAdvanceCount(snap.size || 0);
    });
    return () => {
      un1();
      un2();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Customers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Projects') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'Inventory') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Tasks') {
            iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'checkbox' : 'square-outline';
          } else if (route.name === 'UserManagement') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Account') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          } else if (route.name === 'Dashboard') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Inventory') {
            iconName = focused ? 'cube' : 'cube-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTitleStyle: {
          color: theme.text,
        },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
        contentStyle: {
          backgroundColor: theme.background,
        },
      })}
    >
      {isDirector ? (
        // Director sees Dashboard as first tab
        <Tab.Screen
          name="Dashboard"
          component={DirectorDashboardScreen}
          options={{ title: 'Tổng Quan' }}
        />
      ) : (
        // Other users see Home as first tab
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Trang Chủ' }}
        />
      )}
      <Tab.Screen
        name="Customers"
        component={CustomerManagementScreen}
        options={{ title: 'Khách Hàng', headerShown: false }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectStackNavigator}
        options={{
          title: 'Dự Án',
          headerShown: false,
        }}
      />
      {canManageAttendance ? (
        <Tab.Screen
          name="Attendance"
          component={AttendanceScreen}
          options={{ title: 'Chấm công', headerShown: false }}
        />
      ) : (
        <Tab.Screen
          name="Tasks"
          component={TaskReportScreen}
          options={{
            title: 'Báo cáo',
            headerShown: false,
            tabBarBadge:
              pendingLeaveCount + pendingAdvanceCount > 0
                ? pendingLeaveCount + pendingAdvanceCount
                : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#E53935',
              color: '#fff',
            },
          }}
        />
      )}

      {canManageUsers && (
        <Tab.Screen
          name="UserManagement"
          component={UserManagementScreen}
          options={{ title: 'Nhân viên' }}
        />
      )}

      {canAccessInventory && (
        <Tab.Screen
          name="Inventory"
          component={InventoryStackNavigator}
          options={{ title: 'Kho Vật Tư', headerShown: false }}
        />
      )}

      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: 'Tài khoản' }}
      />
    </Tab.Navigator>
  );
};

// Tạo Stack Navigator cho luồng xác thực và các màn hình khác
const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  // Sử dụng trạng thái đăng nhập từ AuthContext
  const { isSignedIn, loadingAuth } = useAuth();
  const { theme, isDarkMode } = useTheme();

  // Tạo theme cho NavigationContainer dựa trên theme hiện tại
  const navigationTheme = {
    ...(isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
  };

  // Xử lý FCM notifications
  useEffect(() => {
    // Xử lý khi app đang chạy (foreground)
    const unsubscribeOnMessage = messaging().onMessage(
      async (remoteMessage) => {
        console.log('FCM Message received in foreground:', remoteMessage);
        Alert.alert(
          remoteMessage.notification.title,
          remoteMessage.notification.body
        );
      }
    );

    // Xử lý khi người dùng nhấn vào notification (app đang ở background)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log(
        'Notification caused app to open from background:',
        remoteMessage
      );
      const { projectId, projectName } = remoteMessage.data;
      if (projectId) {
        // Cần navigation reference để điều hướng
        // Tạm thời chỉ log ra
        console.log('Should navigate to ProjectDiscussion with:', {
          projectId,
          projectName,
        });
      }
    });

    // Kiểm tra nếu app được mở từ trạng thái tắt (killed)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log(
            'Notification caused app to open from quit state:',
            remoteMessage
          );
          const { projectId, projectName } = remoteMessage.data;
          if (projectId) {
            // Cần một cơ chế để điều hướng sau khi app đã sẵn sàng
            // Ví dụ: lưu vào một state global và điều hướng sau
            // Tạm thời chỉ log ra
            console.log('Should navigate to ProjectDiscussion with:', {
              projectId,
              projectName,
            });
          }
        }
      });

    return unsubscribeOnMessage;
  }, []);

  // Hiển thị màn hình loading nếu đang kiểm tra trạng thái đăng nhập
  if (loadingAuth) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.background,
        }}
      >
        <Text style={{ color: theme.text }}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        {isSignedIn ? (
          // Người dùng đã đăng nhập
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CustomerDetail"
              component={CustomerDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AddCustomer"
              component={AddCustomerScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditCustomer"
              component={EditCustomerScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProjectDetail"
              component={ProjectDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AddProject"
              component={AddProjectScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditProject"
              component={EditProjectScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="FinalizeQuotation"
              component={FinalizeQuotationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Quotation"
              component={QuotationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="StageDetail"
              component={StageDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DebtDashboard"
              component={DebtDashboard}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProposalList"
              component={ProposalListScreen}
              options={{
                title: 'Duyệt Đề Xuất',
                headerStyle: {
                  backgroundColor: theme.background,
                },
                headerTintColor: theme.text,
                headerTitleStyle: {
                  color: theme.text,
                },
              }}
            />
            <Stack.Screen
              name="DirectorDashboard"
              component={DirectorDashboardScreen}
              options={{ title: 'Trang của giám đốc' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Thông báo' }}
            />

            {/* Thêm các màn hình quản lý nhà cung cấp */}
            <Stack.Screen
              name="SupplierManagement"
              component={SupplierManagementScreen}
            />
            <Stack.Screen name="AddSupplier" component={AddSupplierScreen} />
            <Stack.Screen name="EditSupplier" component={EditSupplierScreen} />
            <Stack.Screen
              name="SupplierDetail"
              component={SupplierDetailScreen}
            />
            <Stack.Screen
              name="ConfirmPOReceipt"
              component={ConfirmPOReceiptScreen}
              options={{ title: 'Xác nhận giao hàng', headerShown: true }}
            />

            {/* Thêm các màn hình quản lý kho */}
            <Stack.Screen name="Inventory" component={InventoryScreen} />
            {/* Đã xóa duplicate AddInventoryItem - chỉ giữ trong InventoryStackNavigator */}
            <Stack.Screen
              name="EditInventoryItem"
              component={EditInventoryItemScreen}
            />
            <Stack.Screen
              name="InventoryItemDetail"
              component={InventoryItemDetailScreen}
            />
            <Stack.Screen
              name="InventoryTransaction"
              component={InventoryTransactionScreen}
            />
            <Stack.Screen
              name="InventoryReport"
              component={InventoryReportScreen}
            />
            <Stack.Screen
              name="CreateDeliveryNote"
              component={CreateDeliveryNoteScreen}
            />
            <Stack.Screen
              name="Attendance"
              component={AttendanceScreen}
              options={{ title: 'Bảng Chấm Công' }}
            />
            <Stack.Screen
              name="AssignSalary"
              component={AssignSalaryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProjectCost"
              component={ProjectCostScreen}
              options={{ headerShown: false }}
            />
            {/* <Stack.Screen name="Staging" component={StagingScreen} /> */}

            {/* Add the new expense tracking screens */}
            <Stack.Screen
              name="ExpenseList"
              component={ExpenseListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CompanyExpenses"
              component={CompanyExpensesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Wallet"
              component={WalletScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CashInRequest"
              component={CashInRequestScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PendingCashInApprovals"
              component={PendingCashInApprovalsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AddCompanyExpense"
              component={AddCompanyExpenseScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PaymentRequestList"
              component={PaymentRequestListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreatePaymentRequest"
              component={CreatePaymentRequestScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PaymentRequestDetail"
              component={PaymentRequestDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="FinancialDashboard"
              component={FinancialDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Kiosk"
              component={KioskScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Starboard"
              component={StarboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProductionDashboard"
              component={ProductionDashboard}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WorkAllocation"
              component={WorkAllocationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProjectsScreen"
              component={ProjectsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MaterialManagement"
              component={MaterialManagementScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MonthlyCostReport"
              component={MonthlyCostReportScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CustomerImport"
              component={CustomerImportScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="IconSettings"
              component={IconSettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CustomIconDebug"
              component={CustomIconDebug}
              options={{ headerShown: false }}
            />

            {/* Worker Screens */}
            <Stack.Screen
              name="WorkerAttendance"
              component={WorkerAttendanceScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LeaveRequest"
              component={LeaveRequestScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AdvanceSalary"
              component={AdvanceSalaryScreen}
              options={{ headerShown: false }}
            />

            {/* Salary Management Screens */}
            <Stack.Screen
              name="FixedFeesManagement"
              component={FixedFeesManagementScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SalarySlipCreation"
              component={SalarySlipCreationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TotalSalaryReport"
              component={TotalSalaryReportScreen}
              options={{ headerShown: false }}
            />
            {/* Machines & Maintenance */}
            <Stack.Screen
              name="MachinesManagement"
              component={MachinesManagementScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MaintenanceSchedule"
              component={MaintenanceScheduleScreen}
              options={{ title: 'Lịch bảo trì', headerShown: true }}
            />
            <Stack.Screen
              name="MaintenanceLogs"
              component={MaintenanceLogsScreen}
              options={{ title: 'Nhật ký bảo trì', headerShown: true }}
            />
            <Stack.Screen
              name="MachineIncidents"
              component={MachineIncidentsScreen}
              options={{ title: 'Sự cố máy móc', headerShown: true }}
            />

            {/* QC module */}
            <Stack.Screen
              name="QCChecklists"
              component={QCChecklistsScreen}
              options={{ title: 'QC Checklists', headerShown: true }}
            />
            <Stack.Screen
              name="QCChecklistDetail"
              component={QCChecklistDetailScreen}
              options={{ title: 'Chi tiết Checklist', headerShown: true }}
            />
            <Stack.Screen
              name="QCInspections"
              component={QCInspectionsScreen}
              options={{ title: 'Kiểm tra chất lượng', headerShown: true }}
            />
            <Stack.Screen
              name="QCNonconformance"
              component={QCNonconformanceScreen}
              options={{ title: 'Không phù hợp', headerShown: true }}
            />
            <Stack.Screen
              name="QCReports"
              component={QCReportsScreen}
              options={{ title: 'Báo cáo chất lượng', headerShown: true }}
            />
            <Stack.Screen
              name="ProductionPlanGantt"
              component={ProductionPlanGanttScreen}
              options={{ title: 'Biểu đồ Gantt', headerShown: true }}
            />
            <Stack.Screen
              name="CapacityPlanning"
              component={CapacityPlanningScreen}
              options={{ title: 'Năng lực sản xuất', headerShown: true }}
            />
            <Stack.Screen
              name="ProjectProfitReport"
              component={ProjectProfitReportScreen}
              options={{ title: 'Lợi nhuận dự án', headerShown: true }}
            />
            <Stack.Screen
              name="WorkerPerformanceReport"
              component={WorkerPerformanceReportScreen}
              options={{ title: 'Hiệu suất nhân công', headerShown: true }}
            />
            <Stack.Screen
              name="SupplierAnalysisReport"
              component={SupplierAnalysisReportScreen}
              options={{ title: 'Phân tích nhà cung cấp', headerShown: true }}
            />
            <Stack.Screen
              name="EmployeeTaskBoard"
              component={EmployeeTaskBoardScreen}
              options={{ title: 'Bảng công việc', headerShown: true }}
            />
          </>
        ) : (
          // Người dùng chưa đăng nhập
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
