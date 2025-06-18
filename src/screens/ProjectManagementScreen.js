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
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProjects } from '../api/projectService';

// Component hiển thị từng dự án trong danh sách
const ProjectListItem = ({ project, onPress }) => {
  // Xác định màu sắc theo trạng thái dự án
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50'; // xanh lá
      case 'in-progress':
        return '#2196F3'; // xanh dương
      case 'pending':
        return '#FF9800'; // cam
      case 'cancelled':
        return '#F44336'; // đỏ
      default:
        return '#9E9E9E'; // xám
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
        pressed && styles.cardPressed
      ]}
      onPress={() => onPress(project)}
    >
      <View style={styles.projectInfo}>
        <Text style={styles.projectName}>{project.name || 'Chưa có tên'}</Text>
        
        {project.customerName && (
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={14} color="#666" />
            <Text style={styles.infoText}>
              {project.customerName}
            </Text>
          </View>
        )}
        
        {project.startDate && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.infoText}>
              {new Date(project.startDate.seconds * 1000).toLocaleDateString('vi-VN')}
            </Text>
          </View>
        )}
        
        {project.endDate && (
          <View style={styles.infoRow}>
            <Ionicons name="flag-outline" size={14} color="#666" />
            <Text style={styles.infoText}>
              {new Date(project.endDate.seconds * 1000).toLocaleDateString('vi-VN')}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.projectStatusContainer}>
        <View 
          style={[
            styles.projectStatusTag, 
            { borderColor: getStatusColor(project.status) }
          ]}
        >
          <Text 
            style={[
              styles.projectStatusText, 
              { color: getStatusColor(project.status) }
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
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProjects, setFilteredProjects] = useState([]);

  // Hàm tải danh sách dự án
  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjects();
      
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
    loadProjects();
    
    // Thêm listener để làm mới danh sách khi quay lại từ màn hình khác
    const unsubscribe = navigation.addListener('focus', () => {
      loadProjects();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Lọc danh sách dự án theo từ khóa tìm kiếm
  useEffect(() => {
    if (!searchQuery.trim()) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFilteredProjects(projects);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = projects.filter(project => {
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
    loadProjects();
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

  // Hiển thị khi đang tải dữ liệu
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Đang tải danh sách dự án...</Text>
      </View>
    );
  }

  // Hiển thị khi có lỗi
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProjects}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Hiển thị khi không có dự án
  if (projects.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quản lý Dự án</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddProject}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.centerContainer}>
          <Ionicons name="briefcase-outline" size={60} color="#CCCCCC" />
          <Text style={styles.emptyText}>Chưa có dự án nào</Text>
          <TouchableOpacity style={styles.addProjectButton} onPress={handleAddProject}>
            <Text style={styles.addProjectButtonText}>Thêm dự án mới</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Hiển thị danh sách dự án
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quản lý Dự án</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddProject}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm dự án..."
            value={searchQuery}
            onChangeText={handleSearch}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectListItem project={item} onPress={handleProjectPress} />
        )}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <Text style={styles.listSummary}>
            {filteredProjects.length} / {projects.length} dự án
          </Text>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptySearchContainer}>
            <Ionicons name="search-outline" size={50} color="#CCCCCC" />
            <Text style={styles.emptySearchText}>
              Không tìm thấy dự án phù hợp
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  addButton: {
    backgroundColor: '#0066cc',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
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
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    padding: 12,
    flexGrow: 1,
  },
  listSummary: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    marginLeft: 4,
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
    fontWeight: '500',
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
});

export default ProjectManagementScreen; 