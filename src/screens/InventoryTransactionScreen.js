import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import {
  Appbar,
  Text,
  Divider,
  List,
  ActivityIndicator,
  Chip,
  Searchbar,
  Button,
  Card,
  Menu,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { firebase } from '../config/firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const InventoryTransactionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [item, setItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('start');
  const [menuVisible, setMenuVisible] = useState(false);

  // Lấy dữ liệu giao dịch khi mở màn hình
  useEffect(() => {
    fetchData();
  }, [itemId]);

  // Lấy danh sách giao dịch và thông tin vật tư
  const fetchData = async () => {
    try {
      setLoading(true);

      // Lấy thông tin chi tiết vật tư nếu có itemId
      if (itemId) {
        const itemDoc = await firebase
          .firestore()
          .collection('inventory')
          .doc(itemId)
          .get();

        if (itemDoc.exists) {
          setItem({
            id: itemDoc.id,
            ...itemDoc.data(),
          });
        }

        // Lấy giao dịch của vật tư cụ thể
        const query = firebase
          .firestore()
          .collection('inventory_transactions')
          .where('itemId', '==', itemId)
          .orderBy('date', 'desc');

        const snapshot = await query.get();
        const transactionsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setTransactions(transactionsData);
      } else {
        // Lấy tất cả giao dịch kho
        const query = firebase
          .firestore()
          .collection('inventory_transactions')
          .orderBy('date', 'desc')
          .limit(100); // Giới hạn để tránh lấy quá nhiều dữ liệu

        const snapshot = await query.get();
        const transactionsData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const data = {
              id: doc.id,
              ...doc.data(),
            };

            // Nếu không có item ở prop, lấy thông tin vật tư
            if (!data.itemName) {
              try {
                const itemDoc = await firebase
                  .firestore()
                  .collection('inventory')
                  .doc(data.itemId)
                  .get();

                if (itemDoc.exists) {
                  data.itemName = itemDoc.data().name;
                  data.itemUnit = itemDoc.data().unit;
                }
              } catch (error) {
                console.error('Lỗi khi lấy thông tin vật tư:', error);
              }
            }

            return data;
          })
        );

        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu giao dịch:', error);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý tìm kiếm
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Xử lý chọn loại giao dịch để lọc
  const handleFilterType = (type) => {
    setFilterType(type === filterType ? null : type);
  };

  // Xử lý chọn ngày bắt đầu
  const handleStartDateSelect = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setDateRange({
        ...dateRange,
        start: date,
      });
    }
  };

  // Xử lý chọn ngày kết thúc
  const handleEndDateSelect = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setDateRange({
        ...dateRange,
        end: date,
      });
    }
  };

  // Mở date picker
  const showDatePickerDialog = (mode) => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  // Xóa bộ lọc
  const clearFilters = () => {
    setFilterType(null);
    setDateRange({
      start: null,
      end: null,
    });
    setSearchQuery('');
  };

  // Lọc giao dịch
  const filteredTransactions = () => {
    let result = [...transactions];

    // Lọc theo loại
    if (filterType) {
      result = result.filter((transaction) => transaction.type === filterType);
    }

    // Lọc theo ngày bắt đầu
    if (dateRange.start) {
      const startTimestamp = firebase.firestore.Timestamp.fromDate(
        dateRange.start
      );
      result = result.filter(
        (transaction) =>
          transaction.date && transaction.date.seconds >= startTimestamp.seconds
      );
    }

    // Lọc theo ngày kết thúc
    if (dateRange.end) {
      // Thêm 1 ngày để bao gồm cả ngày được chọn
      const endDate = new Date(dateRange.end);
      endDate.setDate(endDate.getDate() + 1);
      const endTimestamp = firebase.firestore.Timestamp.fromDate(endDate);

      result = result.filter(
        (transaction) =>
          transaction.date && transaction.date.seconds < endTimestamp.seconds
      );
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchQuery) {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      result = result.filter(
        (transaction) =>
          transaction.note?.toLowerCase().includes(normalizedQuery) ||
          transaction.itemName?.toLowerCase().includes(normalizedQuery)
      );
    }

    return result;
  };

  // Format ngày giờ
  const formatDate = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate();
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render mỗi giao dịch
  const renderTransactionItem = ({ item: transaction }) => {
    const isIn = transaction.type === 'IN';
    return (
      <Card style={styles.transactionCard}>
        <Card.Content>
          <View style={styles.transactionHeader}>
            <View>
              <Text style={styles.transactionTitle}>
                {isIn ? 'Nhập kho' : 'Xuất kho'}
              </Text>
              <Text style={styles.transactionDate}>
                {formatDate(transaction.date)}
              </Text>
            </View>

            <Chip
              mode="outlined"
              style={[
                styles.transactionTypeChip,
                { borderColor: isIn ? '#4CAF50' : '#F44336' },
              ]}
              textStyle={{
                color: isIn ? '#4CAF50' : '#F44336',
                fontWeight: 'bold',
              }}
            >
              {isIn ? '+' : '-'}
              {transaction.quantity} {transaction.itemUnit || item?.unit || ''}
            </Chip>
          </View>

          {!itemId && transaction.itemName && (
            <Text style={styles.itemName}>{transaction.itemName}</Text>
          )}

          <Text style={styles.transactionNote}>{transaction.note}</Text>

          <View style={styles.transactionFooter}>
            <Text style={styles.transactionUser}>
              {transaction.userId
                ? transaction.userId.substring(0, 8)
                : 'Không xác định'}
            </Text>
            <Text style={styles.transactionStatus}>
              {transaction.status === 'COMPLETED' ? 'Hoàn thành' : 'Chờ xử lý'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={item ? `Giao dịch của ${item.name}` : 'Lịch sử giao dịch kho'}
          subtitle={item ? `Mã: ${item.code}` : ''}
        />
        <Appbar.Action icon="refresh" onPress={fetchData} />
      </Appbar.Header>

      <View style={styles.filterContainer}>
        <Searchbar
          placeholder="Tìm kiếm giao dịch..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
        />

        <View style={styles.chipRow}>
          <Chip
            selected={filterType === 'IN'}
            onPress={() => handleFilterType('IN')}
            style={styles.filterChip}
            icon="arrow-down"
          >
            Nhập kho
          </Chip>
          <Chip
            selected={filterType === 'OUT'}
            onPress={() => handleFilterType('OUT')}
            style={styles.filterChip}
            icon="arrow-up"
          >
            Xuất kho
          </Chip>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Chip
                onPress={() => setMenuVisible(true)}
                style={styles.filterChip}
                icon="calendar"
              >
                Ngày
              </Chip>
            }
          >
            <Menu.Item
              title="Chọn ngày bắt đầu"
              onPress={() => {
                setMenuVisible(false);
                showDatePickerDialog('start');
              }}
            />
            <Menu.Item
              title="Chọn ngày kết thúc"
              onPress={() => {
                setMenuVisible(false);
                showDatePickerDialog('end');
              }}
            />
            <Divider />
            <Menu.Item
              title="Xóa lọc ngày"
              onPress={() => {
                setMenuVisible(false);
                setDateRange({ start: null, end: null });
              }}
            />
          </Menu>

          {(filterType || dateRange.start || dateRange.end || searchQuery) && (
            <Chip
              onPress={clearFilters}
              style={styles.clearChip}
              icon="close-circle"
            >
              Xóa lọc
            </Chip>
          )}
        </View>

        {(dateRange.start || dateRange.end) && (
          <View style={styles.dateRangeContainer}>
            <Text style={styles.dateRangeText}>
              {dateRange.start
                ? formatDate(
                    firebase.firestore.Timestamp.fromDate(dateRange.start)
                  )
                : 'Từ đầu'}
              {' → '}
              {dateRange.end
                ? formatDate(
                    firebase.firestore.Timestamp.fromDate(dateRange.end)
                  )
                : 'đến nay'}
            </Text>
          </View>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={
            datePickerMode === 'start'
              ? dateRange.start || new Date()
              : dateRange.end || new Date()
          }
          mode="date"
          display="default"
          onChange={
            datePickerMode === 'start'
              ? handleStartDateSelect
              : handleEndDateSelect
          }
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 16 }}>Đang tải dữ liệu giao dịch...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions()}
          keyExtractor={(item) => item.id}
          renderItem={renderTransactionItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>
                {searchQuery || filterType || dateRange.start || dateRange.end
                  ? 'Không tìm thấy giao dịch nào khớp với điều kiện lọc'
                  : 'Chưa có giao dịch nào'}
              </Text>
              {(searchQuery ||
                filterType ||
                dateRange.start ||
                dateRange.end) && (
                <Button
                  mode="outlined"
                  onPress={clearFilters}
                  style={{ marginTop: 16 }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  searchBar: {
    marginBottom: 12,
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  clearChip: {
    backgroundColor: '#e57373',
    marginRight: 8,
    marginBottom: 8,
  },
  dateRangeContainer: {
    marginTop: 8,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
  },
  dateRangeText: {
    fontStyle: 'italic',
    color: '#666',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 50,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  transactionCard: {
    marginBottom: 12,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  transactionTypeChip: {
    minWidth: 80,
    justifyContent: 'center',
  },
  itemName: {
    fontWeight: '500',
    marginTop: 8,
    color: '#3f51b5',
  },
  transactionNote: {
    marginTop: 8,
    marginBottom: 8,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  transactionUser: {
    fontSize: 12,
    color: '#666',
  },
  transactionStatus: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4CAF50',
  },
});

export default InventoryTransactionScreen;
