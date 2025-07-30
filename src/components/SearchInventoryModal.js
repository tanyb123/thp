import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Searchbar, ActivityIndicator, Divider } from 'react-native-paper';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const SearchInventoryModal = ({ visible, onClose, onSelect }) => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      fetchInventory();
    }
  }, [visible]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(fetchedItems);
      setFilteredItems(fetchedItems);
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu kho:', error);
    } finally {
      setLoading(false);
    }
  };

  const onChangeSearch = (query) => {
    setSearchQuery(query);
    if (query) {
      const normalizedQuery = query.toLowerCase().trim();
      const filtered = items.filter(
        (item) =>
          item.name?.toLowerCase().includes(normalizedQuery) ||
          item.code?.toLowerCase().includes(normalizedQuery)
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  };

  const handleSelect = (item) => {
    onSelect(item);
    onClose();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleSelect(item)}>
      <View style={styles.itemContainer}>
        <View>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemCode}>Mã: {item.code}</Text>
        </View>
        <Text style={styles.itemStock}>
          Tồn kho: {item.stockQuantity} {item.unit}
        </Text>
      </View>
      <Divider />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Tìm và chọn vật tư trong kho</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Đóng</Text>
          </TouchableOpacity>
        </View>
        <Searchbar
          placeholder="Tìm theo tên hoặc mã..."
          onChangeText={onChangeSearch}
          value={searchQuery}
          style={styles.searchbar}
        />
        {loading ? (
          <ActivityIndicator animating={true} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={() => (
              <Text style={styles.emptyText}>Không tìm thấy vật tư.</Text>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
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
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  searchbar: {
    margin: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemCode: {
    fontSize: 12,
    color: '#666',
  },
  itemStock: {
    fontSize: 14,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
  },
});

export default SearchInventoryModal;
