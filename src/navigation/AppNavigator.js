import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
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
import DebtDashboard from '../screens/DebtDashboard';
import NotificationsScreen from '../screens/NotificationsScreen'; // Import NotificationsScreen

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
        options={({ navigation }) => ({
          title: 'Quản lý Dự án',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('AddProject')}
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
        options={{ title: 'Hoàn tất Báo giá', headerRight: null }}
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
      {!canManageAttendance && (
        <Tab.Screen
          name="Tasks"
          component={TaskReportScreen}
          options={{ title: 'Báo cáo', headerShown: false }}
        />
      )}

      {canManageUsers && (
        <Tab.Screen
          name="UserManagement"
          component={UserManagementScreen}
          options={{ title: 'Nhân viên' }}
        />
      )}

      {canManageAttendance && (
        <Tab.Screen
          name="Attendance"
          component={AttendanceScreen}
          options={{ title: 'Chấm Công' }}
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
            <Stack.Screen
              name="AddInventoryItem"
              component={AddInventoryItemScreen}
            />
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
            {/* <Stack.Screen name="Staging" component={StagingScreen} /> */}
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
