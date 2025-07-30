import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Title,
  Paragraph,
  DataTable,
  ProgressBar,
  Divider,
  ActivityIndicator,
  Chip,
  Button,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useInventory from '../hooks/useInventory';
import { firebase } from '../config/firebaseConfig';
import StatusIndicator from '../components/StatusIndicator';

const InventoryReportScreen = () => {
  const navigation = useNavigation();

  const {
    fetchInventoryItems,
    inventoryItems,
    categories,
    fetchCategories,
    loading,
  } = useInventory();

  const [reportType, setReportType] = useState('lowStock');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [topItems, setTopItems] = useState([]);
  const [summaryData, setSummaryData] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    normalItems: 0,
  });

  // Cập nhật dữ liệu khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Load dữ liệu báo cáo
  const loadData = async () => {
    try {
      // Lấy dữ liệu vật tư và danh mục
      await Promise.all([fetchInventoryItems(), fetchCategories()]);

      // Tính toán các số liệu tổng hợp
      calculateSummary();

      // Tính top vật tư có giá trị cao
      calculateTopItems();
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu báo cáo:', error);
    }
  };

  // Tính toán số liệu tổng hợp
  const calculateSummary = () => {
    const total = inventoryItems.length;
    let totalValue = 0;
    let lowStock = 0;
    let outOfStock = 0;

    inventoryItems.forEach((item) => {
      // Tính tổng giá trị
      totalValue += (item.price || 0) * (item.stockQuantity || 0);

      // Đếm số vật tư tồn thấp
      if (
        item.stockQuantity <= (item.minQuantity || 0) &&
        item.minQuantity > 0
      ) {
        lowStock++;
      }

      // Đếm số vật tư hết hàng
      if (item.stockQuantity <= 0) {
        outOfStock++;
      }
    });

    setSummaryData({
      totalItems: total,
      totalValue,
      lowStockItems: lowStock,
      outOfStockItems: outOfStock,
      normalItems: total - lowStock,
    });
  };

  // Tính toán top vật tư có giá trị cao
  const calculateTopItems = () => {
    // Sao chép mảng để không ảnh hưởng đến dữ liệu gốc
    const items = [...inventoryItems];

    // Sắp xếp theo giá trị tồn kho (số lượng * đơn giá)
    items.sort((a, b) => {
      const valueA = (a.stockQuantity || 0) * (a.price || 0);
      const valueB = (b.stockQuantity || 0) * (b.price || 0);
      return valueB - valueA;
    });

    // Lấy 10 vật tư đầu tiên
    setTopItems(items.slice(0, 10));
  };

  // Lọc vật tư theo loại báo cáo và danh mục
  const getFilteredItems = () => {
    let filteredItems = [...inventoryItems];

    // Lọc theo danh mục nếu có
    if (categoryFilter) {
      filteredItems = filteredItems.filter(
        (item) => item.categoryId === categoryFilter
      );
    }

    // Lọc theo loại báo cáo
    switch (reportType) {
      case 'lowStock':
        return filteredItems.filter(
          (item) =>
            item.stockQuantity <= (item.minQuantity || 0) &&
            item.minQuantity > 0
        );
      case 'outOfStock':
        return filteredItems.filter((item) => item.stockQuantity <= 0);
      case 'allItems':
      default:
        return filteredItems;
    }
  };

  // Lấy tên danh mục từ ID
  const getCategoryName = (categoryId) => {
    const category = categories.find((cat) => cat.id === categoryId);
    return category ? category.name : 'Không có';
  };

  // Format số tiền VNĐ
  const formatCurrency = (value) => {
    return value.toLocaleString('vi-VN') + ' đ';
  };

  // Render biểu đồ phân tích
  const renderAnalyticsChart = () => {
    const { totalItems, lowStockItems, outOfStockItems, normalItems } =
      summaryData;

    if (totalItems === 0) return null;

    const normalPercent = (normalItems / totalItems) * 100;
    const lowPercent = (lowStockItems / totalItems) * 100;
    const outPercent = (outOfStockItems / totalItems) * 100;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title>Phân tích tồn kho</Title>

          <View style={styles.chartContainer}>
            <View style={styles.chartRow}>
              <View style={styles.chartLabelContainer}>
                <View
                  style={[
                    styles.colorIndicator,
                    { backgroundColor: '#4CAF50' },
                  ]}
                />
                <Text>Bình thường</Text>
              </View>
              <View style={styles.chartBarContainer}>
                <ProgressBar
                  progress={normalPercent / 100}
                  color="#4CAF50"
                  style={styles.progressBar}
                />
                <Text style={styles.percentageText}>
                  {Math.round(normalPercent)}% ({normalItems})
                </Text>
              </View>
            </View>

            <View style={styles.chartRow}>
              <View style={styles.chartLabelContainer}>
                <View
                  style={[
                    styles.colorIndicator,
                    { backgroundColor: '#FFC107' },
                  ]}
                />
                <Text>Tồn thấp</Text>
              </View>
              <View style={styles.chartBarContainer}>
                <ProgressBar
                  progress={lowPercent / 100}
                  color="#FFC107"
                  style={styles.progressBar}
                />
                <Text style={styles.percentageText}>
                  {Math.round(lowPercent)}% ({lowStockItems - outOfStockItems})
                </Text>
              </View>
            </View>

            <View style={styles.chartRow}>
              <View style={styles.chartLabelContainer}>
                <View
                  style={[
                    styles.colorIndicator,
                    { backgroundColor: '#F44336' },
                  ]}
                />
                <Text>Hết hàng</Text>
              </View>
              <View style={styles.chartBarContainer}>
                <ProgressBar
                  progress={outPercent / 100}
                  color="#F44336"
                  style={styles.progressBar}
                />
                <Text style={styles.percentageText}>
                  {Math.round(outPercent)}% ({outOfStockItems})
                </Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Render phần tổng quan
  const renderSummary = () => {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title>Tổng quan kho hàng</Title>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summaryData.totalItems}</Text>
              <Text style={styles.summaryLabel}>Tổng vật tư</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {formatCurrency(summaryData.totalValue)}
              </Text>
              <Text style={styles.summaryLabel}>Giá trị kho</Text>
            </View>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#FFC107' }]}>
                {summaryData.lowStockItems}
              </Text>
              <Text style={styles.summaryLabel}>Cần nhập thêm</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                {summaryData.outOfStockItems}
              </Text>
              <Text style={styles.summaryLabel}>Hết hàng</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Render top vật tư giá trị cao
  const renderTopItems = () => {
    if (topItems.length === 0) return null;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title>Top vật tư giá trị cao</Title>

          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Tên vật tư</DataTable.Title>
              <DataTable.Title numeric>Tồn kho</DataTable.Title>
              <DataTable.Title numeric>Giá trị</DataTable.Title>
            </DataTable.Header>

            {topItems.slice(0, 5).map((item) => {
              const value = (item.stockQuantity || 0) * (item.price || 0);
              return (
                <DataTable.Row
                  key={item.id}
                  onPress={() =>
                    navigation.navigate('InventoryItemDetail', {
                      itemId: item.id,
                    })
                  }
                >
                  <DataTable.Cell>{item.name}</DataTable.Cell>
                  <DataTable.Cell numeric>
                    {item.stockQuantity} {item.unit}
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    {formatCurrency(value)}
                  </DataTable.Cell>
                </DataTable.Row>
              );
            })}
          </DataTable>

          {topItems.length > 5 && (
            <Button
              mode="text"
              onPress={() =>
                navigation.navigate('Inventory', { filter: 'valueHigh' })
              }
              style={{ marginTop: 8 }}
            >
              Xem tất cả
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Render danh sách vật tư theo filter
  const renderInventoryList = () => {
    const filteredItems = getFilteredItems();

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.listHeader}>
            <Title>
              {reportType === 'lowStock' && 'Vật tư tồn thấp'}
              {reportType === 'outOfStock' && 'Vật tư hết hàng'}
              {reportType === 'allItems' && 'Tất cả vật tư'}
            </Title>

            <Text style={styles.itemCount}>{filteredItems.length} vật tư</Text>
          </View>

          <View style={styles.filterChips}>
            {categories.slice(0, 5).map((category) => (
              <Chip
                key={category.id}
                selected={categoryFilter === category.id}
                onPress={() =>
                  setCategoryFilter(
                    categoryFilter === category.id ? null : category.id
                  )
                }
                style={styles.filterChip}
              >
                {category.name}
              </Chip>
            ))}

            {categories.length > 5 && (
              <Chip
                onPress={() => navigation.navigate('Inventory')}
                style={styles.filterChip}
              >
                +{categories.length - 5} thêm
              </Chip>
            )}
          </View>

          <SegmentedButtons
            value={reportType}
            onValueChange={setReportType}
            buttons={[
              { value: 'lowStock', label: 'Tồn thấp' },
              { value: 'outOfStock', label: 'Hết hàng' },
              { value: 'allItems', label: 'Tất cả' },
            ]}
            style={styles.segmentedButtons}
          />

          <Divider style={{ marginTop: 16 }} />

          {filteredItems.length > 0 ? (
            filteredItems.slice(0, 10).map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() =>
                  navigation.navigate('InventoryItemDetail', {
                    itemId: item.id,
                  })
                }
              >
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCode}>Mã: {item.code}</Text>
                    <Text style={styles.itemCategory}>
                      {getCategoryName(item.categoryId)}
                    </Text>
                  </View>

                  <View style={styles.itemQuantity}>
                    <Text style={styles.quantityValue}>
                      {item.stockQuantity} {item.unit}
                    </Text>
                    <StatusIndicator
                      status={
                        item.stockQuantity <= 0
                          ? 'critical'
                          : item.stockQuantity <= (item.minQuantity || 0)
                          ? 'warning'
                          : 'normal'
                      }
                      text={
                        item.stockQuantity <= 0
                          ? 'Hết hàng'
                          : item.stockQuantity <= (item.minQuantity || 0)
                          ? 'Tồn thấp'
                          : 'Bình thường'
                      }
                    />
                  </View>
                </View>
                <Divider />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyListContainer}>
              <Ionicons name="cube-outline" size={48} color="#ccc" />
              <Text style={styles.emptyListText}>
                Không có vật tư nào
                {reportType === 'lowStock' && ' tồn thấp'}
                {reportType === 'outOfStock' && ' hết hàng'}
                {categoryFilter &&
                  ` trong danh mục ${getCategoryName(categoryFilter)}`}
              </Text>
            </View>
          )}

          {filteredItems.length > 10 && (
            <Button
              mode="outlined"
              onPress={() =>
                navigation.navigate('Inventory', {
                  reportType,
                  categoryId: categoryFilter,
                })
              }
              style={{ marginTop: 16 }}
            >
              Xem tất cả {filteredItems.length} vật tư
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Báo cáo kho" />
        <Appbar.Action icon="refresh" onPress={loadData} />
        <Appbar.Action
          icon="file-export-outline"
          onPress={() => alert('Chức năng xuất báo cáo sẽ được phát triển sau')}
        />
      </Appbar.Header>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 16 }}>Đang tải dữ liệu báo cáo...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {renderSummary()}
          {renderAnalyticsChart()}
          {renderTopItems()}
          {renderInventoryList()}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Dữ liệu được cập nhật lần cuối:{' '}
              {new Date().toLocaleString('vi-VN')}
            </Text>
          </View>
        </ScrollView>
      )}
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
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3f51b5',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chartContainer: {
    marginTop: 16,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartLabelContainer: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  chartBarContainer: {
    flex: 1,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 12,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemCode: {
    fontSize: 12,
    color: '#666',
  },
  itemCategory: {
    fontSize: 12,
    color: '#3f51b5',
    marginTop: 4,
  },
  itemQuantity: {
    alignItems: 'flex-end',
  },
  quantityValue: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyListContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyListText: {
    marginTop: 16,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default InventoryReportScreen;
