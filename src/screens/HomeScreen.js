import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getProjects } from '../api/projectService';
import { getCustomers } from '../api/customerService';
import { useFocusEffect } from '@react-navigation/native';

const HomeScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
  }, []);
  
  // Làm mới dữ liệu khi màn hình được focus
  useFocusEffect(
    React.useCallback(() => {
      loadHomeData();
    }, [])
  );
  
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
      case 'completed': return theme.statusCompleted;
      case 'in-progress': return theme.statusInProgress;
      case 'pending': return theme.statusPending;
      case 'cancelled': return theme.statusCancelled;
      default: return theme.textMuted;
    }
  };
  
  // Hàm lấy nhãn trạng thái dự án
  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Hoàn thành';
      case 'in-progress': return 'Đang thực hiện';
      case 'pending': return 'Chờ xử lý';
      case 'cancelled': return 'Đã hủy';
      default: return status || 'Không xác định';
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={theme.background} 
      />
      
      <View style={[styles.header, { 
        backgroundColor: theme.card,
        borderBottomColor: theme.border,
      }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Trang Chủ</Text>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
                  style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleProjectPress(project)}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardMain}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {project.name || 'Chưa có tên'}
                      </Text>
                      {project.customerName && (
                        <View style={styles.cardRow}>
                          <Ionicons name="business-outline" size={14} color={theme.textSecondary} />
                          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                            {project.customerName}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) }]}>
                      <Text style={styles.statusText}>
                        {getStatusLabel(project.status)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="briefcase-outline" size={24} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Chưa có dự án nào
                </Text>
              </View>
            )}
          </View>
          
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
                  style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleCustomerPress(customer)}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardMain}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {customer.name || 'Chưa có tên'}
                      </Text>
                      {customer.contactPerson && (
                        <View style={styles.cardRow}>
                          <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                            {customer.contactPerson}
                          </Text>
                        </View>
                      )}
                      {customer.phone && (
                        <View style={styles.cardRow}>
                          <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
                          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                            {customer.phone}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="people-outline" size={24} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Chưa có khách hàng nào
                </Text>
              </View>
            )}
          </View>
          
          {/* Thông tin ứng dụng */}
          <View style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="information-circle-outline" size={24} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              THP App - Phiên bản 1.0.0
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
});

export default HomeScreen; 