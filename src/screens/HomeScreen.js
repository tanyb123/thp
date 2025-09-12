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
// Worker features will be shown as grid items instead of a fixed section

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

  // Các role có thể sử dụng chức năng chấm công, nghỉ phép, ứng lương
  const canUseWorkerFeatures = isWorker || isEngineer || isAccountant;

  const loadAttendance = async () => {
    if (!user?.uid || !canUseAttendance) {
      setAttendance(null);
      setAttLoading(false);
      return;
    }
    try {
      setAttLoading(true);
      const doc = await getAttendance(user.uid);
      setAttendance(doc);
    } catch (err) {
      console.error('Load attendance error:', err);
    } finally {
      setAttLoading(false);
    }
  };

  // Hàm tải dữ liệu trang chủ
  const loadHomeData = async () => {
    try {
      setLoading(true);

      // Lấy danh sách dự án và khách hàng
      const projectsData = await getProjects();
      const customersData = await getCustomers();

      // Lấy 3 dự án mới nhất
      setRecentProjects(projectsData.slice(0, 3));

      // Lấy 3 khách hàng mới nhất
      setRecentCustomers(customersData.slice(0, 3));
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu trang chủ:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tải dữ liệu khi màn hình được mở
  useEffect(() => {
    loadHomeData();
    loadAttendance();
  }, []);

  // Làm mới dữ liệu khi màn hình được focus
  useFocusEffect(
    React.useCallback(() => {
      loadHomeData();
      loadAttendance();
    }, [])
  );

  const handleClockIn = async () => {
    try {
      setAttLoading(true);
      await clockIn(user.uid);
      loadAttendance();
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể chấm công vào.');
    }
  };

  const handleClockOut = async () => {
    try {
      setAttLoading(true);
      await clockOut(user.uid);
      loadAttendance();
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể chấm công ra.');
    }
  };

  const handleAddOvertime = async (hours) => {
    try {
      setAttLoading(true);
      await addOvertime(user.uid, hours);
      loadAttendance();
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể thêm giờ tăng ca.');
    }
  };

  // Xử lý khi người dùng nhấn vào dự án
  const handleProjectPress = (project) => {
    navigation.navigate('ProjectDetail', { projectId: project.id });
  };

  // Xử lý khi người dùng nhấn vào khách hàng
  const handleCustomerPress = (customer) => {
    navigation.navigate('CustomerDetail', { customerId: customer.id });
  };

  // Xử lý khi người dùng nhấn vào nút xem tất cả dự án
  const handleViewAllProjects = () => {
    navigation.navigate('Projects');
  };

  // Xử lý khi người dùng nhấn vào nút xem tất cả khách hàng
  const handleViewAllCustomers = () => {
    navigation.navigate('Customers');
  };

  // Hàm lấy màu trạng thái dự án
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return theme.statusCompleted;
      case 'in-progress':
        return theme.statusInProgress;
      case 'pending':
        return theme.statusPending;
      case 'cancelled':
        return theme.statusCancelled;
      default:
        return theme.textMuted;
    }
  };

  // Hàm lấy nhãn trạng thái dự án
  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'in-progress':
        return 'Đang thực hiện';
      case 'pending':
        return 'Chờ xử lý';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status || 'Không xác định';
    }
  };

  // Bảng màu mới cho Home (đồng nhất xanh lam đậm, xanh lá, trắng + accent)
  const palette = {
    background: theme.background,
    card: theme.card,
    slateBlue: '#334155',
    deepBlue: '#1E3A8A',
    green: '#2E7D32',
    accent: '#10B981',
    border: theme.border,
    text: theme.text,
    textSecondary: theme.textSecondary || '#6b7280',
  };

  const showLegacySections = false;

  // Tập hợp thẻ chức năng thành Grid theo yêu cầu (loại bỏ dự án/khách hàng gần đây, báo cáo nâng cao...)
  const featureItems = [];
  // Chấm công - Nghỉ phép - Ứng lương (đưa vào grid)
  featureItems.push(
    {
      key: 'att-view',
      label: 'Xem chấm công',
      icon: 'time-outline',
      to: () =>
        navigation.navigate(
          user?.role === 'ke_toan' ? 'Attendance' : 'WorkerAttendance'
        ),
    },
    {
      key: 'leave',
      label: 'Xin nghỉ phép',
      icon: 'calendar-outline',
      to: () => navigation.navigate('LeaveRequest'),
    },
    {
      key: 'advance',
      label: 'Xin ứng lương',
      icon: 'cash-outline',
      to: () => navigation.navigate('AdvanceSalary'),
    }
  );
  if (
    ['ke_toan', 'giam_doc', 'thuong_mai'].includes(
      (user?.role || '').toLowerCase()
    )
  ) {
    featureItems.push(
      {
        key: 'expense-list',
        label: 'Khoản tiền ra',
        icon: 'cash-outline',
        bg: palette.deepBlue,
        to: () => navigation.navigate('CompanyExpenses'),
      },
      {
        key: 'wallet',
        label: 'Ví/Quỹ',
        icon: 'wallet-outline',
        bg: palette.slateBlue,
        to: () => navigation.navigate('Wallet'),
      },
      {
        key: 'expense-add',
        label: 'Thêm chi phí',
        icon: 'add-circle-outline',
        bg: palette.green,
        to: () => navigation.navigate('AddCompanyExpense'),
      },
      {
        key: 'cashin',
        label: 'Yêu cầu nạp',
        icon: 'arrow-down-circle-outline',
        bg: palette.accent,
        to: () => navigation.navigate('CashInRequest'),
      }
    );
  }
  if (
    ['thuong_mai', 'ky_su', 'ke_toan'].includes(
      (user?.role || '').toLowerCase()
    )
  ) {
    featureItems.push(
      {
        key: 'inv-stock',
        label: 'Vật tư tồn kho',
        icon: 'cube-outline',
        bg: palette.green,
        to: () => navigation.navigate('Inventory', { screen: 'InventoryMain' }),
      },
      {
        key: 'inv-report',
        label: 'Báo cáo kho',
        icon: 'bar-chart-outline',
        bg: palette.deepBlue,
        to: () =>
          navigation.navigate('Inventory', { screen: 'InventoryReport' }),
      },
      {
        key: 'inv-tx',
        label: 'Giao dịch kho',
        icon: 'swap-horizontal',
        bg: palette.slateBlue,
        to: () =>
          navigation.navigate('Inventory', { screen: 'InventoryTransaction' }),
      },
      {
        key: 'inv-add',
        label: 'Thêm vật tư',
        icon: 'add-circle',
        bg: '#6D28D9',
        to: () =>
          navigation.navigate('Inventory', { screen: 'AddInventoryItem' }),
      },
      {
        key: 'supplier',
        label: 'Nhà cung cấp',
        icon: 'business-outline',
        bg: '#0EA5E9',
        to: () => navigation.navigate('SupplierManagement'),
      },
      {
        key: 'material',
        label: 'Quản lý vật liệu',
        icon: 'cube-outline',
        bg: '#F97316',
        to: () => navigation.navigate('MaterialManagement'),
      }
    );
  }
  if ((user?.role || '').toLowerCase() === 'ke_toan') {
    featureItems.push(
      {
        key: 'fixed-fee',
        label: 'Phí cố định',
        icon: 'settings-outline',
        bg: '#9333EA',
        to: () => navigation.navigate('FixedFeesManagement'),
      },
      {
        key: 'salary-slip',
        label: 'Tạo phiếu lương',
        icon: 'document-text-outline',
        bg: palette.green,
        to: () => navigation.navigate('SalarySlipCreation'),
      }
    );
  }
  // Luôn hiển thị các mục sản xuất/công việc trong grid (theme xanh)
  featureItems.push(
    {
      key: 'kiosk',
      label: 'Kiosk xưởng sản xuất',
      icon: 'desktop-outline',
      to: () => navigation.navigate('Kiosk'),
    },
    {
      key: 'starboard',
      label: 'Bảng tiến độ dự án',
      icon: 'grid-outline',
      to: () => navigation.navigate('Starboard'),
    },
    {
      key: 'workalloc',
      label: 'Giao việc & Hướng dẫn',
      icon: 'clipboard-outline',
      to: () => navigation.navigate('WorkAllocation'),
    }
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Đã bỏ khối cố định chấm công; đưa vào grid bên dưới */}

      {/* Đã bỏ WorkerFeaturesMenu - các mục đã được đưa vào Grid */}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {showLegacySections && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Dự án gần đây
              </Text>
              <TouchableOpacity onPress={handleViewAllProjects}>
                <Text style={[styles.viewAllText, { color: theme.primary }]}>
                  Xem tất cả
                </Text>
              </TouchableOpacity>
            </View>

            {recentProjects.length > 0 ? (
              recentProjects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.card,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                  ]}
                  onPress={() => handleProjectPress(project)}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardMain}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {project.name || 'Chưa có tên'}
                      </Text>
                      {project.customerName && (
                        <View style={styles.cardRow}>
                          <Ionicons
                            name="business-outline"
                            size={14}
                            color={theme.textSecondary}
                          />
                          <Text
                            style={[
                              styles.cardText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {project.customerName}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(project.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {getStatusLabel(project.status)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={24}
                  color={theme.textMuted}
                />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Chưa có dự án nào
                </Text>
              </View>
            )}
          </View>
          )}

          {/* Grid chức năng chính (đồng nhất icon + màu) */}
          {featureItems.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Chức năng chính
                </Text>
              </View>
              <View style={styles.menuGrid}>
                {featureItems.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.menuCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: '#E2E8F0',
                        shadowColor: palette.slateBlue,
                      },
                    ]}
                    onPress={f.to}
                  >
            <View
              style={[
                        styles.menuIcon,
                        { backgroundColor: '#E8F5E9', borderRadius: 14 },
                      ]}
                    >
                      <Ionicons name={f.icon} size={24} color="#1B5E20" />
                    </View>
                    <Text
                      style={[
                        styles.menuText,
                        { color: palette.text, fontWeight: '700' },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {showLegacySections && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Báo cáo nâng cao
              </Text>
              </View>
              <View style={styles.menuGrid}>
                <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('ProjectProfitReport')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#2E7D32' }]}
                  >
                    <Ionicons name="cash-outline" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    LN dự án
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('WorkerPerformanceReport')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#1565C0' }]}
                  >
                    <Ionicons name="people-outline" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Hiệu suất NV
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('SupplierAnalysisReport')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#6A1B9A' }]}
                  >
                    <Ionicons name="business-outline" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Nhà cung cấp
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Đã gom nhóm mục Tài chính vào Grid ở trên */}

          {showLegacySections &&
            (user?.role === 'giam_doc' ||
              user?.role === 'pho_giam_doc' ||
              user?.role === 'ky_su' ||
              user?.role === 'cong_nhan') && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Ghi chú & Tiến độ
                  </Text>
                </View>
                <View style={styles.menuGrid}>
                  <TouchableOpacity
                    style={[
                      styles.menuCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => navigation.navigate('EmployeeTaskBoard')}
                  >
                    <View
                      style={[styles.menuIcon, { backgroundColor: '#263238' }]}
                    >
                      <Ionicons
                        name="clipboard-outline"
                        size={24}
                        color="#fff"
                      />
                    </View>
                    <Text style={[styles.menuText, { color: theme.text }]}>
                      Bảng việc
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          {/* 库存管理菜单 - 只对特定角色显示 */}
          {showLegacySections &&
            ['thuong_mai', 'ky_su', 'ke_toan'].includes(
            (user?.role || '').toLowerCase()
          ) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Quản lý kho
                </Text>
              </View>
              <View style={styles.menuGrid}>
                <TouchableOpacity
                  style={[
                    styles.menuCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                  ]}
                  onPress={() =>
                    navigation.navigate('Inventory', {
                      screen: 'InventoryMain',
                    })
                  }
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#4CAF50' }]}
                  >
                    <Ionicons name="cube" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Vật tư tồn kho
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                  ]}
                  onPress={() =>
                    navigation.navigate('Inventory', {
                      screen: 'InventoryReport',
                    })
                  }
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#FF9800' }]}
                  >
                    <Ionicons name="bar-chart" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Báo cáo kho
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                  ]}
                  onPress={() =>
                    navigation.navigate('Inventory', {
                      screen: 'InventoryTransaction',
                    })
                  }
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#2196F3' }]}
                  >
                    <Ionicons name="swap-horizontal" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Giao dịch kho
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                  ]}
                  onPress={() =>
                    navigation.navigate('Inventory', {
                      screen: 'AddInventoryItem',
                    })
                  }
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#673AB7' }]}
                  >
                    <Ionicons name="add-circle" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Thêm vật tư
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showLegacySections && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Khách hàng gần đây
              </Text>
              <TouchableOpacity onPress={handleViewAllCustomers}>
                <Text style={[styles.viewAllText, { color: theme.primary }]}>
                  Xem tất cả
                </Text>
              </TouchableOpacity>
            </View>

            {recentCustomers.length > 0 ? (
              recentCustomers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={[
                    styles.card,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                  ]}
                  onPress={() => handleCustomerPress(customer)}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardMain}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {customer.name || 'Chưa có tên'}
                      </Text>
                      {customer.contactPerson && (
                        <View style={styles.cardRow}>
                          <Ionicons
                            name="person-outline"
                            size={14}
                            color={theme.textSecondary}
                          />
                          <Text
                            style={[
                              styles.cardText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {customer.contactPerson}
                          </Text>
                        </View>
                      )}
                      {customer.phone && (
                        <View style={styles.cardRow}>
                          <Ionicons
                            name="call-outline"
                            size={14}
                            color={theme.textSecondary}
                          />
                          <Text
                            style={[
                              styles.cardText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {customer.phone}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={24}
                  color={theme.textMuted}
                />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Chưa có khách hàng nào
                </Text>
              </View>
            )}
          </View>
          )}

          {showLegacySections && (
          <View
            style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.infoText, { color: theme.text }]}>
              THP App - Phiên bản 1.0.0
            </Text>
          </View>
          )}

          {showLegacySections && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SupplierManagement')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#4caf50' }]}>
              <Ionicons name="business-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.menuText}>Quản lý nhà cung cấp</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          )}

          {/* Quản lý vật liệu */}
          {showLegacySections && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate('MaterialManagement');
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FF5722' }]}>
              <Ionicons name="cube-outline" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Quản lý vật liệu</Text>
              <Text
                style={[styles.menuDescription, { color: theme.textMuted }]}
              >
                Quản lý danh sách vật liệu và cập nhật giá cả
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          )}

          {/* Quản lý lương - Chỉ hiển thị cho kế toán */}
          {showLegacySections && isAccountant && (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('FixedFeesManagement')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#9C27B0' }]}>
                  <Ionicons name="settings-outline" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuText}>Quản lý phí cố định</Text>
                  <Text
                    style={[styles.menuDescription, { color: theme.textMuted }]}
                  >
                    Cài đặt BHXH, phụ cấp, khấu trừ cố định
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('SalarySlipCreation')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#4CAF50' }]}>
                  <Ionicons
                    name="document-text-outline"
                    size={24}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuText}>Tạo phiếu lương</Text>
                  <Text
                    style={[styles.menuDescription, { color: theme.textMuted }]}
                  >
                    Tạo và xuất phiếu lương Excel vào Google Drive
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </>
          )}

          {/* Đã xoá các mục Test */}

          {/* Đã chuyển Kiosk/Bảng tiến độ/Giao việc vào Grid phía trên */}

          {/* Production Dashboard for Management */}
          {(user?.role === 'giam_doc' ||
            user?.role === 'pho_giam_doc' ||
            user?.role === 'ky_su') && (
          <TouchableOpacity
            style={styles.menuItem}
              onPress={() => navigation.navigate('ProductionDashboard')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="analytics-outline" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>Dashboard Sản Xuất</Text>
              <Text
                style={[styles.menuDescription, { color: theme.textMuted }]}
              >
                  Giám sát và quản lý sản xuất thời gian thực
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          )}

          {/* Quản lý máy móc - hiển thị cho Giám đốc, Kỹ sư, Phó giám đốc */}
          {(user?.role === 'giam_doc' ||
            user?.role === 'pho_giam_doc' ||
            user?.role === 'ky_su') && (
          <TouchableOpacity
            style={styles.menuItem}
              onPress={() => navigation.navigate('MachinesManagement')}
          >
              <View style={[styles.menuIcon, { backgroundColor: '#00695C' }]}>
                <Ionicons name="construct-outline" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>Quản lý máy móc</Text>
              <Text
                style={[styles.menuDescription, { color: theme.textMuted }]}
              >
                  Danh sách máy, trạng thái, bảo trì
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          )}

          {/* QA/QC - hiển thị cho Giám đốc, Kỹ sư, Phó giám đốc */}
          {(user?.role === 'giam_doc' ||
            user?.role === 'pho_giam_doc' ||
            user?.role === 'ky_su') && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  QA/QC
                </Text>
              </View>
              <View style={styles.menuGrid}>
          <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('QCChecklists')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#00796B' }]}
                  >
                    <Ionicons
                      name="checkmark-done-outline"
                      size={24}
                      color="#fff"
                    />
            </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Checklist
                  </Text>
          </TouchableOpacity>

          <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('QCInspections')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#3949AB' }]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={24}
                      color="#fff"
                    />
            </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Kiểm tra
                  </Text>
          </TouchableOpacity>

          <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('QCNonconformance')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#D32F2F' }]}
                  >
                    <Ionicons name="warning-outline" size={24} color="#fff" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Không phù hợp
              </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('QCReports')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#00897B' }]}
                  >
                    <Ionicons name="analytics-outline" size={24} color="#fff" />
            </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Báo cáo
                  </Text>
          </TouchableOpacity>
              </View>
            </View>
          )}

          {(user?.role === 'giam_doc' ||
            user?.role === 'pho_giam_doc' ||
            user?.role === 'ky_su') && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Lập kế hoạch sản xuất
                </Text>
              </View>
              <View style={styles.menuGrid}>
            <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('ProductionPlanGantt')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#1976D2' }]}
                  >
                    <Ionicons name="calendar-outline" size={24} color="#fff" />
              </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Gantt
                  </Text>
            </TouchableOpacity>

          <TouchableOpacity
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('CapacityPlanning')}
                >
                  <View
                    style={[styles.menuIcon, { backgroundColor: '#455A64' }]}
                  >
                    <Ionicons
                      name="speedometer-outline"
                      size={24}
                      color="#fff"
                    />
            </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Capacity
                  </Text>
          </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Đã gom nhóm mục Quản lý kho vào Grid ở trên */}
        </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMain: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardText: {
    fontSize: 14,
    marginLeft: 6,
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
  emptyCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  infoCard: {
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  // Note: dynamic button styles are generated via helper functions below
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  menuDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '48%',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  expenseActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  expenseActionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    minWidth: '48%',
  },
  expenseActionText: {
    color: '#fff',
    marginTop: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

// Dynamic styles generators
const getAttBtnStyle = (theme) => ({
  backgroundColor: theme.primary,
  borderRadius: 8,
  paddingVertical: 12,
  paddingHorizontal: 20,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 10,
});

const getOvertimeBtnStyle = (theme) => ({
  backgroundColor: theme.primary,
  borderRadius: 20,
  paddingVertical: 8,
  paddingHorizontal: 15,
  marginHorizontal: 5,
});

export default HomeScreen;
