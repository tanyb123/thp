import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Image,
  StatusBar,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ProductionService from '../api/productionService';
import { getProjects } from '../api/projectService';
import { getStageIcon, loadCustomIcons } from '../utils/stageIcons';

const { width } = Dimensions.get('window');

// Hook để phát hiện kích thước màn hình và orientation
const useScreenDimensions = () => {
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  useEffect(() => {
    const onChange = (result) => {
      setScreenData(result.window);
    };

    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  return {
    ...screenData,
    isLandscape: screenData.width > screenData.height,
  };
};

const StarboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  // Sử dụng hook để phát hiện kích thước màn hình
  const {
    width: screenWidth,
    height: screenHeight,
    isLandscape,
  } = useScreenDimensions();

  // State management
  const [projects, setProjects] = useState([]);
  const [factoryStatus, setFactoryStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle back button - exit fullscreen first, then navigate back
  const handleBackPress = () => {
    if (isFullscreen) {
      // Nếu đang fullscreen, thoát fullscreen trước
      setIsFullscreen(false);
    } else {
      // Nếu không fullscreen, navigate back bình thường
      navigation.goBack();
    }
  };

  // Manage StatusBar based on fullscreen state
  useEffect(() => {
    if (isFullscreen) {
      // Fullscreen mode: Hide status bar (like gaming apps)
      StatusBar.setHidden(true, 'slide');
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setTranslucent(true);
    } else {
      // Normal mode: Show status bar
      StatusBar.setHidden(false, 'slide');
      StatusBar.setBackgroundColor(theme.primary || '#2196F3', true);
      StatusBar.setTranslucent(false);
    }

    // Cleanup when component unmounts
    return () => {
      StatusBar.setHidden(false, 'slide');
      StatusBar.setTranslucent(false);
    };
  }, [isFullscreen, theme.primary]);

  // Handle Android hardware back button
  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [isFullscreen]);

  // Real-time subscription
  useEffect(() => {
    let unsubscribe = null;

    const setupRealtimeUpdates = async () => {
      try {
        // Load initial data
        await loadData();

        // Setup real-time subscription for factory status
        unsubscribe = ProductionService.subscribeLiveFactoryStatus((status) => {
          setFactoryStatus(status);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error setting up real-time updates:', error);
        setLoading(false);
      }
    };

    setupRealtimeUpdates();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Load initial data
  const loadData = async () => {
    try {
      const [projectsData, factoryStatusData] = await Promise.all([
        getProjects(),
        ProductionService.getLiveFactoryStatus(),
        loadCustomIcons(), // Load custom icons
      ]);

      // Chỉ hiển thị các dự án đang thực hiện - kiểm tra nhiều trạng thái có thể
      const activeProjects = projectsData.filter((project) => {
        const status = project.status?.toLowerCase();
        return (
          status === 'in_progress' ||
          status === 'dang_thuc_hien' ||
          status === 'đang thực hiện' ||
          status === 'in-progress' ||
          status === 'active' ||
          status === 'ongoing'
        );
      });

      // Tạm thời hiển thị tất cả dự án để debug
      setProjects(projectsData);
      setFactoryStatus(factoryStatusData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setForceUpdate((prev) => prev + 1); // Force component re-render
    setRefreshing(false);
  };

  // Get stage status based on project data and factory status
  const getStageStatus = (projectId, stageId) => {
    // First, get the actual stage status from project data
    const project = projects.find((p) => p.id === projectId);
    if (project && project.workflowStages) {
      const stage = project.workflowStages.find((s) => s.stageId === stageId);
      if (stage && stage.status) {
        // Return the actual status from project data
        return stage.status;
      }
    }

    // Fallback: Check if any worker is currently working on this stage
    const workingWorker = factoryStatus.find(
      (worker) =>
        worker.status === 'working' &&
        worker.currentTask?.projectId === projectId &&
        worker.currentTask?.stageId === stageId
    );

    if (workingWorker) {
      return 'in_progress';
    }

    // Default to pending if no status found
    return 'pending';
  };

  // Get workers for a project
  const getProjectWorkers = (projectId) => {
    // Tìm project để lấy tên dự án
    const project = projects.find((p) => p.id === projectId);
    const projectName = project?.name;

    const workingWorkers = factoryStatus.filter(
      (worker) => worker.status === 'working'
    );

    const projectWorkers = factoryStatus.filter((worker) => {
      const isWorking = worker.status === 'working';
      const hasCurrentTask = worker.currentTask;

      // So sánh theo nhiều cách khác nhau
      const projectMatches =
        worker.currentTask?.projectId === projectId ||
        worker.currentTask?.projectName === projectId ||
        worker.currentTask?.project === projectId ||
        worker.currentTask?.projectName === projectName ||
        worker.currentTask?.project === projectName;

      return isWorking && hasCurrentTask && projectMatches;
    });

    return projectWorkers;
  };

  // Calculate project progress
  const calculateProgress = (project) => {
    if (!project.workflowStages || project.workflowStages.length === 0) {
      return 0;
    }

    const completedStages = project.workflowStages.filter(
      (stage) => getStageStatus(project.id, stage.stageId) === 'completed'
    ).length;

    return Math.round((completedStages / project.workflowStages.length) * 100);
  };

  // Get icon for process type - sử dụng từ file stageIcons.js
  const getProcessIcon = (processKey, isCompleted = false) => {
    return getStageIcon(processKey, isCompleted);
  };

  // Render task icon với responsive sizing
  const renderTaskIcon = (stage, projectId, isLandscapeMode = false) => {
    const status = getStageStatus(projectId, stage.stageId);

    let iconColor = '#9E9E9E'; // Default gray
    let borderColor = '#9E9E9E';
    let showTick = false;

    // 🆕 No background fill - transparent/white only
    let backgroundColor = '#FFFFFF'; // Always white background

    switch (status) {
      case 'completed':
        iconColor = '#9E9E9E'; // Gray icon, no fill
        borderColor = '#4CAF50'; // Green border
        backgroundColor = '#FFFFFF'; // 🆕 No green fill
        showTick = true; // Keep green checkmark
        break;
      case 'in_progress':
        iconColor = '#9E9E9E'; // Gray icon, no fill
        borderColor = '#FFC107'; // Yellow border
        backgroundColor = '#FFFFFF'; // 🆕 No yellow fill
        break;
      case 'pending':
      default:
        iconColor = '#9E9E9E'; // Gray icon
        borderColor = '#E0E0E0'; // Light gray border
        backgroundColor = '#FFFFFF'; // White background
        break;
    }

    // Kiểm tra trạng thái hoàn thành
    const isCompleted = status === 'completed';

    const iconData = getProcessIcon(stage.processKey, isCompleted);

    // Responsive sizing - 🆕 Increased icon sizes
    const iconSize = isLandscapeMode ? 40 : 50; // Increased from 32/40 to 40/50
    const iconIconSize = isLandscapeMode ? 20 : 25; // Increased from 16/20 to 20/25

    // Check icon type
    const isCustomIcon =
      typeof iconData === 'object' && iconData.type === 'custom';
    const isAssetIcon =
      typeof iconData === 'object' && iconData.type === 'asset';
    const iconName =
      isCustomIcon || isAssetIcon
        ? null
        : typeof iconData === 'object'
        ? iconData.data
        : iconData;

    return (
      <View
        key={`${stage.stageId}-${forceUpdate}-${isCompleted}`}
        style={[
          styles.taskIconContainer,
          isLandscapeMode && styles.taskIconContainerLandscape,
        ]}
      >
        <View
          style={[
            styles.taskIcon,
            {
              borderColor: borderColor,
              backgroundColor: backgroundColor, // 🆕 Always white - no color fill
              borderWidth: status === 'in_progress' ? 3 : 1,
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
            },
            isLandscapeMode && styles.taskIconLandscape,
          ]}
        >
          {isCustomIcon ? (
            <Image
              source={{ uri: iconData.data.uri }}
              style={{
                width: iconIconSize,
                height: iconIconSize,
                resizeMode: 'contain',
                borderRadius: 2,
              }}
              onError={(error) => {
                console.error('Error loading custom icon in starboard:', error);
              }}
            />
          ) : isAssetIcon ? (
            <Image
              key={`icon-${stage.stageId}-${isCompleted}-${iconData.data}`}
              source={iconData.data}
              style={{
                width: iconIconSize,
                height: iconIconSize,
                resizeMode: 'contain',
                borderRadius: 2,
                tintColor:
                  stage.processKey === 'painting' || stage.processKey === 'son'
                    ? undefined
                    : iconColor,
              }}
            />
          ) : (
            <Ionicons name={iconName} size={iconIconSize} color={iconColor} />
          )}
          {showTick && (
            <View
              style={[
                styles.tickContainer,
                isLandscapeMode && styles.tickContainerLandscape,
              ]}
            >
              <Ionicons
                name="checkmark"
                size={isLandscapeMode ? 6 : 8}
                color="#fff"
              />
            </View>
          )}
        </View>
        {/* 🚫 Removed stage name text - icons only */}
      </View>
    );
  };

  // Render worker avatar với responsive sizing
  const renderWorkerAvatar = (worker, index, isLandscapeMode = false) => {
    // Responsive sizing
    const avatarSize = isLandscapeMode ? 28 : 32;
    const iconSize = isLandscapeMode ? 16 : 20;

    return (
      <View
        key={worker.workerId}
        style={[
          styles.workerAvatar,
          index === 0 ? { marginLeft: 0 } : {},
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          },
          isLandscapeMode && styles.workerAvatarLandscape,
        ]}
      >
        {worker.avatar ? (
          <Image
            source={{ uri: worker.avatar }}
            style={[
              styles.workerAvatarImage,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.workerAvatarPlaceholder,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              },
            ]}
          >
            <Ionicons name="person" size={iconSize} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  // Render project row với responsive layout
  const renderProjectRow = ({ item: project }) => {
    const workers = getProjectWorkers(project.id);

    // Tính toán layout dựa trên orientation
    const getResponsiveLayout = () => {
      if (isLandscape) {
        // Landscape: Tối ưu cho màn hình rộng
        return {
          projectNameFlex: 0.25, // 25% cho tên dự án
          taskIconsFlex: 0.5, // 50% cho icons công đoạn
          workersFlex: 0.25, // 25% cho công nhân
          showMoreIcons: true, // Hiển thị nhiều icons hơn
          maxWorkers: 5, // Hiển thị nhiều workers hơn
        };
      } else {
        // Portrait: Layout gọn gàng cho màn hình dọc
        return {
          projectNameFlex: 0.3, // 30% cho tên dự án
          taskIconsFlex: 0.4, // 40% cho icons công đoạn
          workersFlex: 0.3, // 30% cho công nhân
          showMoreIcons: false, // Giới hạn icons
          maxWorkers: 3, // Giới hạn workers
        };
      }
    };

    const layout = getResponsiveLayout();

    return (
      <View
        style={[
          styles.projectRow,
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
          isLandscape && styles.projectRowLandscape,
        ]}
      >
        {/* Project Name */}
        <View
          style={[
            styles.projectNameContainer,
            { flex: layout.projectNameFlex },
          ]}
        >
          <Text
            style={[
              styles.projectName,
              { color: theme.text },
              isLandscape && styles.projectNameLandscape,
            ]}
            numberOfLines={isLandscape ? 1 : 2}
            ellipsizeMode="tail"
          >
            {project.name}
          </Text>
          {/* 🆕 Hiển thị customer name trong cả portrait và landscape mode */}
          {project.customerName && (
            <Text
              style={[styles.customerName, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {project.customerName}
            </Text>
          )}
        </View>

        {/* Task Icons */}
        <View
          style={[
            styles.taskIconsContainer,
            { flex: layout.taskIconsFlex },
            isLandscape && styles.taskIconsContainerLandscape,
          ]}
        >
          {project.workflowStages?.length > 0 ? (
            project.workflowStages
              .sort((a, b) => a.order - b.order)
              .slice(0, layout.showMoreIcons ? 8 : 4) // Hiển thị nhiều icons hơn trong landscape
              .map((stage) => renderTaskIcon(stage, project.id, isLandscape))
          ) : (
            <Text style={[styles.noStagesText, { color: theme.textSecondary }]}>
              Chưa có công đoạn
            </Text>
          )}
          {/* Hiển thị số lượng stages còn lại nếu có */}
          {project.workflowStages?.length > (layout.showMoreIcons ? 8 : 4) && (
            <View style={styles.moreStagesIndicator}>
              <Text style={styles.moreStagesText}>
                +
                {project.workflowStages.length - (layout.showMoreIcons ? 8 : 4)}
              </Text>
            </View>
          )}
        </View>

        {/* Worker Avatars */}
        <View style={[styles.workersContainer, { flex: layout.workersFlex }]}>
          {workers.length > 0 ? (
            workers
              .slice(0, layout.maxWorkers)
              .map((worker, index) =>
                renderWorkerAvatar(worker, index, isLandscape)
              )
          ) : (
            <Text
              style={[styles.noWorkersText, { color: theme.textSecondary }]}
            >
              Chưa có CN
            </Text>
          )}
          {workers.length > layout.maxWorkers && (
            <View
              style={[
                styles.moreWorkersIndicator,
                isLandscape && styles.moreWorkersIndicatorLandscape,
              ]}
            >
              <Text style={styles.moreWorkersText}>
                +{workers.length - layout.maxWorkers}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
        isFullscreen && styles.fullscreenContainer,
      ]}
    >
      {/* Header - Ẩn trong fullscreen mode */}
      {!isFullscreen && (
        <View
          style={[styles.header, { backgroundColor: theme.cardBackground }]}
        >
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Bảng Tiến Độ Dự Án
            </Text>
          </View>

          <View style={styles.headerRight}>
            {/* Debug info - có thể ẩn trong production */}
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>
                {isLandscape ? '📱 Ngang' : '📱 Dọc'} | Workers:{' '}
                {factoryStatus.filter((w) => w.status === 'working').length}
              </Text>
            </View>

            {/* Fullscreen Toggle Button */}
            <TouchableOpacity
              style={[
                styles.fullscreenButton,
                {
                  backgroundColor: isFullscreen ? '#FF5722' : theme.primary,
                  marginRight: 8,
                },
              ]}
              onPress={toggleFullscreen}
            >
              <Ionicons
                name={isFullscreen ? 'contract' : 'expand'}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: theme.primary }]}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <Ionicons
                name="refresh"
                size={20}
                color="#fff"
                style={refreshing ? { opacity: 0.5 } : {}}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Projects List */}
      <FlatList
        data={projects}
        renderItem={renderProjectRow}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          isLandscape && styles.listContainerLandscape,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        key={`starboard-${isLandscape}`} // Force re-render khi orientation thay đổi
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-outline"
              size={64}
              color={theme.textSecondary}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {loading ? 'Đang tải...' : 'Không có dự án nào'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerTitle: {
    fontSize: 22, // 🆕 Increased from 20 to 22
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
  },
  listContainer: {
    padding: 24, // 🆕 Increased from 18 to 24 (more outer spacing)
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 32, // 🆕 Increased from 24 to 32 (more inner spacing)
    marginBottom: 16, // 🆕 Increased from 8 to 16 (more spacing between rows)
    borderWidth: 1,
    borderRadius: 8,
  },
  projectNameContainer: {
    flex: 0.3,
    paddingRight: 20,
  },
  projectName: {
    fontSize: 22, // 🆕 Increased from 18 to 22 (larger project names)
    fontWeight: '600',
  },
  taskIconsContainer: {
    flex: 0.4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  taskIconContainer: {
    marginRight: 12,
    position: 'relative',
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  tickContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noStagesText: {
    fontSize: 14, // 🆕 Increased from 12 to 14
    fontStyle: 'italic',
  },
  workersContainer: {
    flex: 0.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    marginLeft: -8,
  },
  workerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  workerAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2196F3',
  },
  moreWorkersIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreWorkersText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  noWorkersText: {
    fontSize: 14, // 🆕 Increased from 12 to 14
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18, // 🆕 Increased from 16 to 18
    marginTop: 16,
    textAlign: 'center',
  },

  // Responsive Layout Styles
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

  // Project Row Landscape Styles
  projectRowLandscape: {
    paddingVertical: 8,
    minHeight: 60,
  },
  projectNameLandscape: {
    fontSize: 14,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 14, // 🆕 Increased from 11 to 14 (larger customer name)
    marginTop: 2,
    fontStyle: 'italic',
  },

  // Task Icons Landscape Styles
  taskIconContainerLandscape: {
    marginRight: 6,
    alignItems: 'center',
  },
  taskIconLandscape: {
    marginBottom: 2,
  },
  tickContainerLandscape: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // 🚫 Removed stageNameText style - no longer needed
  moreStagesIndicator: {
    backgroundColor: '#E0E0E0',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  moreStagesText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  taskIconsContainerLandscape: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },

  // Worker Avatar Landscape Styles
  workerAvatarLandscape: {
    marginLeft: -4,
  },
  moreWorkersIndicatorLandscape: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },

  // List Container Landscape Styles
  listContainerLandscape: {
    paddingHorizontal: 8,
  },

  // Fullscreen Mode Styles
  fullscreenContainer: {
    paddingTop: 0, // Remove status bar padding
  },
  fullscreenButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default StarboardScreen;
