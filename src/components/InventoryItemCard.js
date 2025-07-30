import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from 'react-native-paper';
import StatusIndicator from './StatusIndicator';

/**
 * Component hiển thị thông tin vật tư trong kho dưới dạng card
 */
const InventoryItemCard = ({ item, onPress }) => {
  // Xác định trạng thái tồn kho
  const getStockStatus = () => {
    if (!item.minQuantity) return 'normal'; // Nếu không thiết lập mức tối thiểu

    if (item.stockQuantity <= 0) {
      return 'critical'; // Hết hàng
    } else if (item.stockQuantity <= item.minQuantity) {
      return 'warning'; // Dưới mức tối thiểu
    } else {
      return 'normal'; // Bình thường
    }
  };

  // Hiển thị trạng thái
  const renderStockStatus = () => {
    const status = getStockStatus();
    let statusText = 'Bình thường';

    if (status === 'critical') {
      statusText = 'Hết hàng';
    } else if (status === 'warning') {
      statusText = 'Dưới mức tối thiểu';
    }

    return <StatusIndicator status={status} text={statusText} />;
  };

  return (
    <TouchableOpacity onPress={() => onPress(item)}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.code}>Mã: {item.code}</Text>
            </View>
            {renderStockStatus()}
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tồn kho:</Text>
              <Text style={styles.detailValue}>
                {item.stockQuantity} {item.unit}
              </Text>
            </View>

            {item.material && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vật liệu:</Text>
                <Text style={styles.detailValue}>{item.material}</Text>
              </View>
            )}

            {item.weight > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Khối lượng:</Text>
                <Text style={styles.detailValue}>{item.weight} kg</Text>
              </View>
            )}

            {item.price > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Đơn giá:</Text>
                <Text style={styles.detailValue}>
                  {item.price.toLocaleString('vi-VN')} đ
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  code: {
    fontSize: 12,
    color: '#666',
  },
  detailsContainer: {
    marginTop: 5,
  },
  detailRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  detailLabel: {
    width: 80,
    color: '#666',
  },
  detailValue: {
    flex: 1,
    fontWeight: '500',
  },
});

export default InventoryItemCard;
