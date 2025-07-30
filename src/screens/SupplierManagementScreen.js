// src/screens/SupplierManagementScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAllSuppliers,
  deleteSupplier,
  searchSuppliers,
} from '../api/supplierService';
import { useAuth } from '../contexts/AuthContext';

const SupplierManagementScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);

  // Lấy danh sách nhà cung cấp
  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllSuppliers();
      setSuppliers(data);
      setFilteredSuppliers(data);

      // Trích xuất danh sách các danh mục từ nhà cung cấp
      const allCategories = new Set();
      data.forEach((supplier) => {
        if (supplier.categories && Array.isArray(supplier.categories)) {
          supplier.categories.forEach((category) =>
            allCategories.add(category)
          );
        }
      });
      setCategories(Array.from(allCategories));
    } catch (error) {
      console.error('Lỗi khi tải danh sách nhà cung cấp:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách nhà cung cấp');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Tải lại danh sách khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      loadSuppliers();
    }, [loadSuppliers])
  );

  // Xử lý tìm kiếm
  const handleSearch = async (text) => {
    setSearchQuery(text);

    if (!text.trim()) {
      setFilteredSuppliers(suppliers);
      return;
    }

    try {
      const results = await searchSuppliers(text);
      setFilteredSuppliers(results);
    } catch (error) {
      console.error('Lỗi khi tìm kiếm:', error);
    }
  };

  // Xử lý refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadSuppliers();
  };

  // Xử lý xóa nhà cung cấp
  const handleDeleteSupplier = (supplier) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa nhà cung cấp "${supplier.name}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSupplier(supplier.id);
              Alert.alert('Thành công', 'Đã xóa nhà cung cấp');
              loadSuppliers();
            } catch (error) {
              console.error('Lỗi khi xóa nhà cung cấp:', error);
              Alert.alert('Lỗi', 'Không thể xóa nhà cung cấp');
            }
          },
        },
      ]
    );
  };

  // Xử lý lọc theo danh mục
  const handleFilterByCategory = (category) => {
    setSelectedCategory(category);
    setShowFilterModal(false);

    if (!category) {
      setFilteredSuppliers(suppliers);
      return;
    }

    const filtered = suppliers.filter(
      (supplier) =>
        supplier.categories &&
        Array.isArray(supplier.categories) &&
        supplier.categories.includes(category)
    );

    setFilteredSuppliers(filtered);
  };

  // Hiển thị item nhà cung cấp
  const renderSupplierItem = ({ item }) => (
    <TouchableOpacity
      style={styles.supplierCard}
      onPress={() =>
        navigation.navigate('SupplierDetail', { supplierId: item.id })
      }
    >
      <View style={styles.supplierHeader}>
        <Text style={styles.supplierName}>{item.name}</Text>
        {item.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.verifiedText}>Đã xác minh</Text>
          </View>
        )}
      </View>

      <View style={styles.supplierInfo}>
        {item.contactName && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.contactName}</Text>
          </View>
        )}

        {item.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.phone}</Text>
          </View>
        )}

        {item.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.email}</Text>
          </View>
        )}

        {item.address && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        )}
      </View>

      {item.categories && item.categories.length > 0 && (
        <View style={styles.categoriesContainer}>
          {item.categories.map((category, index) => (
            <View key={index} style={styles.categoryTag}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.supplierActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate('EditSupplier', { supplier: item })
          }
        >
          <Ionicons name="create-outline" size={18} color="#0066cc" />
          <Text style={[styles.actionText, { color: '#0066cc' }]}>Sửa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteSupplier(item)}
        >
          <Ionicons name="trash-outline" size={18} color="#ff3b30" />
          <Text style={[styles.actionText, { color: '#ff3b30' }]}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Hiển thị modal lọc
  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Lọc theo danh mục</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <TouchableOpacity
              style={[
                styles.categoryItem,
                !selectedCategory && styles.selectedCategoryItem,
              ]}
              onPress={() => handleFilterByCategory(null)}
            >
              <Text
                style={[
                  styles.categoryItemText,
                  !selectedCategory && styles.selectedCategoryText,
                ]}
              >
                Tất cả danh mục
              </Text>
              {!selectedCategory && (
                <Ionicons name="checkmark" size={18} color="#0066cc" />
              )}
            </TouchableOpacity>

            {categories.map((category, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.categoryItem,
                  selectedCategory === category && styles.selectedCategoryItem,
                ]}
                onPress={() => handleFilterByCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryItemText,
                    selectedCategory === category &&
                      styles.selectedCategoryText,
                  ]}
                >
                  {category}
                </Text>
                {selectedCategory === category && (
                  <Ionicons name="checkmark" size={18} color="#0066cc" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quản lý nhà cung cấp</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm nhà cung cấp..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="filter" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {selectedCategory && (
        <View style={styles.activeFilterContainer}>
          <Text style={styles.activeFilterText}>
            Đang lọc: {selectedCategory}
          </Text>
          <TouchableOpacity onPress={() => handleFilterByCategory(null)}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSuppliers}
          renderItem={renderSupplierItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Không tìm thấy nhà cung cấp nào phù hợp'
                  : 'Chưa có nhà cung cấp nào'}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddSupplier')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  filterButton: {
    backgroundColor: '#0066cc',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f2ff',
    padding: 8,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 4,
    justifyContent: 'space-between',
  },
  activeFilterText: {
    color: '#0066cc',
    fontSize: 14,
  },
  listContainer: {
    padding: 12,
  },
  supplierCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  supplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 16,
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
  supplierInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
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
  supplierActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 16,
    maxHeight: 300,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedCategoryItem: {
    backgroundColor: '#e6f2ff',
  },
  categoryItemText: {
    fontSize: 14,
    color: '#333',
  },
  selectedCategoryText: {
    color: '#0066cc',
    fontWeight: '500',
  },
});

export default SupplierManagementScreen;
