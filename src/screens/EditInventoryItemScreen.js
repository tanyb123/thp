import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Appbar,
  HelperText,
  Divider,
  Dialog,
  Portal,
  List,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import InventoryService from '../api/inventoryService';
import { firebase } from '../config/firebaseConfig';
import useInventory from '../hooks/useInventory';

const EditInventoryItemScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { itemId } = route.params || {};
  const { updateInventoryItem, getInventoryItemDetail } = useInventory();

  // State cho form chỉnh sửa vật tư
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    categoryId: '',
    unit: '',
    stockQuantity: 0,
    minQuantity: 0,
    price: 0,
    weight: 0,
    material: '',
    totalPrice: 0,
  });
  const [image, setImage] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryDialogVisible, setCategoryDialogVisible] = useState(false);
  const [units] = useState([
    'cái',
    'bộ',
    'tấm',
    'kg',
    'mét',
    'm2',
    'cuộn',
    'lít',
    'lon',
  ]);
  const [unitDialogVisible, setUnitDialogVisible] = useState(false);

  // Load dữ liệu vật tư và danh sách danh mục khi màn hình được mount
  useEffect(() => {
    fetchCategories();
    requestPermissions();

    // Nếu có itemId thì load thông tin vật tư
    if (itemId) {
      fetchItemDetails();
    } else {
      // Nếu không có itemId, quay về màn hình trước
      Alert.alert('Lỗi', 'Không tìm thấy thông tin vật tư');
      navigation.goBack();
      setLoading(false);
    }
  }, [itemId]);

  // Hàm lấy chi tiết vật tư
  const fetchItemDetails = async () => {
    try {
      const itemDetails = await getInventoryItemDetail(itemId);

      // Cập nhật formData từ thông tin vật tư
      setFormData({
        name: itemDetails.name || '',
        code: itemDetails.code || '',
        description: itemDetails.description || '',
        categoryId: itemDetails.categoryId || '',
        unit: itemDetails.unit || '',
        stockQuantity: itemDetails.stockQuantity || 0,
        minQuantity: itemDetails.minQuantity || 0,
        price: itemDetails.price || 0,
        weight: itemDetails.weight || 0,
        material: itemDetails.material || '',
        totalPrice: itemDetails.totalPrice || 0,
      });

      // Cập nhật category đã chọn
      if (itemDetails.categoryId && categories.length > 0) {
        const category = categories.find(
          (c) => c.id === itemDetails.categoryId
        );
        if (category) {
          setSelectedCategory(category);
        }
      } else if (itemDetails.category) {
        setSelectedCategory(itemDetails.category);
      }

      // Cập nhật hình ảnh nếu có
      if (itemDetails.imageUrl) {
        setImage(itemDetails.imageUrl);
      }

      setLoading(false);
    } catch (error) {
      console.error('Lỗi khi lấy chi tiết vật tư:', error);
      Alert.alert('Lỗi', 'Không thể lấy thông tin vật tư');
      navigation.goBack();
    }
  };

  // Hàm lấy danh sách danh mục từ Firestore
  const fetchCategories = async () => {
    try {
      const snapshot = await firebase
        .firestore()
        .collection('inventory_categories')
        .get();
      const fetchedCategories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
      Alert.alert('Lỗi', 'Không thể lấy danh sách danh mục');
    }
  };

  // Yêu cầu quyền truy cập camera và thư viện ảnh
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } =
        await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Cần quyền truy cập',
          'Bạn cần cấp quyền để sử dụng camera và thư viện ảnh.'
        );
      }
    }
  };

  // Xử lý thay đổi giá trị các trường
  const handleChange = (field, value) => {
    // Xử lý cho trường số
    if (['stockQuantity', 'minQuantity', 'price', 'weight'].includes(field)) {
      const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
      const updatedValue = isNaN(numericValue) ? 0 : numericValue;

      const updatedFormData = {
        ...formData,
        [field]: updatedValue,
      };

      // Tính toán lại giá trị totalPrice nếu thay đổi số lượng hoặc đơn giá
      if (field === 'stockQuantity' || field === 'price') {
        updatedFormData.totalPrice =
          updatedFormData.stockQuantity * updatedFormData.price;
      }

      setFormData(updatedFormData);
    } else {
      setFormData({
        ...formData,
        [field]: value,
      });
    }

    // Xóa lỗi khi người dùng điền lại
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null,
      });
    }
  };

  // Chọn danh mục
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setFormData({
      ...formData,
      categoryId: category.id,
    });
    setCategoryDialogVisible(false);

    // Xóa lỗi danh mục nếu có
    if (errors.categoryId) {
      setErrors({
        ...errors,
        categoryId: null,
      });
    }
  };

  // Chọn đơn vị tính
  const handleUnitSelect = (unit) => {
    setFormData({
      ...formData,
      unit,
    });
    setUnitDialogVisible(false);

    // Xóa lỗi đơn vị nếu có
    if (errors.unit) {
      setErrors({
        ...errors,
        unit: null,
      });
    }
  };

  // Chọn ảnh từ thư viện
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setImage(imageUri);

        // Chuyển ảnh thành blob để upload
        const response = await fetch(imageUri);
        const blob = await response.blob();
        setImageBlob(blob);
      }
    } catch (error) {
      console.error('Lỗi khi chọn ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  // Chụp ảnh từ camera
  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setImage(imageUri);

        // Chuyển ảnh thành blob để upload
        const response = await fetch(imageUri);
        const blob = await response.blob();
        setImageBlob(blob);
      }
    } catch (error) {
      console.error('Lỗi khi chụp ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  // Kiểm tra form trước khi lưu
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập tên vật tư';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Vui lòng nhập mã vật tư';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Vui lòng chọn danh mục';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Vui lòng chọn đơn vị tính';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Cập nhật vật tư
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);

    try {
      // Cập nhật vật tư
      const result = await updateInventoryItem(itemId, formData);

      // Nếu có hình ảnh mới, upload và cập nhật URL
      if (imageBlob) {
        await InventoryService.uploadItemImage(itemId, imageBlob);
      }

      Alert.alert('Thành công', 'Đã cập nhật thông tin vật tư', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Lỗi khi cập nhật vật tư:', error);
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật vật tư');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Đang tải thông tin vật tư...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Chỉnh sửa vật tư" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        {/* Thông tin cơ bản */}
        <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

        <TextInput
          label="Tên vật tư *"
          value={formData.name}
          onChangeText={(text) => handleChange('name', text)}
          style={styles.input}
          error={!!errors.name}
        />
        {errors.name && <HelperText type="error">{errors.name}</HelperText>}

        <TextInput
          label="Mã vật tư *"
          value={formData.code}
          onChangeText={(text) => handleChange('code', text)}
          style={styles.input}
          error={!!errors.code}
        />
        {errors.code && <HelperText type="error">{errors.code}</HelperText>}

        <TouchableOpacity
          onPress={() => setCategoryDialogVisible(true)}
          style={styles.input}
        >
          <TextInput
            label="Danh mục *"
            value={selectedCategory ? selectedCategory.name : ''}
            editable={false}
            right={<TextInput.Icon icon="menu-down" />}
            error={!!errors.categoryId}
          />
        </TouchableOpacity>
        {errors.categoryId && (
          <HelperText type="error">{errors.categoryId}</HelperText>
        )}

        <TouchableOpacity
          onPress={() => setUnitDialogVisible(true)}
          style={styles.input}
        >
          <TextInput
            label="Đơn vị tính *"
            value={formData.unit}
            editable={false}
            right={<TextInput.Icon icon="menu-down" />}
            error={!!errors.unit}
          />
        </TouchableOpacity>
        {errors.unit && <HelperText type="error">{errors.unit}</HelperText>}

        <TextInput
          label="Mô tả"
          value={formData.description}
          onChangeText={(text) => handleChange('description', text)}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <Divider style={styles.divider} />

        {/* Thông tin số lượng và đơn giá */}
        <Text style={styles.sectionTitle}>Thông tin số lượng và đơn giá</Text>

        <TextInput
          label="Số lượng tồn kho"
          value={formData.stockQuantity.toString()}
          onChangeText={(text) => handleChange('stockQuantity', text)}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label="Số lượng tồn tối thiểu"
          value={formData.minQuantity.toString()}
          onChangeText={(text) => handleChange('minQuantity', text)}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label={`Đơn giá (VNĐ/${formData.unit || 'đơn vị'})`}
          value={formData.price.toString()}
          onChangeText={(text) => handleChange('price', text)}
          keyboardType="numeric"
          style={styles.input}
        />

        <View style={styles.totalPriceContainer}>
          <Text style={styles.totalPriceLabel}>Tổng giá trị:</Text>
          <Text style={styles.totalPriceValue}>
            {(formData.totalPrice || 0).toLocaleString('vi-VN')} VNĐ
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* Thông tin bổ sung */}
        <Text style={styles.sectionTitle}>Thông tin bổ sung</Text>

        <TextInput
          label="Vật liệu"
          value={formData.material}
          onChangeText={(text) => handleChange('material', text)}
          style={styles.input}
        />

        <TextInput
          label="Khối lượng (kg)"
          value={formData.weight.toString()}
          onChangeText={(text) => handleChange('weight', text)}
          keyboardType="numeric"
          style={styles.input}
        />

        {/* Phần upload hình ảnh */}
        <Text style={styles.sectionTitle}>Hình ảnh vật tư</Text>

        <View style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>Chưa có ảnh</Text>
            </View>
          )}

          <View style={styles.imageButtons}>
            <Button
              mode="contained"
              onPress={pickImage}
              style={styles.imageButton}
            >
              Chọn ảnh
            </Button>
            <Button
              mode="outlined"
              onPress={takePhoto}
              style={styles.imageButton}
            >
              Chụp ảnh
            </Button>
          </View>
        </View>

        {/* Nút lưu */}
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          loading={saving}
          disabled={saving}
        >
          Cập nhật vật tư
        </Button>
      </ScrollView>

      {/* Dialog chọn danh mục */}
      <Portal>
        <Dialog
          visible={categoryDialogVisible}
          onDismiss={() => setCategoryDialogVisible(false)}
        >
          <Dialog.Title>Chọn danh mục</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 300 }}>
              {categories.map((category) => (
                <List.Item
                  key={category.id}
                  title={category.name}
                  description={category.description}
                  onPress={() => handleCategorySelect(category)}
                />
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCategoryDialogVisible(false)}>
              Đóng
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog chọn đơn vị tính */}
      <Portal>
        <Dialog
          visible={unitDialogVisible}
          onDismiss={() => setUnitDialogVisible(false)}
        >
          <Dialog.Title>Chọn đơn vị tính</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 300 }}>
              {units.map((unit) => (
                <List.Item
                  key={unit}
                  title={unit}
                  onPress={() => handleUnitSelect(unit)}
                />
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUnitDialogVisible(false)}>Đóng</Button>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: 'white',
  },
  divider: {
    marginVertical: 16,
  },
  imageContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  placeholderText: {
    color: '#757575',
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  imageButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  saveButton: {
    marginVertical: 24,
    paddingVertical: 6,
    backgroundColor: '#3f51b5',
  },
  totalPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  totalPriceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalPriceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3f51b5',
  },
});

export default EditInventoryItemScreen;
