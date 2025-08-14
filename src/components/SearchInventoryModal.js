import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

export const SearchInventoryModal = ({ visible, onClose, onSelect }) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const db = getFirestore();

  // Load inventory items when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadInventoryItems();
    }
  }, [visible]);

  // Filter items when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(items);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.code && item.code.toLowerCase().includes(query)) ||
          (item.material && item.material.toLowerCase().includes(query))
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, items]);

  // Load inventory items from Firestore
  const loadInventoryItems = async () => {
    setLoading(true);
    try {
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef, orderBy('name'), limit(100));

      const snapshot = await getDocs(q);
      const inventoryItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setItems(inventoryItems);
      setFilteredItems(inventoryItems);
    } catch (error) {
      console.error('Error loading inventory items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0 đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Render inventory item
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { backgroundColor: theme.cardBackground }]}
      onPress={() => onSelect(item)}
    >
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: theme.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.itemCode, { color: theme.textSecondary }]}>
          Mã: {item.code}
        </Text>
        {item.material && (
          <Text style={[styles.itemDetail, { color: theme.textSecondary }]}>
            {item.material} {item.weight ? `- ${item.weight} kg` : ''}
          </Text>
        )}
      </View>
      <View style={styles.itemStats}>
        <Text style={[styles.itemPrice, { color: theme.text }]}>
          {formatCurrency(item.price)}
        </Text>
        <Text style={[styles.itemStock, { color: theme.textSecondary }]}>
          Tồn: {item.stockQuantity} {item.unit}
        </Text>
      </View>
      <View style={styles.iconContainer}>
        <Ionicons name="add-circle" size={24} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>
              Chọn vật tư
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View
            style={[
              styles.searchContainer,
              { backgroundColor: theme.inputBackground },
            ]}
          >
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Tìm tên, mã hoặc vật liệu"
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text
                style={[styles.loadingText, { color: theme.textSecondary }]}
              >
                Đang tải vật tư...
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={[styles.resultCount, { color: theme.textSecondary }]}
              >
                {filteredItems.length} vật tư
              </Text>

              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: theme.border },
                    ]}
                  />
                )}
                ListEmptyComponent={() => (
                  <View style={styles.emptyContainer}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={48}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[styles.emptyText, { color: theme.textSecondary }]}
                    >
                      {searchQuery
                        ? 'Không tìm thấy vật tư phù hợp'
                        : 'Chưa có vật tư nào trong kho'}
                    </Text>
                  </View>
                )}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    height: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
    fontSize: 16,
  },
  resultCount: {
    marginBottom: 8,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  itemInfo: {
    flex: 2,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 14,
    marginBottom: 2,
  },
  itemDetail: {
    fontSize: 14,
  },
  itemStats: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  itemStock: {
    fontSize: 12,
  },
  iconContainer: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    marginVertical: 4,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SearchInventoryModal;
