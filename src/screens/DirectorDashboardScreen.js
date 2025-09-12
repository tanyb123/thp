import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getProposalsByStatus,
  canApproveProposal,
} from '../api/proposalService';

const DirectorDashboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingProposals, setPendingProposals] = useState([]);
  const [canApprove, setCanApprove] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Thêm useFocusEffect để tải lại dữ liệu khi màn hình được focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      // Kiểm tra quyền duyệt đề xuất
      const hasApprovalPermission = canApproveProposal(currentUser?.role);
      setCanApprove(hasApprovalPermission);

      // Nếu có quyền duyệt, tải danh sách đề xuất chờ duyệt
      if (hasApprovalPermission) {
        try {
          const proposals = await getProposalsByStatus('pending');
          console.log('Loaded pending proposals:', proposals.length);
          setPendingProposals(proposals);
        } catch (error) {
          console.error('Error loading proposals:', error);
          // Vẫn set canApprove để hiển thị UI
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('vi-VN');
      } else if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('vi-VN');
      }
      return 'N/A';
    } catch (e) {
      return 'N/A';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#FF3B30';
      case 'normal':
        return '#007AFF';
      default:
        return '#007AFF';
    }
  };

  const renderProposalItem = ({ item }) => {
    // Choose icon and color based on priority
    let iconName = 'document-text';
    let iconColor = '#4E8AF4'; // New color for default items

    if (item.priority === 'urgent') {
      iconName = 'alert-circle';
      iconColor = '#FF3B30';
    }

    return (
      <TouchableOpacity
        style={[styles.proposalItem, { backgroundColor: theme.card }]}
        onPress={() => navigation.navigate('ProposalList')}
      >
        <View style={styles.proposalIconContainer}>
          <Ionicons name={iconName} size={24} color={iconColor} />
        </View>
        <View style={styles.proposalContent}>
          <Text
            style={[styles.proposalCode, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.proposalCode}
          </Text>
          <Text
            style={[styles.projectName, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {item.projectName}
          </Text>
          <Text
            style={[
              styles.requiredDate,
              {
                color:
                  item.priority === 'urgent' ? '#FF3B30' : theme.textSecondary,
              },
            ]}
          >
            Cần: {formatDate(item.requiredDate)} • {item.items?.length || 0} vật
            tư
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </TouchableOpacity>
    );
  };

  // Helper functions for status and priority
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'pending':
      default:
        return '#FF9500';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':
        return 'Đã duyệt';
      case 'rejected':
        return 'Từ chối';
      case 'pending':
      default:
        return 'Chờ duyệt';
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={[styles.screenTitle, { color: theme.text }]}>
        Bảng điều khiển Giám đốc
      </Text>

      {/* Nút truy cập màn hình công nợ */}
      <TouchableOpacity
        style={[styles.debtButton, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('DebtDashboard')}
      >
        <Ionicons name="cash-outline" size={24} color="white" />
        <Text style={styles.debtButtonText}>Xem báo cáo công nợ</Text>
      </TouchableOpacity>

      {/* Phần đề xuất chờ duyệt */}
      {canApprove && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons
                name="file-tray-stacked-outline"
                size={22}
                color={theme.primary}
                style={styles.sectionIcon}
              />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Đề xuất chờ duyệt
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('ProposalList')}
            >
              <Text style={[styles.viewAllText, { color: theme.primary }]}>
                Xem tất cả
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.primary}
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={styles.loader}
            />
          ) : pendingProposals.length > 0 ? (
            <View
              style={[styles.proposalsContainer, { borderColor: theme.border }]}
            >
              <FlatList
                data={pendingProposals}
                renderItem={renderProposalItem}
                keyExtractor={(item) => item.id}
                style={styles.proposalsList}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                ListFooterComponent={
                  pendingProposals.length > 3 ? (
                    <TouchableOpacity
                      style={[
                        styles.moreButton,
                        { backgroundColor: theme.backgroundLight },
                      ]}
                      onPress={() => navigation.navigate('ProposalList')}
                    >
                      <Text
                        style={[
                          styles.moreButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        Xem thêm {pendingProposals.length - 3} đề xuất
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Ionicons
                name="checkmark-circle"
                size={40}
                color={theme.success || '#4CAF50'}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Không có đề xuất nào chờ duyệt
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Các phần khác của dashboard */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons
            name="stats-chart"
            size={22}
            color="#0066cc"
            style={styles.sectionIcon}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Báo cáo dự án
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.dashboardCard, { backgroundColor: theme.card }]}
          onPress={() => navigation.navigate('FinancialDashboard')}
        >
          <Ionicons
            name="stats-chart"
            size={24}
            color="#4CAF50"
            style={styles.cardIcon}
          />
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Báo cáo Tài chính
            </Text>
            <Text
              style={[styles.cardDescription, { color: theme.textSecondary }]}
            >
              Xem doanh thu, chi phí và lợi nhuận
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dashboardCard, { backgroundColor: theme.card }]}
          onPress={() => navigation.navigate('TotalSalaryReport')}
        >
          <Ionicons
            name="wallet-outline"
            size={24}
            color="#FF9500"
            style={styles.cardIcon}
          />
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Báo cáo tổng lương
            </Text>
            <Text
              style={[styles.cardDescription, { color: theme.textSecondary }]}
            >
              Xem tổng lương phải trả cho nhân viên
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons
            name="people"
            size={22}
            color="#FF9500"
            style={styles.sectionIcon}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Quản lý nhân sự
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.dashboardCard, { backgroundColor: theme.card }]}
          onPress={() => navigation.navigate('Attendance')}
        >
          <Ionicons
            name="people"
            size={24}
            color="#FF9500"
            style={styles.cardIcon}
          />
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Chấm công
            </Text>
            <Text
              style={[styles.cardDescription, { color: theme.textSecondary }]}
            >
              Quản lý chấm công và tăng ca
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dashboardCard, { backgroundColor: theme.card }]}
          onPress={() => navigation.navigate('UserManagement')}
        >
          <Ionicons
            name="person-add"
            size={24}
            color="#FF2D55"
            style={styles.cardIcon}
          />
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Quản lý người dùng
            </Text>
            <Text
              style={[styles.cardDescription, { color: theme.textSecondary }]}
            >
              Thêm và phân quyền người dùng
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  debtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  debtButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
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
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  proposalsContainer: {
    borderWidth: 1,
    borderRadius: 8,
    height: 220, // Chiều cao cố định
    marginBottom: 8,
  },
  proposalsList: {
    flex: 1,
  },
  proposalItem: {
    flexDirection: 'row',
    alignItems: 'center', // Changed from flex-start to center
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  proposalIconContainer: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proposalContent: {
    flex: 1,
    marginRight: 8, // Add margin to prevent text touching the arrow
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  proposalCode: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  projectName: {
    fontSize: 13,
    marginTop: 2,
  },
  requiredDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  moreButton: {
    padding: 12,
    alignItems: 'center',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  moreButtonText: {
    fontWeight: '500',
  },
  emptyState: {
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  loader: {
    padding: 24,
  },
  dashboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  cardIcon: {
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
  },
});

export default DirectorDashboardScreen;
