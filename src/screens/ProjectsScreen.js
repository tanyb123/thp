//src/screens/ProjectsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProjectsByStatus } from '../api/projectService';
import { useFocusEffect } from '@react-navigation/native';

const ProjectsScreen = ({ navigation }) => {
  const [projects, setProjects] = useState([]); // projects hiển thị theo bộ lọc hiện hành
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Lọc theo trạng thái dự án
  const FILTERS = [
    {
      key: 'pending',
      label: 'Chờ xử lý',
      color: 'transparent',
      textColor: '#333',
    },
    {
      key: 'in-progress',
      label: 'Đang thực hiện',
      color: '#FFF9C4',
      textColor: '#333',
    }, // vàng nhạt
    {
      key: 'completed',
      label: 'Hoàn thành',
      color: '#4CAF50',
      textColor: '#fff',
    },
  ];

  const [activeFilter, setActiveFilter] = useState('pending');
  // Cache dự án theo trạng thái để không phải gọi lại
  const [cacheByStatus, setCacheByStatus] = useState({});

  // Hàm tải danh sách dự án
  const loadProjectsByStatus = async (statusKey) => {
    // Nếu đã có trong cache thì dùng luôn
    if (cacheByStatus[statusKey]) {
      setProjects(cacheByStatus[statusKey]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getProjectsByStatus(statusKey);
      // Lưu cache
      setCacheByStatus((prev) => ({ ...prev, [statusKey]: data }));
      setProjects(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách dự án:', err);
      setError('Không thể tải danh sách dự án. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Tải dữ liệu khi màn hình được mở
  useEffect(() => {
    loadProjectsByStatus(activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // Làm mới dữ liệu khi màn hình được focus
  useFocusEffect(
    React.useCallback(() => {
      loadProjectsByStatus(activeFilter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFilter])
  );

  // Xử lý khi người dùng kéo để làm mới
  const handleRefresh = () => {
    setRefreshing(true);
    // Xóa cache của bộ lọc hiện hành để buộc refetch
    setCacheByStatus((prev) => ({ ...prev, [activeFilter]: undefined }));
    loadProjectsByStatus(activeFilter);
  };

  // Xử lý khi người dùng nhấn vào nút quản lý dự án
  const handleManageProjects = () => {
    navigation.navigate('ProjectManagement');
  };

  // Xử lý khi người dùng nhấn vào một dự án
  const handleProjectPress = (project) => {
    navigation.navigate('ProjectDetail', { projectId: project.id });
  };

  // Nút lọc trạng thái
  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f.key}
          style={[
            styles.filterButton,
            {
              backgroundColor: activeFilter === f.key ? f.color : '#fff',
              borderWidth: 1,
              borderColor:
                activeFilter === f.key
                  ? f.color === 'transparent'
                    ? '#ccc'
                    : f.color
                  : '#ccc',
            },
          ]}
          onPress={() => setActiveFilter(f.key)}
        >
          <Text
            style={[
              styles.filterText,
              { color: activeFilter === f.key ? f.textColor : '#333' },
            ]}
          >
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Hiển thị từng dự án trong danh sách
  const renderProjectItem = ({ item }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'completed':
          return '#4CAF50';
        case 'in-progress':
          return '#FFD54F'; // vàng nhạt
        case 'pending':
          return '#9E9E9E';
        case 'cancelled':
          return '#F44336';
        default:
          return '#9E9E9E';
      }
    };

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
      <TouchableOpacity
        style={styles.projectCard}
        onPress={() => handleProjectPress(item)}
      >
        <View style={styles.projectHeader}>
          <Text style={styles.projectName}>{item.name || 'Chưa có tên'}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        {item.customerName && (
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={14} color="#666" />
            <Text style={styles.infoText}>{item.customerName}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dự Án</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Đang tải dự án...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dự Án</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={50} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadProjectsByStatus(activeFilter)}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dự Án</Text>
        <TouchableOpacity
          style={styles.manageButton}
          onPress={handleManageProjects}
        >
          <Text style={styles.manageButtonText}>Quản lý</Text>
          <Ionicons name="settings-outline" size={16} color="#0066cc" />
        </TouchableOpacity>
      </View>

      {renderFilterButtons()}

      {projects.length > 0 ? (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProjectItem}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="briefcase" size={80} color="#0066cc" />
          <Text style={styles.emptyTitle}>Chưa có dự án nào</Text>
          <Text style={styles.emptySubtitle}>
            Bạn chưa có dự án nào. Hãy tạo dự án mới trong mục quản lý dự án.
          </Text>
          <TouchableOpacity
            style={styles.manageFullButton}
            onPress={handleManageProjects}
          >
            <Text style={styles.manageFullButtonText}>Quản lý dự án</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#E6F0FF',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0066cc',
    marginRight: 4,
  },
  listContent: {
    padding: 16,
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#0066cc',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  manageFullButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0066cc',
    borderRadius: 8,
  },
  manageFullButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ProjectsScreen;
