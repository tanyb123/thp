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

// Import màn hình tài khoản
import AccountScreen from '../screens/AccountScreen';

// Import màn hình báo cáo công việc
import TaskReportScreen from '../screens/TaskReportScreen';

// Tạo Stack Navigator cho quản lý dự án
const ProjectStack = createNativeStackNavigator();

const ProjectStackNavigator = () => {
  const { theme } = useTheme();

  return (
    <ProjectStack.Navigator
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTitleStyle: {
          color: theme.text,
        },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.background },
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
    >
      <ProjectStack.Screen
        name="ProjectManagement"
        component={ProjectManagementScreen}
        options={{
          title: 'Quản lý Dự án',
        }}
      />
      <ProjectStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ headerRight: null }}
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
        name="FinalizeQuotation"
        component={FinalizeQuotationScreen}
        options={{ title: 'Hoàn tất Báo giá', headerRight: null }}
      />
    </ProjectStack.Navigator>
  );
};

// Tạo Tab Navigator
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const { theme } = useTheme();

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
          } else if (route.name === 'Tasks') {
            iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
          } else if (route.name === 'Account') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
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
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Trang Chủ' }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomerManagementScreen}
        options={{ title: 'Khách Hàng' }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectStackNavigator}
        options={{
          title: 'Dự Án',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskReportScreen}
        options={{ title: 'Báo cáo' }}
      />
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
