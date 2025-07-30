import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllSuppliers } from '../api/supplierService';

const SupplierPickerModal = ({ visible, onClose, onSelect }) => {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) {
      fetchSuppliers();
    }
  }, [visible]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getAllSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Load suppliers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => {
        onSelect(item);
        onClose();
      }}
    >
      <Text style={styles.name}>{item.name}</Text>
      {item.address ? <Text style={styles.sub}>{item.address}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Chọn nhà cung cấp</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#0066cc" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 6, marginLeft: 6 },
  item: { paddingVertical: 10 },
  name: { fontSize: 16, fontWeight: '500', color: '#333' },
  sub: { fontSize: 12, color: '#666', marginTop: 2 },
  separator: { height: 1, backgroundColor: '#eee' },
});

export default SupplierPickerModal;
