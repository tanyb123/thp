//src/screens/CustomerDetailScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCustomerById, deleteCustomer } from '../api/customerService';
import { getProjects } from '../api/projectService';
import { useFocusEffect } from '@react-navigation/native';

const CustomerDetailScreen = ({ route, navigation }) => {
  const { customerId } = route.params;
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customerProjects, setCustomerProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Hàm lấy dữ liệu khách hàng
  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomerById(customerId);

      if (data) {
        setCustomer(data);
      } else {
        setError('Không tìm thấy thông tin khách hàng');
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin khách hàng:', err);
      setError('Không thể tải thông tin khách hàng. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // Hàm lấy danh sách dự án của khách hàng
  const fetchCustomerProjects = async () => {
    try {
      setLoadingProjects(true);
      const allProjects = await getProjects();

      // Lọc dự án theo customerId
      const projects = allProjects.filter(
        (project) =>
          project.customerId === customerId ||
          project.customerName === customer?.name
      );

      setCustomerProjects(projects);
      console.log(
        `Tìm thấy ${projects.length} dự án cho khách hàng ${customer?.name}`
      );
    } catch (err) {
      console.error('Lỗi khi tải dự án của khách hàng:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Lấy dữ liệu khách hàng khi màn hình được tải
  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  // Lấy dự án khi có thông tin khách hàng
  useEffect(() => {
    if (customer) {
      fetchCustomerProjects();
    }
  }, [customer]);

  // Làm mới dữ liệu khi màn hình được focus (quay lại sau khi chỉnh sửa)
  useFocusEffect(
    useCallback(() => {
      fetchCustomerData();
    }, [customerId])
  );

  // Lấy nhãn hiển thị cho loại khách hàng
  const getTypeLabel = (type) => {
    switch (type) {
      case 'vip':
        return 'VIP';
      case 'potential':
        return 'Tiềm năng';
      case 'regular':
        return 'Thường xuyên';
      default:
        return type || 'Chưa phân loại';
    }
  };

  // Lấy màu cho loại khách hàng
  const getTypeColor = (type) => {
    switch (type) {
      case 'vip':
        return '#4CAF50'; // xanh lá
      case 'potential':
        return '#FF9800'; // cam
      default:
        return '#9E9E9E'; // xám
    }
  };

  // Lấy màu cho trạng thái dự án
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#4CAF50'; // xanh lá
      case 'in_progress':
        return '#FF9800'; // cam
      case 'pending':
        return '#2196F3'; // xanh dương
      case 'cancelled':
        return '#F44336'; // đỏ
      default:
        return '#9E9E9E'; // xám
    }
  };

  // Lấy nhãn trạng thái dự án
  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Hoàn thành';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'pending':
        return 'Chờ xử lý';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status || 'Chưa xác định';
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa có';
    if (timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return new Date(timestamp).toLocaleDateString('vi-VN');
  };

  // Render project item
  const renderProjectItem = ({ item }) => (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() =>
        navigation.navigate('ProjectDetail', { projectId: item.id })
      }
    >
      <View style={styles.projectHeader}>
        <Text style={styles.projectName} numberOfLines={2}>
          {item.name || 'Dự án không tên'}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.projectDetails}>
        <View style={styles.projectDetailRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.projectDetailText}>
            {formatDate(item.createdAt)}
          </Text>
        </View>

        {item.budget && (
          <View style={styles.projectDetailRow}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.projectDetailText}>
              Ngân sách: {formatCurrency(item.budget)}
            </Text>
          </View>
        )}

        {item.description && (
          <View style={styles.projectDetailRow}>
            <Ionicons name="document-text-outline" size={16} color="#666" />
            <Text style={styles.projectDetailText} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.projectFooter}>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  // Xử lý chia sẻ thông tin khách hàng
  const handleShare = async () => {
    if (!customer) return;

    try {
      const message = `
Thông tin khách hàng:
Tên: ${customer.name || 'Không có'}
Người liên hệ: ${customer.contactPerson || 'Không có'}
Điện thoại: ${customer.phone || 'Không có'}
Email: ${customer.email || 'Không có'}
Địa chỉ: ${customer.address || 'Không có'}
Loại khách hàng: ${getTypeLabel(customer.type)}
Số dự án: ${customerProjects.length}
      `;

      await Share.share({
        message,
        title: `Thông tin khách hàng: ${customer.name}`,
      });
    } catch (error) {
      console.error('Lỗi khi chia sẻ:', error);
    }
  };

  // Xử lý chỉnh sửa khách hàng
  const handleEdit = () => {
    navigation.navigate('EditCustomer', { customer });
  };

  // Xử lý xóa khách hàng
  const handleDelete = () => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa khách hàng này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteCustomer(customer.id);
              Alert.alert('Thành công', 'Đã xóa khách hàng thành công', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              if (error.code === 'permission-denied') {
                Alert.alert(
                  'Lỗi quyền',
                  'Bạn không có đủ quyền để thực hiện hành động này.'
                );
              } else {
                console.error('Lỗi khi xóa khách hàng:', error);
                Alert.alert(
                  'Lỗi',
                  'Không thể xóa khách hàng. Vui lòng thử lại sau.'
                );
              }
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Hiển thị khi đang tải dữ liệu
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Đang tải thông tin khách hàng...</Text>
      </View>
    );
  }

  // Hiển thị khi có lỗi
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Hiển thị khi không tìm thấy khách hàng
  if (!customer) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-outline" size={50} color="#999" />
        <Text style={styles.errorText}>
          Không tìm thấy thông tin khách hàng
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết khách hàng</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentContainer}>
        <View style={styles.customerHeader}>
          <View style={styles.customerNameContainer}>
            <Text style={styles.customerName}>
              {customer.name || 'Chưa có tên'}
            </Text>
            <View
              style={[
                styles.customerTypeTag,
                { borderColor: getTypeColor(customer.type) },
              ]}
            >
              <Text
                style={[
                  styles.customerTypeText,
                  { color: getTypeColor(customer.type) },
                ]}
              >
                {getTypeLabel(customer.type)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Người liên hệ</Text>
            <Text style={styles.infoValue}>
              {customer.contactPerson || 'Chưa có thông tin'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Số điện thoại</Text>
            <View style={styles.infoValueWithIcon}>
              <Text style={styles.infoValue}>
                {customer.phone || 'Chưa có thông tin'}
              </Text>
              {customer.phone && (
                <TouchableOpacity style={styles.actionIcon}>
                  <Ionicons name="call-outline" size={20} color="#0066cc" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <View style={styles.infoValueWithIcon}>
              <Text style={styles.infoValue}>
                {customer.email || 'Chưa có thông tin'}
              </Text>
              {customer.email && (
                <TouchableOpacity style={styles.actionIcon}>
                  <Ionicons name="mail-outline" size={20} color="#0066cc" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Địa chỉ</Text>
            <Text style={styles.infoValue}>
              {customer.address || 'Chưa có thông tin'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Mã số thuế</Text>
            <Text style={styles.infoValue}>
              {customer.taxCode || 'Chưa có thông tin'}
            </Text>
          </View>
        </View>

        <View style={styles.metaSection}>
          <Text style={styles.metaSectionTitle}>Thông tin bổ sung</Text>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Ngày tạo</Text>
            <Text style={styles.metaValue}>
              {formatDate(customer.createdAt)}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Cập nhật lần cuối</Text>
            <Text style={styles.metaValue}>
              {formatDate(customer.updatedAt)}
            </Text>
          </View>
        </View>

        {/* Section dự án của khách hàng */}
        <View style={styles.projectSection}>
          <View style={styles.projectSectionHeader}>
            <Text style={styles.projectSectionTitle}>
              Dự án đã gia công ({customerProjects.length})
            </Text>
            {loadingProjects && (
              <ActivityIndicator size="small" color="#0066cc" />
            )}
          </View>

          {customerProjects.length > 0 ? (
            <FlatList
              data={customerProjects}
              renderItem={renderProjectItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.projectList}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false} // Disable scroll for nested FlatList
            />
          ) : !loadingProjects ? (
            <View style={styles.emptyProjects}>
              <Ionicons name="folder-open-outline" size={48} color="#ccc" />
              <Text style={styles.emptyProjectsText}>
                Chưa có dự án nào được gia công
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>Xóa</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  shareButton: {
    padding: 4,
  },
  contentContainer: {
    flex: 1,
  },
  customerHeader: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  customerNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  customerTypeTag: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  customerTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  infoValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionIcon: {
    padding: 4,
  },
  metaSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 20,
  },
  metaSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 14,
    color: '#666',
  },
  metaValue: {
    fontSize: 14,
    color: '#333',
  },
  projectSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 20,
  },
  projectSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  projectList: {
    paddingBottom: 20,
  },
  projectCard: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e0e0e0',
  },
  projectName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  projectDetails: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  projectDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  projectFooter: {
    padding: 12,
    alignItems: 'flex-end',
  },
  footer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    flex: 3,
    marginLeft: 10,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    flex: 1,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  projectSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyProjects: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyProjectsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default CustomerDetailScreen;
