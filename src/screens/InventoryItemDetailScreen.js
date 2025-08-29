import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  List,
  Divider,
  FAB,
  ActivityIndicator,
  Dialog,
  Portal,
  TextInput,
  HelperText,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useInventory from '../hooks/useInventory';
import { firebase } from '../config/firebaseConfig';
import StatusIndicator from '../components/StatusIndicator';

const InventoryItemDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params || {};

  const { getInventoryItemDetail } = useInventory();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [itemDetail, setItemDetail] = useState(null);
  const [transactionDialogVisible, setTransactionDialogVisible] =
    useState(false);
  const [transactionType, setTransactionType] = useState('IN');
  const [transactionData, setTransactionData] = useState({
    quantity: '1',
    note: '',
  });
  const [transactionErrors, setTransactionErrors] = useState({});
  const [processingTransaction, setProcessingTransaction] = useState(false);

  useEffect(() => {
    if (itemId) {
      fetchItemDetail();
    } else {
      setError('Không tìm thấy ID vật tư');
      setLoading(false);
    }
  }, [itemId]);

  const fetchItemDetail = async () => {
    try {
      setLoading(true);
      const detail = await getInventoryItemDetail(itemId);
      setItemDetail(detail);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin vật tư:', error);
      setError('Không thể lấy thông tin vật tư');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = () => {
    if (!itemDetail || !itemDetail.minQuantity) return 'normal';

    if (itemDetail.stockQuantity <= 0) {
      return 'critical';
    } else if (itemDetail.stockQuantity <= itemDetail.minQuantity) {
      return 'warning';
    } else {
      return 'normal';
    }
  };

  const renderStockStatus = () => {
    if (!itemDetail) return null;

    const status = getStockStatus();
    let statusText = 'Bình thường';

    if (status === 'critical') {
      statusText = 'Hết hàng';
    } else if (status === 'warning') {
      statusText = 'Dưới mức tối thiểu';
    }

    return <StatusIndicator status={status} text={statusText} />;
  };

  const openTransactionDialog = (type) => {
    setTransactionType(type);
    setTransactionData({
      quantity: '1',
      note: type === 'IN' ? 'Nhập kho' : 'Xuất kho',
    });
    setTransactionErrors({});
    setTransactionDialogVisible(true);
  };

  const handleTransactionChange = (field, value) => {
    setTransactionData({
      ...transactionData,
      [field]: value,
    });

    if (transactionErrors[field]) {
      setTransactionErrors({
        ...transactionErrors,
        [field]: null,
      });
    }
  };

  const validateTransactionForm = () => {
    const newErrors = {};
    const quantity = parseFloat(transactionData.quantity);

    if (isNaN(quantity) || quantity <= 0) {
      newErrors.quantity = 'Số lượng phải lớn hơn 0';
    }

    if (transactionType === 'OUT' && quantity > itemDetail.stockQuantity) {
      newErrors.quantity = 'Số lượng xuất vượt quá tồn kho';
    }

    if (!transactionData.note.trim()) {
      newErrors.note = 'Vui lòng nhập ghi chú';
    }

    setTransactionErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTransaction = async () => {
    if (!validateTransactionForm()) return;

    setProcessingTransaction(true);

    try {
      const db = firebase.firestore();
      const user = firebase.auth().currentUser;

      if (!user) {
        throw new Error('Bạn cần đăng nhập để thực hiện giao dịch');
      }

      const quantity = parseFloat(transactionData.quantity);
      const transaction = {
        type: transactionType,
        itemId,
        quantity,
        date: firebase.firestore.Timestamp.now(),
        note: transactionData.note,
        userId: user.uid,
        status: 'COMPLETED',
      };

      let newQuantity = itemDetail.stockQuantity;
      if (transactionType === 'IN') {
        newQuantity += quantity;
      } else if (transactionType === 'OUT') {
        newQuantity -= quantity;
      }

      await db.runTransaction(async (transaction) => {
        const transactionRef = db.collection('inventory_transactions').doc();
        transaction.set(transactionRef, transaction);

        const itemRef = db.collection('inventory').doc(itemId);
        transaction.update(itemRef, {
          stockQuantity: newQuantity,
          lastUpdated: firebase.firestore.Timestamp.now(),
        });
      });

      setTransactionDialogVisible(false);
      Alert.alert(
        'Thành công',
        `Đã ${transactionType === 'IN' ? 'nhập' : 'xuất'} ${quantity} ${
          itemDetail.unit
        }`,
        [{ text: 'OK' }]
      );

      await fetchItemDetail();
    } catch (error) {
      console.error('Lỗi khi thực hiện giao dịch:', error);
      Alert.alert('Lỗi', error.message || 'Không thể thực hiện giao dịch');
    } finally {
      setProcessingTransaction(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditInventoryItem', { itemId, item: itemDetail });
  };

  const handleAddToQuotation = () => {
    navigation.navigate('QuotationScreen', {
      screen: 'CreateQuotation',
      params: { selectedItem: itemDetail },
    });
  };

  const formatTimestamp = (timestamp) => {
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Đang tải thông tin vật tư...</Text>
      </View>
    );
  }

  if (error || !itemDetail) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>
          {error || 'Không tìm thấy thông tin vật tư'}
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        >
          Quay lại
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ĐÃ BỎ Appbar.Header để tránh trùng header với navigator */}

      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            {itemDetail.imageUrl ? (
              <Image
                source={{ uri: itemDetail.imageUrl }}
                style={styles.itemImage}
                resizeMode="contain"
              />
            ) : null}

            <View style={styles.header}>
              <View>
                <Text style={styles.itemName}>{itemDetail.name}</Text>
                <Text style={styles.itemCode}>Mã: {itemDetail.code}</Text>
              </View>
              {renderStockStatus()}
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tồn kho:</Text>
                <Text style={styles.detailValue}>
                  {itemDetail.stockQuantity} {itemDetail.unit}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tồn tối thiểu:</Text>
                <Text style={styles.detailValue}>
                  {itemDetail.minQuantity || 0} {itemDetail.unit}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Danh mục:</Text>
                <Text style={styles.detailValue}>
                  {itemDetail.category?.name || 'Không có'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Đơn vị tính:</Text>
                <Text style={styles.detailValue}>{itemDetail.unit}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vật liệu:</Text>
                <Text style={styles.detailValue}>
                  {itemDetail.material || 'Không có'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Khối lượng:</Text>
                <Text style={styles.detailValue}>
                  {itemDetail.weight ? `${itemDetail.weight} kg` : 'Không có'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Đơn giá:</Text>
                <Text style={styles.detailValue}>
                  {itemDetail.price
                    ? itemDetail.price.toLocaleString('vi-VN') + ' đ'
                    : 'Không có'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Cập nhật:</Text>
                <Text style={styles.detailValue}>
                  {formatTimestamp(itemDetail.lastUpdated)}
                </Text>
              </View>
            </View>

            {itemDetail.description ? (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.sectionTitle}>Mô tả</Text>
                <Text style={styles.description}>{itemDetail.description}</Text>
              </>
            ) : null}
          </Card.Content>
        </Card>

        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            icon="arrow-down-bold"
            style={styles.inButton}
            onPress={() => openTransactionDialog('IN')}
          >
            Nhập kho
          </Button>
          <Button
            mode="contained"
            icon="arrow-up-bold"
            style={styles.outButton}
            onPress={() => openTransactionDialog('OUT')}
            disabled={itemDetail.stockQuantity <= 0}
          >
            Xuất kho
          </Button>
        </View>

        <Card style={styles.card}>
          <Card.Title title="Lịch sử giao dịch" />
          <Card.Content>
            {itemDetail.transactions && itemDetail.transactions.length > 0 ? (
              itemDetail.transactions.slice(0, 5).map((transaction, index) => (
                <React.Fragment key={transaction.id || index}>
                  <List.Item
                    title={transaction.type === 'IN' ? 'Nhập kho' : 'Xuất kho'}
                    description={`${transaction.note || ''}\n${formatTimestamp(
                      transaction.date
                    )}`}
                    left={() => (
                      <List.Icon
                        icon={
                          transaction.type === 'IN'
                            ? 'arrow-down-bold'
                            : 'arrow-up-bold'
                        }
                        color={
                          transaction.type === 'IN' ? '#4CAF50' : '#F44336'
                        }
                      />
                    )}
                    right={() => (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontWeight: 'bold' }}>
                          {transaction.type === 'IN' ? '+' : '-'}
                          {transaction.quantity} {itemDetail.unit}
                        </Text>
                      </View>
                    )}
                  />
                  {index < itemDetail.transactions.length - 1 && <Divider />}
                </React.Fragment>
              ))
            ) : (
              <Text style={{ textAlign: 'center', padding: 16, color: '#666' }}>
                Chưa có giao dịch nào
              </Text>
            )}

            {itemDetail.transactions && itemDetail.transactions.length > 5 && (
              <Button
                mode="text"
                onPress={() =>
                  navigation.navigate('InventoryTransaction', { itemId })
                }
              >
                Xem tất cả giao dịch
              </Button>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        <Dialog
          visible={transactionDialogVisible}
          onDismiss={() =>
            !processingTransaction && setTransactionDialogVisible(false)
          }
        >
          <Dialog.Title>
            {transactionType === 'IN' ? 'Nhập kho' : 'Xuất kho'}
          </Dialog.Title>

          <Dialog.Content>
            <TextInput
              label="Số lượng"
              value={transactionData.quantity}
              onChangeText={(text) => handleTransactionChange('quantity', text)}
              keyboardType="numeric"
              error={!!transactionErrors.quantity}
              style={styles.dialogInput}
              right={<TextInput.Affix text={itemDetail.unit} />}
              disabled={processingTransaction}
            />
            {transactionErrors.quantity && (
              <HelperText type="error">{transactionErrors.quantity}</HelperText>
            )}

            <TextInput
              label="Ghi chú"
              value={transactionData.note}
              onChangeText={(text) => handleTransactionChange('note', text)}
              error={!!transactionErrors.note}
              style={styles.dialogInput}
              disabled={processingTransaction}
            />
            {transactionErrors.note && (
              <HelperText type="error">{transactionErrors.note}</HelperText>
            )}

            <Text style={styles.stockInfo}>
              Tồn kho hiện tại: {itemDetail.stockQuantity} {itemDetail.unit}
            </Text>
          </Dialog.Content>

          <Dialog.Actions>
            <Button
              onPress={() => setTransactionDialogVisible(false)}
              disabled={processingTransaction}
            >
              Hủy
            </Button>
            <Button
              mode="contained"
              onPress={handleTransaction}
              loading={processingTransaction}
              disabled={processingTransaction}
            >
              Xác nhận
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        style={styles.fab}
        icon="file-document-edit"
        label="Thêm vào báo giá"
        onPress={handleAddToQuotation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemImage: {
    width: '100%',
    height: 200,
    marginBottom: 16,
    borderRadius: 4,
  },
  itemName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  itemCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#333',
  },
  detailGrid: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  detailLabel: {
    width: 100,
    color: '#666',
  },
  detailValue: {
    flex: 1,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#4CAF50',
  },
  outButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#F44336',
  },
  dialogInput: {
    marginBottom: 12,
  },
  stockInfo: {
    marginTop: 8,
    color: '#666',
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3f51b5',
  },
});

export default InventoryItemDetailScreen;
