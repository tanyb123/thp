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
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { firebase } from '../config/firebaseConfig';
import useInventory from '../hooks/useInventory';

const AddInventoryItemScreen = () => {
  const navigation = useNavigation();
  const { addInventoryItem } = useInventory();

  // State cho form thêm vật tư
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
    imageBase64: '', // Thêm field để lưu ảnh base64
  });
  const [image, setImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false); // Thay đổi từ imageBlob sang uploadingImage
  const [loading, setLoading] = useState(false);
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

  // Load danh sách danh mục khi màn hình được mount
  useEffect(() => {
    console.log('=== USEEFFECT: MOUNT SCREEN ===');
    fetchCategories();
    requestPermissions();
  }, []);

  // Hàm lấy danh sách danh mục từ Firestore
  const fetchCategories = async () => {
    try {
      console.log('=== FETCHCATEGORIES: BẮT ĐẦU ===');
      const snapshot = await firebase
        .firestore()
        .collection('inventory_categories')
        .get();

      const fetchedCategories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log('=== FETCHCATEGORIES: KẾT QUẢ ===');
      console.log('Số lượng categories:', fetchedCategories.length);
      console.log('Categories:', JSON.stringify(fetchedCategories, null, 2));

      setCategories(fetchedCategories);
    } catch (error) {
      console.error('=== FETCHCATEGORIES: LỖI ===');
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
    console.log(`=== HANDLECHANGE: ${field} ===`);
    console.log('Giá trị mới:', value);
    console.log('formData hiện tại:', JSON.stringify(formData, null, 2));

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

      console.log(
        'formData sau khi cập nhật:',
        JSON.stringify(updatedFormData, null, 2)
      );
      setFormData(updatedFormData);
    } else {
      const updatedFormData = {
        ...formData,
        [field]: value,
      };

      console.log(
        'formData sau khi cập nhật:',
        JSON.stringify(updatedFormData, null, 2)
      );
      setFormData(updatedFormData);
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
    console.log('=== HANDLECATEGORYSELECT ===');
    console.log('Category được chọn:', JSON.stringify(category, null, 2));
    console.log(
      'formData trước khi cập nhật:',
      JSON.stringify(formData, null, 2)
    );

    setSelectedCategory(category);
    const updatedFormData = {
      ...formData,
      categoryId: category.id,
    };

    console.log(
      'formData sau khi cập nhật categoryId:',
      JSON.stringify(updatedFormData, null, 2)
    );
    setFormData(updatedFormData);
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
    console.log('=== HANDLEUNITSELECT ===');
    console.log('Unit được chọn:', unit);
    console.log(
      'formData trước khi cập nhật:',
      JSON.stringify(formData, null, 2)
    );

    const updatedFormData = {
      ...formData,
      unit,
    };

    console.log(
      'formData sau khi cập nhật unit:',
      JSON.stringify(updatedFormData, null, 2)
    );
    setFormData(updatedFormData);
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
        quality: 0.7,
        base64: true, // Bật base64 để lấy dữ liệu trực tiếp
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = asset.uri;
        setImage(imageUri);

        // Lấy base64 data trực tiếp từ ImagePicker
        if (asset.base64) {
          setUploadingImage(true);
          try {
            // Tạo data URL với MIME type phù hợp
            const fileExtension = imageUri.split('.').pop() || 'jpg';
            const mimeType = `image/${fileExtension}`;
            const dataURL = `data:${mimeType};base64,${asset.base64}`;

            setFormData((prev) => ({
              ...prev,
              imageBase64: dataURL,
            }));

            console.log('Base64 image saved successfully');
          } finally {
            setUploadingImage(false);
          }
        } else {
          Alert.alert('Lỗi', 'Không thể lấy dữ liệu ảnh');
        }
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
        quality: 0.7,
        base64: true, // Bật base64 để lấy dữ liệu trực tiếp
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = asset.uri;
        setImage(imageUri);

        // Lấy base64 data trực tiếp từ ImagePicker
        if (asset.base64) {
          setUploadingImage(true);
          try {
            // Tạo data URL với MIME type phù hợp
            const fileExtension = imageUri.split('.').pop() || 'jpg';
            const mimeType = `image/${fileExtension}`;
            const dataURL = `data:${mimeType};base64,${asset.base64}`;

            setFormData((prev) => ({
              ...prev,
              imageBase64: dataURL,
            }));

            console.log('Base64 image saved successfully');
          } finally {
            setUploadingImage(false);
          }
        } else {
          Alert.alert('Lỗi', 'Không thể lấy dữ liệu ảnh');
        }
      }
    } catch (error) {
      console.error('Lỗi khi chụp ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  // Kiểm tra form trước khi lưu
  const validateForm = () => {
    console.log('=== VALIDATEFORM ===');
    console.log('formData để validate:', JSON.stringify(formData, null, 2));

    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập tên vật tư';
      console.log('Lỗi: Thiếu tên vật tư');
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Vui lòng nhập mã vật tư';
      console.log('Lỗi: Thiếu mã vật tư');
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Vui lòng chọn danh mục';
      console.log('Lỗi: Thiếu categoryId');
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Vui lòng chọn đơn vị tính';
      console.log('Lỗi: Thiếu đơn vị tính');
    }

    console.log('Các lỗi validation:', newErrors);
    console.log('Kết quả validation:', Object.keys(newErrors).length === 0);

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Lưu vật tư mới
  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Log dữ liệu trước khi gửi
      console.log('=== DỮ LIỆU VẬT TƯ TRƯỚC KHI GỬI ===');
      console.log('formData:', JSON.stringify(formData, null, 2));
      console.log('selectedCategory:', selectedCategory);
      console.log('=== END DỮ LIỆU ===');

      // Kiểm tra dữ liệu bắt buộc
      if (
        !formData.name ||
        !formData.code ||
        !formData.categoryId ||
        !formData.unit
      ) {
        const missingFields = [];
        if (!formData.name) missingFields.push('Tên vật tư');
        if (!formData.code) missingFields.push('Mã vật tư');
        if (!formData.categoryId) missingFields.push('Danh mục');
        if (!formData.unit) missingFields.push('Đơn vị tính');

        throw new Error(
          `Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`
        );
      }

      // Thêm vật tư mới sử dụng useInventory hook để đảm bảo refresh
      // Ảnh đã được lưu trực tiếp vào formData.imageBase64, không cần upload riêng
      console.log('Bắt đầu gọi addInventoryItem...');
      const result = await addInventoryItem(formData);
      console.log('Kết quả addInventoryItem:', result);

      Alert.alert('Thành công', 'Đã thêm vật tư mới vào kho', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('=== LỖI CHI TIẾT KHI LƯU VẬT TƯ ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      console.error('=== END LỖI CHI TIẾT ===');

      let errorMessage = 'Không thể lưu vật tư';

      if (error.code === 'unauthenticated') {
        errorMessage = 'Bạn cần đăng nhập để thực hiện chức năng này';
      } else if (error.code === 'invalid-argument') {
        errorMessage = error.message || 'Dữ liệu không hợp lệ';
      } else if (error.code === 'already-exists') {
        errorMessage = error.message || 'Mã vật tư đã tồn tại';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Đã xóa header thứ 2 - chỉ giữ lại nội dung form */}

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
          label="Số lượng ban đầu"
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
          {formData.imageBase64 ? (
            <Image
              source={{ uri: formData.imageBase64 }}
              style={styles.image}
            />
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
              loading={uploadingImage}
              disabled={uploadingImage}
            >
              Chọn ảnh
            </Button>
            <Button
              mode="outlined"
              onPress={takePhoto}
              style={styles.imageButton}
              loading={uploadingImage}
              disabled={uploadingImage}
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
          loading={loading}
          disabled={loading}
        >
          Lưu vật tư
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

export default AddInventoryItemScreen;
