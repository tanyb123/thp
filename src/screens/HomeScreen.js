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

  const ROLE_CAN_ATTEND = ['ke_toan'];

  const canUseAttendance = ROLE_CAN_ATTEND.includes(
    (user?.role || '').toLowerCase()
  );

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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {canUseAttendance && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 8,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.border,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: theme.text,
                marginBottom: 8,
              }}
            >
              Chấm Công Hôm Nay
            </Text>
            {attLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                {(() => {
                  const status = getAttendanceStatus(attendance);
                  if (status === 'none') {
                    return (
                      <TouchableOpacity
                        style={getAttBtnStyle(theme)}
                        onPress={handleClockIn}
                      >
                        <Ionicons
                          name="log-in-outline"
                          size={20}
                          color="#fff"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={{ color: '#fff', fontWeight: '600' }}>
                          Chấm Công Vào
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  if (status === 'clocked_in') {
                    return (
                      <>
                        <Text style={{ color: theme.text, marginBottom: 8 }}>
                          Vào lúc:{' '}
                          {attendance.clockIn.toDate().toLocaleTimeString()}
                        </Text>
                        <TouchableOpacity
                          style={getAttBtnStyle(theme)}
                          onPress={handleClockOut}
                        >
                          <Ionicons
                            name="log-out-outline"
                            size={20}
                            color="#fff"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={{ color: '#fff', fontWeight: '600' }}>
                            Chấm Công Ra
                          </Text>
                        </TouchableOpacity>
                      </>
                    );
                  }
                  if (status === 'clocked_out') {
                    return (
                      <>
                        <Text style={{ color: theme.text, marginBottom: 4 }}>
                          Vào lúc:{' '}
                          {attendance.clockIn.toDate().toLocaleTimeString()}
                        </Text>
                        <Text style={{ color: theme.text, marginBottom: 8 }}>
                          Ra lúc:{' '}
                          {attendance.clockOut.toDate().toLocaleTimeString()}
                        </Text>
                        <Text style={{ color: theme.text, marginBottom: 8 }}>
                          Tăng ca: {attendance.overtime || 0} giờ
                        </Text>
                        <View style={{ flexDirection: 'row' }}>
                          {[1, 2, 3].map((h) => (
                            <TouchableOpacity
                              key={h}
                              style={getOvertimeBtnStyle(theme)}
                              onPress={() => handleAddOvertime(h)}
                            >
                              <Text style={{ color: '#fff' }}>+{h}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    );
                  }
                })()}
              </>
            )}
          </View>
        </View>
      )}

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
          {/* Phần dự án gần đây */}
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
                    { backgroundColor: theme.card, borderColor: theme.border },
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

          {/* 库存管理菜单 - 只对特定角色显示 */}
          {['thuong_mai', 'ky_su', 'ke_toan'].includes(
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
                    { backgroundColor: theme.card, borderColor: theme.border },
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
                    { backgroundColor: theme.card, borderColor: theme.border },
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
                    { backgroundColor: theme.card, borderColor: theme.border },
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
                    { backgroundColor: theme.card, borderColor: theme.border },
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

          {/* Phần khách hàng gần đây */}
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
                    { backgroundColor: theme.card, borderColor: theme.border },
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

          {/* Thông tin ứng dụng */}
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

          {/* Nút quản lý nhà cung cấp */}
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

          {/* Trong phần menu items, thêm mục quản lý kho */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Inventory')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="package-variant" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Quản lý kho</Text>
              <Text
                style={[styles.menuDescription, { color: theme.textMuted }]}
              >
                Quản lý vật tư, nhập xuất kho
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: 'bold',
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
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
