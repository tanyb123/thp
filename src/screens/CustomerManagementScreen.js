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
import { getCustomers } from '../api/customerService';

// Component hiển thị từng khách hàng trong danh sách
const CustomerListItem = ({ customer, onPress }) => {
  // Xác định loại khách hàng để hiển thị màu sắc phù hợp
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

  return (
    <Pressable
      style={({ pressed }) => [
        styles.customerCard,
        pressed && styles.cardPressed
      ]}
      onPress={() => onPress(customer)}
    >
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{customer.name || 'Chưa có tên'}</Text>
        
        <View style={styles.contactRow}>
          <Ionicons name="person-outline" size={14} color="#666" />
          <Text style={styles.contactText}>
            {customer.contactPerson || 'Chưa có người liên hệ'}
          </Text>
        </View>
        
        {customer.email && (
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={14} color="#666" />
            <Text style={styles.contactText}>{customer.email}</Text>
          </View>
        )}
        
        {customer.phone && (
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={14} color="#666" />
            <Text style={styles.contactText}>{customer.phone}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.customerTypeContainer}>
        <View 
          style={[
            styles.customerTypeTag, 
            { borderColor: getTypeColor(customer.type) }
          ]}
        >
          <Text 
            style={[
              styles.customerTypeText, 
              { color: getTypeColor(customer.type) }
            ]}
          >
            {getTypeLabel(customer.type)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const CustomerManagementScreen = ({ navigation }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  // Hàm tải danh sách khách hàng
  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomers();
      
      // Thêm animation khi cập nhật danh sách
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      setCustomers(data);
      setFilteredCustomers(data); // Khởi tạo danh sách lọc ban đầu
    } catch (err) {
      console.error('Lỗi khi tải danh sách khách hàng:', err);
      setError('Không thể tải danh sách khách hàng. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Tải dữ liệu khi màn hình được mở
  useEffect(() => {
    loadCustomers();
    
    // Thêm listener để làm mới danh sách khi quay lại từ màn hình khác
    const unsubscribe = navigation.addListener('focus', () => {
      loadCustomers();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Lọc danh sách khách hàng theo từ khóa tìm kiếm
  useEffect(() => {
    if (!searchQuery.trim()) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFilteredCustomers(customers);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = customers.filter(customer => {
      const name = (customer.name || '').toLowerCase();
      const contactPerson = (customer.contactPerson || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      
      return (
        name.includes(query) || 
        contactPerson.includes(query) || 
        email.includes(query) || 
        phone.includes(query)
      );
    });
    
    // Thêm animation khi cập nhật kết quả tìm kiếm
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    setFilteredCustomers(filtered);
  }, [searchQuery, customers]);

  // Xử lý khi người dùng kéo để làm mới
  const handleRefresh = () => {
    setRefreshing(true);
    loadCustomers();
  };

  // Xử lý khi người dùng nhấn vào một khách hàng
  const handleCustomerPress = (customer) => {
    navigation.navigate('CustomerDetail', { customerId: customer.id });
  };

  // Xử lý khi người dùng muốn thêm khách hàng mới
  const handleAddCustomer = () => {
    navigation.navigate('AddCustomer');
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
        <Text style={styles.loadingText}>Đang tải danh sách khách hàng...</Text>
      </View>
    );
  }

  // Hiển thị khi có lỗi
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadCustomers}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Hiển thị khi không có khách hàng
  if (customers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quản lý Khách hàng</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddCustomer}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={60} color="#CCCCCC" />
          <Text style={styles.emptyText}>Chưa có khách hàng nào</Text>
          <TouchableOpacity style={styles.addCustomerButton} onPress={handleAddCustomer}>
            <Text style={styles.addCustomerButtonText}>Thêm khách hàng mới</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Hiển thị danh sách khách hàng
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quản lý Khách hàng</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddCustomer}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm khách hàng..."
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        {searchQuery ? (
          <Text style={styles.resultCount}>
            {filteredCustomers.length} kết quả
          </Text>
        ) : null}
      </View>
      
      {filteredCustomers.length === 0 && searchQuery ? (
        <View style={styles.emptyResultContainer}>
          <Ionicons name="search-outline" size={50} color="#CCCCCC" />
          <Text style={styles.emptyResultText}>
            Không tìm thấy khách hàng phù hợp
          </Text>
          <TouchableOpacity onPress={handleClearSearch} style={styles.tryAgainButton}>
            <Text style={styles.tryAgainButtonText}>Xóa tìm kiếm</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CustomerListItem customer={item} onPress={handleCustomerPress} />
          )}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          ListEmptyComponent={
            !searchQuery ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={60} color="#CCCCCC" />
                <Text style={styles.emptyText}>Chưa có khách hàng nào</Text>
                <TouchableOpacity style={styles.addCustomerButton} onPress={handleAddCustomer}>
                  <Text style={styles.addCustomerButtonText}>Thêm khách hàng mới</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#0066cc',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
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
    padding: 6,
  },
  resultCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 4,
  },
  listContainer: {
    flexGrow: 1,
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: '#f9f9f9',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  customerTypeContainer: {
    marginLeft: 12,
  },
  customerTypeTag: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  customerTypeText: {
    fontSize: 12,
    fontWeight: '500',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  addCustomerButton: {
    marginTop: 16,
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  addCustomerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyResultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyResultText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  tryAgainButton: {
    marginTop: 16,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  tryAgainButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CustomerManagementScreen; 