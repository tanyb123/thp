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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProjectsByStatus } from '../api/projectService';
import { useFocusEffect } from '@react-navigation/native';

// Responsive breakpoints
const BREAKPOINTS = {
  SMALL: 480, // Small phones
  MEDIUM: 768, // Large phones / Small tablets
  LARGE: 1024, // Tablets
  XLARGE: 1200, // Large tablets / Desktop
};

// Hook để phát hiện kích thước màn hình và responsive breakpoints
const useScreenDimensions = () => {
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  useEffect(() => {
    const onChange = (result) => {
      setScreenData(result.window);
    };

    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  const isLandscape = screenData.width > screenData.height;
  const { width } = screenData;

  // Determine device type and layout
  const deviceType =
    width >= BREAKPOINTS.LARGE
      ? 'tablet'
      : width >= BREAKPOINTS.MEDIUM
      ? 'large-phone'
      : 'phone';

  const isTablet = deviceType === 'tablet';
  const isLargePhone = deviceType === 'large-phone';

  // Calculate responsive columns
  const getColumns = () => {
    if (isTablet && isLandscape) return 4; // 4 columns for tablet landscape
    if (isTablet) return 3; // 3 columns for tablet portrait
    if (isLargePhone && isLandscape) return 3; // 3 columns for large phone landscape
    if (isLargePhone) return 2; // 2 columns for large phone portrait
    if (isLandscape) return 2; // 2 columns for phone landscape
    return 1; // 1 column for phone portrait
  };

  // Calculate responsive spacing
  const getSpacing = () => {
    if (isTablet) return { horizontal: 20, vertical: 16, card: 12 };
    if (isLargePhone) return { horizontal: 16, vertical: 12, card: 10 };
    return { horizontal: 12, vertical: 10, card: 8 };
  };

  // Calculate responsive font sizes
  const getFontSizes = () => {
    const baseSize = isTablet ? 16 : isLargePhone ? 15 : 14;
    return {
      small: baseSize - 3,
      medium: baseSize - 1,
      large: baseSize + 1,
      xlarge: baseSize + 3,
      title: baseSize + 4,
    };
  };

  // Calculate responsive card dimensions
  const getCardDimensions = () => {
    const spacing = getSpacing();
    const columns = getColumns();
    const totalHorizontalPadding = spacing.horizontal * 2;
    const totalCardSpacing = spacing.card * (columns - 1);
    const availableWidth = width - totalHorizontalPadding - totalCardSpacing;
    const cardWidth = availableWidth / columns;

    return {
      width: cardWidth,
      minHeight: isTablet ? 140 : isLargePhone ? 120 : 100,
      padding: isTablet ? 16 : isLargePhone ? 14 : 12,
    };
  };

  return {
    ...screenData,
    isLandscape,
    deviceType,
    isTablet,
    isLargePhone,
    columns: getColumns(),
    spacing: getSpacing(),
    fontSizes: getFontSizes(),
    cardDimensions: getCardDimensions(),
  };
};

const ProjectsScreen = ({ navigation }) => {
  const [projects, setProjects] = useState([]); // projects hiển thị theo bộ lọc hiện hành
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Sử dụng hook để phát hiện kích thước màn hình và responsive values
  const {
    width,
    height,
    isLandscape,
    deviceType,
    isTablet,
    isLargePhone,
    columns,
    spacing,
    fontSizes,
    cardDimensions,
  } = useScreenDimensions();

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
    <View
      style={[
        styles.filterContainer,
        {
          paddingHorizontal: spacing.horizontal,
          paddingVertical: spacing.vertical / 2, // Giảm padding vertical
        },
      ]}
    >
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f.key}
          style={[
            styles.filterButton,
            {
              backgroundColor: activeFilter === f.key ? f.color : '#fff',
              paddingHorizontal: isTablet ? 16 : 12, // Giảm padding
              paddingVertical: isTablet ? 8 : 6, // Giảm padding
              borderRadius: isTablet ? 16 : 12, // Giảm border radius
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
              {
                color: activeFilter === f.key ? f.textColor : '#333',
                fontSize: fontSizes.small, // Giảm font size
                fontWeight: activeFilter === f.key ? '600' : '500',
              },
            ]}
          >
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Hiển thị từng dự án trong danh sách
  const renderProjectItem = ({ item, index }) => {
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

    // Tính toán style cho responsive layout
    const getItemStyle = () => {
      const baseStyle = {
        ...styles.projectCard,
        minHeight: cardDimensions.minHeight,
        padding: cardDimensions.padding,
        marginBottom: spacing.vertical,
        flex: columns > 1 ? 1 : undefined, // Use flex for multi-column
      };

      // Width và margin cho multi-column layout
      if (columns > 1) {
        baseStyle.marginRight = (index + 1) % columns === 0 ? 0 : spacing.card;
        baseStyle.maxWidth = cardDimensions.width; // Set max width instead of fixed width
      } else {
        baseStyle.width = '100%'; // Full width for single column
      }

      return baseStyle;
    };

    return (
      <TouchableOpacity
        style={getItemStyle()}
        onPress={() => handleProjectPress(item)}
      >
        <View style={styles.projectHeader}>
          <Text
            style={[
              styles.projectName,
              {
                fontSize: fontSizes.large,
                lineHeight: fontSizes.large * 1.3,
              },
            ]}
            numberOfLines={columns > 1 ? 2 : undefined}
          >
            {item.name || 'Chưa có tên'}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(item.status),
                paddingHorizontal: isTablet ? 10 : 8,
                paddingVertical: isTablet ? 6 : 4,
              },
            ]}
          >
            <Text style={[styles.statusText, { fontSize: fontSizes.small }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        {item.customerName && (
          <View style={[styles.infoRow, { marginTop: spacing.vertical / 2 }]}>
            <Ionicons
              name="business-outline"
              size={isTablet ? 16 : 14}
              color="#666"
            />
            <Text
              style={[
                styles.infoText,
                {
                  fontSize: fontSizes.medium,
                  marginLeft: spacing.card / 2,
                },
              ]}
              numberOfLines={columns > 1 ? 1 : undefined}
            >
              {item.customerName}
            </Text>
          </View>
        )}

        {/* Thêm thông tin ngày tháng nếu có */}
        {(item.startDate || item.endDate) && (
          <View style={[styles.infoRow, { marginTop: spacing.vertical / 3 }]}>
            <Ionicons
              name="calendar-outline"
              size={isTablet ? 16 : 14}
              color="#666"
            />
            <Text
              style={[
                styles.infoText,
                {
                  fontSize: fontSizes.small,
                  marginLeft: spacing.card / 2,
                },
              ]}
              numberOfLines={1}
            >
              {item.startDate &&
                `Bắt đầu: ${new Date(item.startDate).toLocaleDateString(
                  'vi-VN'
                )}`}
              {item.startDate && item.endDate && ' • '}
              {item.endDate &&
                `Kết thúc: ${new Date(item.endDate).toLocaleDateString(
                  'vi-VN'
                )}`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { flex: 1 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
        <View
          style={[styles.header, { paddingHorizontal: 16, paddingVertical: 8 }]}
        >
          <Text style={[styles.headerTitle, { fontSize: fontSizes.large }]}>
            Dự Án
          </Text>
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
      <SafeAreaView style={[styles.container, { flex: 1 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
        <View
          style={[styles.header, { paddingHorizontal: 16, paddingVertical: 8 }]}
        >
          <Text style={[styles.headerTitle, { fontSize: fontSizes.large }]}>
            Dự Án
          </Text>
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
    <SafeAreaView style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />

      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.horizontal,
            paddingVertical: spacing.vertical / 2, // Giảm padding vertical
            minHeight: isTablet ? 60 : 50, // Giảm chiều cao tối thiểu
          },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            {
              fontSize: fontSizes.large, // Giảm font size từ title xuống large
              fontWeight: '600',
            },
          ]}
        >
          Dự Án
        </Text>
        <View style={styles.headerRight}>
          {/* Ẩn debug info trong production để tiết kiệm không gian */}
          {__DEV__ && (
            <View style={[styles.debugInfo, { marginRight: 6 }]}>
              <Text
                style={[styles.debugText, { fontSize: fontSizes.small - 1 }]}
              >
                {columns}Col{isLandscape ? '🔄' : '⬆️'}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.manageButton,
              {
                paddingHorizontal: isTablet ? 12 : 8, // Giảm padding
                paddingVertical: isTablet ? 6 : 4, // Giảm padding
              },
            ]}
            onPress={handleManageProjects}
          >
            <Ionicons
              name="settings-outline"
              size={isTablet ? 16 : 14} // Giảm icon size
              color="#0066cc"
            />
          </TouchableOpacity>
        </View>
      </View>

      {renderFilterButtons()}

      {projects.length > 0 ? (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProjectItem}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: spacing.horizontal,
              paddingVertical: spacing.vertical,
            },
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          numColumns={columns}
          key={`${columns}-${deviceType}-${isLandscape}`} // Force re-render khi layout thay đổi
          columnWrapperStyle={columns > 1 ? styles.row : null}
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          removeClippedSubviews={false}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          getItemLayout={null} // Disable for dynamic heights
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    elevation: 1, // Giảm elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, // Giảm shadow opacity
    shadowRadius: 1,
    // Dynamic padding will be applied inline
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugInfo: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  debugText: {
    fontSize: 10,
    color: '#E65100',
    fontWeight: '500',
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
    flexGrow: 1,
    paddingBottom: 20, // Ensure bottom padding for scroll
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Dynamic values will be applied inline
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectName: {
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    // Dynamic fontSize will be applied inline
  },
  statusBadge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
    // Dynamic padding will be applied inline
  },
  statusText: {
    fontWeight: '500',
    color: 'white',
    // Dynamic fontSize will be applied inline
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Dynamic marginTop will be applied inline
  },
  infoText: {
    color: '#666',
    flex: 1,
    // Dynamic fontSize and marginLeft will be applied inline
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
    // Dynamic padding will be applied inline
  },
  filterButton: {
    // Dynamic padding and borderRadius will be applied inline
  },
  filterText: {
    fontWeight: '500',
    // Dynamic fontSize will be applied inline
  },

  // Responsive Layout Styles
  row: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 0, // Remove extra padding that might cause issues
  },
});

export default ProjectsScreen;
