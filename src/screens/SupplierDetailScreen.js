// src/screens/SupplierDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getSupplierById,
  deleteSupplier,
  addSupplierRating,
} from '../api/supplierService';
import { useAuth } from '../contexts/AuthContext';

const SupplierDetailScreen = ({ route, navigation }) => {
  const { supplierId } = route.params;
  const { currentUser } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);

  useEffect(() => {
    const loadSupplierData = async () => {
      try {
        const data = await getSupplierById(supplierId);
        setSupplier(data);
      } catch (error) {
        console.error('Lỗi khi tải thông tin nhà cung cấp:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin nhà cung cấp');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadSupplierData();
  }, [supplierId, navigation]);

  const handleCall = () => {
    if (!supplier?.phone) return;

    Linking.openURL(`tel:${supplier.phone}`);
  };

  const handleEmail = () => {
    if (!supplier?.email) return;

    Linking.openURL(`mailto:${supplier.email}`);
  };

  const handleShare = async () => {
    if (!supplier) return;

    try {
      const message = `
Thông tin nhà cung cấp:
Tên: ${supplier.name}
Liên hệ: ${supplier.contactName || 'N/A'}
SĐT: ${supplier.phone || 'N/A'}
Email: ${supplier.email || 'N/A'}
Địa chỉ: ${supplier.address || 'N/A'}
      `;

      await Share.share({
        message,
        title: `Thông tin nhà cung cấp: ${supplier.name}`,
      });
    } catch (error) {
      console.error('Lỗi khi chia sẻ:', error);
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditSupplier', { supplierId, supplier });
  };

  const handleDelete = () => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa nhà cung cấp "${supplier?.name}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSupplier(supplierId);
              Alert.alert('Thành công', 'Đã xóa nhà cung cấp');
              navigation.goBack();
            } catch (error) {
              console.error('Lỗi khi xóa nhà cung cấp:', error);
              Alert.alert('Lỗi', 'Không thể xóa nhà cung cấp');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết nhà cung cấp</Text>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.supplierHeader}>
          <View style={styles.supplierNameContainer}>
            <Text style={styles.supplierName}>{supplier?.name}</Text>
            {supplier?.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.verifiedText}>Đã xác minh</Text>
              </View>
            )}
          </View>

          {supplier?.categories && supplier.categories.length > 0 && (
            <View style={styles.categoriesContainer}>
              {supplier.categories.map((category, index) => (
                <View key={index} style={styles.categoryTag}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>

          {supplier?.contactName && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Người liên hệ:</Text>
              <Text style={styles.infoText}>{supplier.contactName}</Text>
            </View>
          )}

          {supplier?.phone && (
            <TouchableOpacity style={styles.infoRow} onPress={handleCall}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Số điện thoại:</Text>
              <Text style={[styles.infoText, styles.linkText]}>
                {supplier.phone}
              </Text>
            </TouchableOpacity>
          )}

          {supplier?.email && (
            <TouchableOpacity style={styles.infoRow} onPress={handleEmail}>
              <Ionicons name="mail-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={[styles.infoText, styles.linkText]}>
                {supplier.email}
              </Text>
            </TouchableOpacity>
          )}

          {supplier?.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Địa chỉ:</Text>
              <Text style={styles.infoText}>{supplier.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin thanh toán</Text>

          {supplier?.taxCode ? (
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Mã số thuế:</Text>
              <Text style={styles.infoText}>{supplier.taxCode}</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>Chưa có thông tin mã số thuế</Text>
          )}

          {supplier?.bankAccount && (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Tài khoản:</Text>
              <Text style={styles.infoText}>{supplier.bankAccount}</Text>
            </View>
          )}

          {supplier?.bankName && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Ngân hàng:</Text>
              <Text style={styles.infoText}>{supplier.bankName}</Text>
            </View>
          )}
        </View>

        {supplier?.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.descriptionText}>{supplier.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đánh giá</Text>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {supplier?.averageRating ? (
                <>
                  <Text style={styles.ratingValue}>
                    {supplier.averageRating.toFixed(1)}
                  </Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={
                          star <= Math.round(supplier.averageRating)
                            ? 'star'
                            : 'star-outline'
                        }
                        size={16}
                        color="#FFD700"
                      />
                    ))}
                  </View>
                  <Text style={styles.ratingCount}>
                    ({supplier.ratings?.length || 0} đánh giá)
                  </Text>
                </>
              ) : (
                <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin khác</Text>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.infoLabel}>Ngày tạo:</Text>
            <Text style={styles.infoText}>
              {supplier?.createdAt
                ? new Date(
                    supplier.createdAt.seconds * 1000
                  ).toLocaleDateString('vi-VN')
                : 'N/A'}
            </Text>
          </View>

          {supplier?.updatedAt && (
            <View style={styles.infoRow}>
              <Ionicons name="refresh-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Cập nhật:</Text>
              <Text style={styles.infoText}>
                {new Date(supplier.updatedAt.seconds * 1000).toLocaleDateString(
                  'vi-VN'
                )}
              </Text>
            </View>
          )}

          {supplier?.createdByName && (
            <View style={styles.infoRow}>
              <Ionicons name="person-add-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Người tạo:</Text>
              <Text style={styles.infoText}>{supplier.createdByName}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Chỉnh sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  supplierHeader: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  supplierNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  supplierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryText: {
    color: '#666',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    width: 100,
    color: '#666',
    fontSize: 14,
    marginLeft: 8,
  },
  infoText: {
    flex: 1,
    color: '#333',
    fontSize: 14,
  },
  linkText: {
    color: '#0066cc',
  },
  descriptionText: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  ratingContainer: {
    alignItems: 'center',
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingCount: {
    color: '#666',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  editButton: {
    backgroundColor: '#0066cc',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default SupplierDetailScreen;
