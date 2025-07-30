//src/screens/ProjectManagementScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProjectsByStatus } from '../api/projectService';
import { useTheme } from '../contexts/ThemeContext';

// Component hiển thị từng dự án trong danh sách
const ProjectListItem = ({ project, onPress }) => {
  const { theme } = useTheme();
  // Xác định màu sắc theo trạng thái dự án
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50'; // xanh lá
      case 'in-progress':
        return '#FFD54F'; // vàng nhạt
      case 'pending':
        return theme.textSecondary; // gray
      case 'cancelled':
        return '#F44336'; // đỏ
      default:
        return theme.textMuted; // Sử dụng màu từ theme
    }
  };

  // Lấy nhãn hiển thị cho trạng thái dự án
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
    <Pressable
      style={({ pressed }) => [
        styles.projectCard,
        { backgroundColor: theme.card },
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(project)}
    >
      <View style={styles.projectInfo}>
        <Text style={[styles.projectName, { color: theme.text }]}>
          {project.name || 'Chưa có tên'}
        </Text>

        {project.customerName && (
          <View style={styles.infoRow}>
            <Ionicons
              name="business-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {project.customerName}
            </Text>
          </View>
        )}

        {project.startDate && (
          <View style={styles.infoRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {new Date(project.startDate.seconds * 1000).toLocaleDateString(
                'vi-VN'
              )}
            </Text>
          </View>
        )}

        {project.endDate && (
          <View style={styles.infoRow}>
            <Ionicons
              name="flag-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {new Date(project.endDate.seconds * 1000).toLocaleDateString(
                'vi-VN'
              )}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.projectStatusContainer}>
        <View
          style={[
            styles.projectStatusTag,
            { borderColor: getStatusColor(project.status) },
          ]}
        >
          <Text
            style={[
              styles.projectStatusText,
              { color: getStatusColor(project.status) },
            ]}
          >
            {getStatusLabel(project.status)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const ProjectManagementScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProjects, setFilteredProjects] = useState([]);

  // Status filters
  const FILTERS = [
    {
      key: 'pending',
      label: 'Chờ xử lý',
      color: 'transparent',
      textColor: theme.text,
    },
    {
      key: 'in-progress',
      label: 'Đang thực hiện',
      color: '#FFF9C4',
      textColor: theme.text,
    },
    {
      key: 'completed',
      label: 'Đã hoàn thành',
      color: '#4CAF50',
      textColor: '#fff',
    },
  ];

  const [activeFilter, setActiveFilter] = useState('pending');
  const [cacheByStatus, setCacheByStatus] = useState({});

  // Hàm tải danh sách dự án
  const loadProjectsByStatus = async (statusKey, forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (!forceRefresh && cacheByStatus[statusKey]) {
        setProjects(cacheByStatus[statusKey]);
        return;
      }

      if (forceRefresh) {
        setCacheByStatus((prev) => ({ ...prev, [statusKey]: undefined }));
      }

      const data = await getProjectsByStatus(statusKey);

      // Lưu cache mới
      setCacheByStatus((prev) => ({ ...prev, [statusKey]: data }));

      // Thêm animation khi cập nhật danh sách
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setProjects(data);
      setFilteredProjects(data); // Khởi tạo danh sách lọc ban đầu
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

    // Thêm listener để làm mới danh sách khi quay lại từ màn hình khác
    const unsubscribe = navigation.addListener('focus', () => {
      loadProjectsByStatus(activeFilter, true); // force refresh để cập nhật nếu trạng thái dự án thay đổi
    });

    return unsubscribe;
  }, [navigation, activeFilter]);

  // Lọc danh sách dự án theo từ khóa tìm kiếm
  useEffect(() => {
    if (!searchQuery.trim()) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFilteredProjects(projects);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = projects.filter((project) => {
      const name = (project.name || '').toLowerCase();
      const customerName = (project.customerName || '').toLowerCase();
      const description = (project.description || '').toLowerCase();

      return (
        name.includes(query) ||
        customerName.includes(query) ||
        description.includes(query)
      );
    });

    // Thêm animation khi cập nhật kết quả tìm kiếm
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setFilteredProjects(filtered);
  }, [searchQuery, projects]);

  // Xử lý khi người dùng kéo để làm mới
  const handleRefresh = () => {
    setRefreshing(true);
    // clear cache for current status then reload
    setCacheByStatus((prev) => ({ ...prev, [activeFilter]: undefined }));
    loadProjectsByStatus(activeFilter);
  };

  // Xử lý khi thay đổi bộ lọc
  const handleFilterChange = (statusKey) => {
    // Luôn refetch để đảm bảo dữ liệu mới nhất
    loadProjectsByStatus(statusKey, true);
    setActiveFilter(statusKey);
    setSearchQuery('');
  };

  // Xử lý khi người dùng nhấn vào một dự án
  const handleProjectPress = (project) => {
    navigation.navigate('ProjectDetail', { projectId: project.id });
  };

  // Xử lý khi người dùng muốn thêm dự án mới
  const handleAddProject = () => {
    navigation.navigate('AddProject');
  };

  // Xử lý khi người dùng nhập từ khóa tìm kiếm
  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  // Xử lý khi người dùng muốn xóa từ khóa tìm kiếm
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Render filter buttons
  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f.key}
          style={[
            styles.filterButton,
            {
              backgroundColor: f.color,
              borderWidth: activeFilter === f.key ? 2 : 1,
              borderColor:
                activeFilter === f.key ? theme.primary : theme.border,
            },
          ]}
          onPress={() => handleFilterChange(f.key)}
        >
          <Text style={[styles.filterText, { color: f.textColor }]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {renderFilterButtons()}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={theme.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.searchInput,
            { color: theme.text, borderColor: theme.border },
          ]}
          placeholder="Tìm theo tên, khách hàng..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={handleClearSearch}
            style={styles.clearSearchButton}
          >
            <Ionicons name="close-circle" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Project List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={50}
            color={theme.danger}
          />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[styles.button, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.buttonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProjects.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="file-tray-outline"
            size={60}
            color={theme.textMuted}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Chưa có dự án nào
          </Text>
          <TouchableOpacity
            onPress={handleAddProject}
            style={[styles.button, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.buttonText}>Thêm dự án mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={({ item }) => (
            <ProjectListItem project={item} onPress={handleProjectPress} />
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    bottom: 24,
    zIndex: 1,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  resultCount: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 14,
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardPressed: {
    opacity: 0.7,
    backgroundColor: '#f5f5f5',
  },
  projectInfo: {
    flex: 1,
    paddingRight: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 6,
  },
  projectStatusContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  projectStatusTag: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  projectStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  addProjectButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  addProjectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptySearchText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  clearSearchButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ProjectManagementScreen;
