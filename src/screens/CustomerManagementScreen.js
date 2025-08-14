//src/screens/CustomerManagementScreen.js
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCustomers } from '../api/customerService';
import { useTheme } from '../contexts/ThemeContext';
import CustomerAddModal from '../components/CustomerAddModal';

// Component hiển thị từng khách hàng trong danh sách
const CustomerListItem = ({ customer, onPress }) => {
  const { theme } = useTheme();
  // Xác định loại khách hàng để hiển thị màu sắc phù hợp
  const getTypeColor = (type) => {
    switch (type) {
      case 'vip':
        return '#4CAF50'; // xanh lá
      case 'potential':
        return '#FF9800'; // cam
      default:
        return theme.textMuted; // Sử dụng màu từ theme
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
        { backgroundColor: theme.card },
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(customer)}
    >
      <View style={styles.customerInfo}>
        <Text style={[styles.customerName, { color: theme.text }]}>
          {customer.name || 'Chưa có tên'}
        </Text>

        <View style={styles.contactRow}>
          <Ionicons
            name="person-outline"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={[styles.contactText, { color: theme.textSecondary }]}>
            {customer.contactPerson || 'Chưa có người liên hệ'}
          </Text>
        </View>

        {customer.email && (
          <View style={styles.contactRow}>
            <Ionicons
              name="mail-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.contactText, { color: theme.textSecondary }]}>
              {customer.email}
            </Text>
          </View>
        )}

        {customer.phone && (
          <View style={styles.contactRow}>
            <Ionicons
              name="call-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.contactText, { color: theme.textSecondary }]}>
              {customer.phone}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.customerTypeContainer}>
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
    </Pressable>
  );
};

const CustomerManagementScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

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
    const filtered = customers.filter((customer) => {
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
    setShowAddModal(true);
  };

  const handleManualAdd = () => {
    navigation.navigate('AddCustomer');
  };

  const handleImportExcel = () => {
    navigation.navigate('CustomerImport');
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
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Đang tải danh sách khách hàng...
        </Text>
      </View>
    );
  }

  // Hiển thị khi có lỗi
  if (error) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <Ionicons name="alert-circle-outline" size={50} color={theme.danger} />
        <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={loadCustomers}
        >
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Hiển thị khi không có khách hàng
  if (customers.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Quản lý Khách hàng
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={handleAddCustomer}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.centerContainer,
            { backgroundColor: theme.background },
          ]}
        >
          <Ionicons name="people-outline" size={60} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Chưa có khách hàng nào
          </Text>
          <TouchableOpacity
            style={[
              styles.addCustomerButton,
              { backgroundColor: theme.primary },
            ]}
            onPress={handleAddCustomer}
          >
            <Text style={styles.addCustomerButtonText}>
              Thêm khách hàng mới
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Hiển thị danh sách khách hàng
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Quản lý Khách hàng
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.importButton, { borderColor: theme.border }]}
            onPress={() => navigation.navigate('CustomerImport')}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={theme.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={handleAddCustomer}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons
          name="search"
          size={20}
          color={theme.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Tìm kiếm khách hàng..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch}>
            <Ionicons name="close-circle" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {filteredCustomers.length === 0 && searchQuery ? (
        <View style={styles.emptyResultContainer}>
          <Ionicons name="search-outline" size={50} color="#CCCCCC" />
          <Text style={styles.emptyResultText}>
            Không tìm thấy khách hàng phù hợp
          </Text>
          <TouchableOpacity
            onPress={handleClearSearch}
            style={styles.tryAgainButton}
          >
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
                <TouchableOpacity
                  style={styles.addCustomerButton}
                  onPress={handleAddCustomer}
                >
                  <Text style={styles.addCustomerButtonText}>
                    Thêm khách hàng mới
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* Add Customer Modal */}
      <CustomerAddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onManualAdd={handleManualAdd}
        onImportExcel={handleImportExcel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  customerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  customerInfo: {
    flex: 1,
    marginRight: 10,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactText: {
    marginLeft: 6,
    fontSize: 14,
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
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
