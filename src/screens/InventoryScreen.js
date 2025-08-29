import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Searchbar,
  FAB,
  Button,
  Chip,
  Menu,
  Portal,
  Dialog,
  TextInput,
  Paragraph,
  Divider,
  List,
} from 'react-native-paper';
import { db, functions } from '../config/firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import InventoryItemCard from '../components/InventoryItemCard';
import { TouchableOpacity } from 'react-native';
import useInventory from '../hooks/useInventory';
import { useAuth } from '../contexts/AuthContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { httpsCallable } from 'firebase/functions';

/**
 * Màn hình quản lý kho
 */
const InventoryScreen = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [sortOption, setSortOption] = useState('name'); // Mặc định sắp xếp theo tên
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState(
    '1ipw1E6FaVNVnCREuVVC9Ts8vRQ42VZas'
  );
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importResultDialogVisible, setImportResultDialogVisible] =
    useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const [fabOpen, setFabOpen] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(false);

  // Xử lý tham số refresh
  useEffect(() => {
    // Kiểm tra nếu có tham số refresh từ màn hình AddInventoryItem
    if (route.params?.refresh) {
      console.log('Refreshing inventory list from navigation param');
      // Reset param để tránh refresh vô hạn
      navigation.setParams({ refresh: undefined });
      // Trigger refresh bằng cách tăng refreshKey
      setRefreshKey((prev) => prev + 1);
    }
  }, [route.params?.refresh, navigation]);

  // Sử dụng navigation listener để quản lý việc hiển thị FAB
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('InventoryScreen focused - setting isScreenFocused to true');
      setIsScreenFocused(true);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log(
        'InventoryScreen unfocused - setting isScreenFocused to false'
      );
      setIsScreenFocused(false);
    });

    return () => {
      unsubscribe();
      unsubscribeBlur();
    };
  }, [navigation]);

  // Lấy danh sách vật tư từ Firestore - tối ưu hiệu suất
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      console.log('=== INVENTORYSCREEN: BẮT ĐẦU FETCH INVENTORY ===');
      const inventoryRef = collection(db, 'inventory');

      // Thử query với lastUpdated trước, nếu lỗi thì fallback về query không có orderBy
      let q;
      let snapshot;

      try {
        // Thử query với lastUpdated (cho vật tư mới thêm thủ công)
        console.log('=== INVENTORYSCREEN: THỬ QUERY VỚI lastUpdated ===');
        q = query(inventoryRef, orderBy('lastUpdated', 'desc'));
        snapshot = await getDocs(q);
        console.log('=== INVENTORYSCREEN: QUERY lastUpdated THÀNH CÔNG ===');
      } catch (orderByError) {
        console.log(
          '=== INVENTORYSCREEN: QUERY lastUpdated THẤT BẠI, THỬ QUERY KHÔNG CÓ ORDERBY ==='
        );
        console.log('Lỗi orderBy:', orderByError.message);

        // Fallback: query không có orderBy để lấy tất cả vật tư
        q = query(inventoryRef);
        snapshot = await getDocs(q);
        console.log(
          '=== INVENTORYSCREEN: QUERY KHÔNG CÓ ORDERBY THÀNH CÔNG ==='
        );
      }

      console.log('=== INVENTORYSCREEN: KẾT QUẢ QUERY ===');
      console.log('Số lượng documents:', snapshot.docs.length);

      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log('=== INVENTORYSCREEN: DỮ LIỆU ĐÃ PARSE ===');
      console.log('Số lượng items:', fetchedItems.length);
      console.log('Items đầu tiên:', fetchedItems[0]);

      // Sắp xếp thủ công nếu cần
      const sortedItems = fetchedItems.sort((a, b) => {
        // Ưu tiên lastUpdated, sau đó updatedAt, cuối cùng createdAt
        const aTime = a.lastUpdated || a.updatedAt || a.createdAt;
        const bTime = b.lastUpdated || b.updatedAt || b.createdAt;

        if (aTime && bTime) {
          return bTime.toDate().getTime() - aTime.toDate().getTime();
        }
        return 0;
      });

      console.log('=== INVENTORYSCREEN: DỮ LIỆU ĐÃ SẮP XẾP ===');
      console.log('Số lượng items sau khi sắp xếp:', sortedItems.length);

      setItems(sortedItems);
      applyFiltersAndSort(
        sortedItems,
        searchQuery,
        selectedCategory,
        filterLowStock,
        sortOption
      );

      console.log('=== INVENTORYSCREEN: HOÀN THÀNH FETCH ===');
    } catch (error) {
      console.error('=== INVENTORYSCREEN: LỖI FETCH ===');
      console.error('Lỗi khi lấy dữ liệu kho:', error);
      console.error('Error details:', error.message, error.code);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, filterLowStock, sortOption]);

  // Lấy danh sách danh mục
  const fetchCategories = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, 'inventory_categories'));
      const fetchedCategories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
    }
  }, []);

  // Load dữ liệu khi màn hình được focus hoặc refresh
  useFocusEffect(
    useCallback(() => {
      fetchInventory();
      fetchCategories();
      return () => {}; // cleanup function
    }, [fetchInventory, fetchCategories, refreshKey])
  );

  // Hàm áp dụng bộ lọc và sắp xếp - đã tối ưu để tránh re-render
  const applyFiltersAndSort = useCallback(
    (itemsToFilter, query, category, lowStock, sort) => {
      // Lọc theo từ khóa tìm kiếm
      let result = [...itemsToFilter];

      if (query) {
        const normalizedQuery = query.toLowerCase().trim();
        result = result.filter(
          (item) =>
            item.name?.toLowerCase().includes(normalizedQuery) ||
            item.code?.toLowerCase().includes(normalizedQuery) ||
            item.material?.toLowerCase().includes(normalizedQuery)
        );
      }

      // Lọc theo danh mục
      if (category) {
        result = result.filter((item) => item.categoryId === category.id);
      }

      // Lọc vật tư có tồn kho thấp
      if (lowStock) {
        result = result.filter(
          (item) =>
            item.stockQuantity <= (item.minQuantity || 0) &&
            item.minQuantity > 0
        );
      }

      // Sắp xếp
      switch (sort) {
        case 'name':
          result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'stockLow':
          result.sort(
            (a, b) => (a.stockQuantity || 0) - (b.stockQuantity || 0)
          );
          break;
        case 'stockHigh':
          result.sort(
            (a, b) => (b.stockQuantity || 0) - (a.stockQuantity || 0)
          );
          break;
        case 'code':
          result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
          break;
      }

      setFilteredItems(result);
    },
    []
  );

  // Xử lý thay đổi từ khóa tìm kiếm
  const onChangeSearch = (query) => {
    setSearchQuery(query);
    applyFiltersAndSort(
      items,
      query,
      selectedCategory,
      filterLowStock,
      sortOption
    );
  };

  // Xử lý chọn danh mục
  const handleCategorySelect = (category) => {
    setSelectedCategory(category === selectedCategory ? null : category);
    applyFiltersAndSort(
      items,
      searchQuery,
      category === selectedCategory ? null : category,
      filterLowStock,
      sortOption
    );
  };

  // Xử lý thay đổi sắp xếp
  const handleSortChange = (option) => {
    setSortOption(option);
    setMenuVisible(false);
    applyFiltersAndSort(
      items,
      searchQuery,
      selectedCategory,
      filterLowStock,
      option
    );
  };

  // Xử lý lọc hàng tồn thấp
  const toggleLowStockFilter = () => {
    const newFilterValue = !filterLowStock;
    setFilterLowStock(newFilterValue);
    applyFiltersAndSort(
      items,
      searchQuery,
      selectedCategory,
      newFilterValue,
      sortOption
    );
  };

  // Xử lý chọn vật tư
  const handleItemPress = (item) => {
    navigation.navigate('InventoryItemDetail', { itemId: item.id });
  };

  // Xử lý thêm mới
  const handleAddItem = () => {
    navigation.navigate('AddInventoryItem');
  };

  const fetchGoogleDriveFiles = async (token, folderId = null) => {
    setIsLoadingFiles(true);
    const baseUrl = 'https://www.googleapis.com/drive/v3/files';
    const params = new URLSearchParams();

    // Build query based on whether we have a specific folder ID or not
    let query =
      "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false";
    if (folderId) {
      query = `'${folderId}' in parents and ${query}`;
    }

    params.append('q', query);
    params.append('orderBy', 'modifiedTime desc');
    params.append('fields', 'files(id, name, modifiedTime, iconLink)');
    const url = `${baseUrl}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status}`);
      }
      const json = await response.json();
      return json.files || [];
    } catch (error) {
      console.error('Error in fetchGoogleDriveFiles:', error);
      Alert.alert('Lỗi', 'Không thể lấy danh sách file từ Google Drive.');
      throw error;
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Xử lý nhập vật tư từ Google Drive
  const handleImportFromDrive = async () => {
    setImportLoading(true);
    try {
      // Kiểm tra xem người dùng đã đăng nhập Google chưa
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        await GoogleSignin.signIn();
      }
      // Lấy token
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (!accessToken) {
        throw new Error('Không thể lấy được access token.');
      }

      if (!driveFolderId) {
        Alert.alert('Lỗi', 'Vui lòng nhập ID thư mục Google Drive');
        return;
      }

      // Lấy danh sách file Excel từ folder
      const files = await fetchGoogleDriveFiles(accessToken, driveFolderId);
      if (files && files.length > 0) {
        setDriveFiles(files);
        setImportDialogVisible(false);
        setIsPickerVisible(true);
      } else {
        Alert.alert(
          'Không tìm thấy file',
          'Không tìm thấy file Excel nào trong thư mục Google Drive này.'
        );
      }
    } catch (error) {
      console.error('Lỗi khi nhập vật tư:', error);
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert(
          'Lỗi nhập vật tư',
          error.message || 'Không thể nhập vật tư từ Google Drive'
        );
      }
    } finally {
      setImportLoading(false);
    }
  };

  const handleFileSelect = async (file) => {
    setIsPickerVisible(false);
    setImportLoading(true);

    try {
      // Lấy access token
      const tokens = await GoogleSignin.getTokens();
      const { accessToken } = tokens;

      if (!accessToken) {
        throw new Error('Không thể lấy được access token của Google.');
      }

      // Gọi Cloud Function để xử lý và nhập vật tư
      const importInventory = httpsCallable(
        functions,
        'importInventoryFromExcel'
      );
      const result = await importInventory({
        driveFileId: file.id,
        accessToken,
      });

      // Xử lý kết quả
      console.log('Kết quả nhập vật tư:', result.data);
      setImportResult(result.data);
      setImportResultDialogVisible(true);

      // Cập nhật lại danh sách vật tư - dùng refreshKey để trigger useFocusEffect
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Lỗi khi xử lý file Excel:', error);

      let errorMessage = error.message;
      if (error.code === 'functions/unauthenticated') {
        errorMessage =
          'Xác thực thất bại. Vui lòng đăng xuất và đăng nhập lại.';
      } else if (error.code === 'functions/permission-denied') {
        errorMessage =
          'Token truy cập Google Drive đã hết hạn. Vui lòng thử lại.';
      }

      Alert.alert('Lỗi xử lý file', `Chi tiết: ${errorMessage}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleCloseResultDialog = () => {
    setImportResultDialogVisible(false);
    // Đảm bảo danh sách được tải lại sau khi đóng dialog
    setTimeout(() => {
      fetchInventory();
    }, 300);
  };

  // Hiển thị các danh mục
  const renderCategoryChips = () => {
    return (
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Chip
            style={[
              styles.chip,
              selectedCategory?.id === item.id ? styles.selectedChip : null,
            ]}
            onPress={() => handleCategorySelect(item)}
            mode={selectedCategory?.id === item.id ? 'flat' : 'outlined'}
          >
            {item.name}
          </Chip>
        )}
        contentContainerStyle={styles.chipsContainer}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Thanh tìm kiếm */}
      <Searchbar
        placeholder="Tìm kiếm vật tư..."
        onChangeText={onChangeSearch}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Thanh công cụ */}
      <View style={styles.toolbar}>
        {/* Menu sắp xếp */}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
              icon="sort"
            >
              Sắp xếp
            </Button>
          }
        >
          <Menu.Item
            title="Theo tên (A-Z)"
            onPress={() => handleSortChange('name')}
          />
          <Menu.Item
            title="Tồn kho (Thấp-Cao)"
            onPress={() => handleSortChange('stockLow')}
          />
          <Menu.Item
            title="Tồn kho (Cao-Thấp)"
            onPress={() => handleSortChange('stockHigh')}
          />
          <Menu.Item title="Theo mã" onPress={() => handleSortChange('code')} />
        </Menu>

        {/* Nút lọc hàng tồn thấp */}
        <Button
          mode={filterLowStock ? 'contained' : 'outlined'}
          onPress={toggleLowStockFilter}
          icon="alert-circle"
        >
          Tồn thấp
        </Button>
      </View>

      {/* Danh sách danh mục */}
      {renderCategoryChips()}

      {/* Danh sách vật tư */}
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : filteredItems.length > 0 ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InventoryItemCard item={item} onPress={handleItemPress} />
          )}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Không có vật tư nào{' '}
            {searchQuery ? 'phù hợp với tìm kiếm' : 'trong kho'}
          </Text>
        </View>
      )}

      {/* FAB đơn giản - chỉ hiển thị khi màn hình được focus */}
      {console.log(
        'Rendering FAB, isScreenFocused:',
        isScreenFocused,
        'fabOpen:',
        fabOpen
      )}
      {isScreenFocused && (
        <FAB
          icon={fabOpen ? 'close' : 'plus'}
          style={styles.fab}
          onPress={() => {
            console.log('FAB pressed, current fabOpen:', fabOpen);
            if (fabOpen) {
              // Nếu FAB đang mở, hiển thị menu
              setFabOpen(false);
            } else {
              // Nếu FAB đang đóng, mở menu
              setFabOpen(true);
            }
          }}
        />
      )}

      {/* Menu cho các hành động khi FAB được mở */}
      {isScreenFocused && fabOpen && (
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setFabOpen(false);
              handleAddItem();
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.fabMenuText}>Thêm vật tư mới</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setFabOpen(false);
              setImportDialogVisible(true);
            }}
          >
            <Ionicons name="file-excel" size={20} color="#fff" />
            <Text style={styles.fabMenuText}>Nhập từ Excel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dialog nhập từ Google Drive */}
      <Portal>
        <Dialog
          visible={importDialogVisible}
          onDismiss={() => !importLoading && setImportDialogVisible(false)}
        >
          <Dialog.Title>Nhập vật tư từ Google Drive</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Chức năng này sẽ nhập vật tư từ file Excel mới nhất trong thư mục
              Google Drive. File cần có định dạng với các cột sau:
            </Paragraph>

            <View style={styles.excelInfo}>
              <List.Item
                title="Cột A: Mã vật tư (code)"
                left={(props) => <List.Icon {...props} icon="pound" />}
              />
              <List.Item
                title="Cột B: Tên vật tư (name)"
                left={(props) => <List.Icon {...props} icon="text" />}
              />
              <List.Item
                title="Cột C: Mô tả (description)"
                left={(props) => <List.Icon {...props} icon="text-box" />}
              />
              <List.Item
                title="Cột D: Danh mục (category)"
                left={(props) => <List.Icon {...props} icon="folder" />}
              />
              <List.Item
                title="Cột E: Đơn vị tính (unit)"
                left={(props) => <List.Icon {...props} icon="cube" />}
              />
              <List.Item
                title="Cột F: Số lượng (stockQuantity)"
                left={(props) => <List.Icon {...props} icon="counter" />}
              />
              <List.Item
                title="Cột G: Số lượng tối thiểu (minQuantity)"
                left={(props) => <List.Icon {...props} icon="alert" />}
              />
              <List.Item
                title="Cột H: Đơn giá (price)"
                left={(props) => <List.Icon {...props} icon="currency-usd" />}
              />
              <List.Item
                title="Cột I: Vật liệu (material)"
                left={(props) => <List.Icon {...props} icon="tools" />}
              />
              <List.Item
                title="Cột J: Khối lượng (weight)"
                left={(props) => <List.Icon {...props} icon="weight" />}
              />
            </View>

            <Divider style={styles.divider} />

            <TextInput
              label="Google Drive Folder ID"
              value={driveFolderId}
              onChangeText={setDriveFolderId}
              style={styles.input}
              disabled={importLoading}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setImportDialogVisible(false)}
              disabled={importLoading}
            >
              Hủy
            </Button>
            <Button
              mode="contained"
              onPress={handleImportFromDrive}
              loading={importLoading}
              disabled={importLoading}
            >
              Tiếp tục
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog chọn file từ Drive */}
      <Portal>
        <Dialog
          visible={isPickerVisible}
          onDismiss={() => !importLoading && setIsPickerVisible(false)}
          style={styles.filePickerDialog}
        >
          <Dialog.Title>Chọn file Excel</Dialog.Title>
          <Dialog.Content>
            {isLoadingFiles ? (
              <ActivityIndicator size="large" style={styles.loader} />
            ) : driveFiles.length > 0 ? (
              <FlatList
                data={driveFiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <List.Item
                    title={item.name}
                    description={`Sửa đổi: ${new Date(
                      item.modifiedTime
                    ).toLocaleString()}`}
                    left={(props) => <List.Icon {...props} icon="file-excel" />}
                    onPress={() => handleFileSelect(item)}
                    disabled={importLoading}
                  />
                )}
                style={styles.fileList}
              />
            ) : (
              <Text style={styles.emptyText}>Không tìm thấy file Excel</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setIsPickerVisible(false)}
              disabled={importLoading}
            >
              Hủy
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog kết quả nhập */}
      <Portal>
        <Dialog
          visible={importResultDialogVisible}
          onDismiss={handleCloseResultDialog}
        >
          <Dialog.Title>Kết quả nhập vật tư</Dialog.Title>
          <Dialog.Content>
            {importResult && (
              <View>
                <Paragraph style={styles.resultText}>
                  Tổng số vật tư đã xử lý: {importResult.total}
                </Paragraph>
                <Paragraph style={styles.resultText}>
                  Số vật tư đã thêm mới:{' '}
                  <Text style={styles.successText}>{importResult.added}</Text>
                </Paragraph>
                <Paragraph style={styles.resultText}>
                  Số vật tư đã cập nhật:{' '}
                  <Text style={styles.warningText}>{importResult.updated}</Text>
                </Paragraph>
                <Paragraph style={styles.resultText}>
                  Số vật tư bị bỏ qua:{' '}
                  <Text style={styles.errorText}>{importResult.skipped}</Text>
                </Paragraph>

                {importResult.errors && importResult.errors.length > 0 && (
                  <View style={styles.errorList}>
                    <Text style={styles.errorHeader}>Các lỗi gặp phải:</Text>
                    {importResult.errors.map((error, index) => (
                      <Text key={index} style={styles.errorItem}>
                        Hàng {error.row}: {error.message}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCloseResultDialog}>Đóng</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    margin: 16,
    elevation: 2,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  chip: {
    marginRight: 8,
  },
  selectedChip: {
    backgroundColor: '#3f51b5',
  },
  listContainer: {
    paddingBottom: 80, // Để không bị FAB che khuất
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3f51b5',
  },
  fabMenu: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 4,
  },
  fabMenuText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  divider: {
    marginVertical: 16,
  },
  input: {
    marginBottom: 10,
    backgroundColor: 'white',
  },
  excelInfo: {
    marginVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    maxHeight: 250,
  },
  resultText: {
    fontSize: 16,
    marginBottom: 8,
  },
  successText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  warningText: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  errorList: {
    marginTop: 16,
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
  },
  errorHeader: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#F44336',
  },
  errorItem: {
    color: '#D32F2F',
    marginBottom: 4,
  },
  filePickerDialog: {
    maxHeight: '80%',
  },
  fileList: {
    maxHeight: 300,
  },
});

export default InventoryScreen;
