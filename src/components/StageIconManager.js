import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  STAGE_ICONS,
  AVAILABLE_ICONS,
  getStageIcon,
} from '../utils/stageIcons';

/**
 * Component để quản lý và thay đổi icon cho các stage
 */
const StageIconManager = ({
  visible,
  onClose,
  onIconSelect,
  currentProcessKey,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('tools');
  const [selectedIcon, setSelectedIcon] = useState(
    getStageIcon(currentProcessKey)
  );
  const [customIcons, setCustomIcons] = useState([]);
  const [isCustomIcon, setIsCustomIcon] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

  const categories = [...Object.keys(AVAILABLE_ICONS), 'custom'];

  // Load custom icons khi component mount
  useEffect(() => {
    loadCustomIcons();
  }, []);

  const loadCustomIcons = async () => {
    try {
      const saved = await AsyncStorage.getItem('customIconFiles');
      if (saved) {
        setCustomIcons(JSON.parse(saved));
        // Reset image errors khi load lại
        setImageErrors({});
      }
    } catch (error) {
      console.error('Error loading custom icons:', error);
    }
  };

  const saveCustomIcons = async (icons) => {
    try {
      await AsyncStorage.setItem('customIconFiles', JSON.stringify(icons));
      setCustomIcons(icons);
    } catch (error) {
      console.error('Error saving custom icons:', error);
    }
  };

  const handleIconSelect = (iconName, isCustom = false) => {
    setSelectedIcon(iconName);
    setIsCustomIcon(isCustom);
  };

  const uploadCustomIcon = async () => {
    try {
      // Request permission
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh để upload icon');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
        base64: false, // Không cần base64, dùng URI trực tiếp
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Create unique filename
        const timestamp = Date.now();
        const filename = `custom_icon_${timestamp}.png`;
        const fileUri = `${FileSystem.documentDirectory}${filename}`;

        // Copy image to app's document directory
        await FileSystem.copyAsync({
          from: asset.uri,
          to: fileUri,
        });

        // Verify file exists
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        console.log('File info:', fileInfo);

        // Add to custom icons list
        const newIcon = {
          id: timestamp.toString(),
          name: `Custom ${customIcons.length + 1}`,
          uri: fileUri,
          filename: filename,
          originalUri: asset.uri, // Keep original for debugging
        };

        console.log('New custom icon:', newIcon);

        const updatedIcons = [...customIcons, newIcon];
        await saveCustomIcons(updatedIcons);

        Alert.alert(
          'Thành công',
          `Đã upload icon tùy chỉnh!\nFile: ${filename}`
        );

        // Switch to custom category to show the new icon
        setSelectedCategory('custom');
      }
    } catch (error) {
      console.error('Error uploading custom icon:', error);
      Alert.alert('Lỗi', 'Không thể upload icon. Vui lòng thử lại.');
    }
  };

  const deleteCustomIcon = async (iconId) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa icon này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            const iconToDelete = customIcons.find((icon) => icon.id === iconId);
            if (iconToDelete) {
              // Delete file from storage
              await FileSystem.deleteAsync(iconToDelete.uri, {
                idempotent: true,
              });

              // Remove from list
              const updatedIcons = customIcons.filter(
                (icon) => icon.id !== iconId
              );
              await saveCustomIcons(updatedIcons);

              Alert.alert('Thành công', 'Đã xóa icon tùy chỉnh!');
            }
          } catch (error) {
            console.error('Error deleting custom icon:', error);
            Alert.alert('Lỗi', 'Không thể xóa icon.');
          }
        },
      },
    ]);
  };

  const handleConfirm = () => {
    if (isCustomIcon) {
      // For custom icons, pass the full icon object
      const customIcon = customIcons.find((icon) => icon.id === selectedIcon);
      onIconSelect(currentProcessKey, customIcon, true);
    } else {
      // For regular icons, pass the icon name
      onIconSelect(currentProcessKey, selectedIcon, false);
    }
    onClose();
  };

  const renderIconItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.iconItem,
        selectedIcon === item && styles.selectedIconItem,
      ]}
      onPress={() => handleIconSelect(item, false)}
    >
      <Ionicons
        name={item}
        size={24}
        color={selectedIcon === item ? '#007AFF' : '#666'}
      />
      <Text style={styles.iconName}>{item}</Text>
    </TouchableOpacity>
  );

  const renderCustomIconItem = ({ item }) => {
    const hasError = imageErrors[item.id];

    return (
      <TouchableOpacity
        style={[
          styles.iconItem,
          selectedIcon === item.id && styles.selectedIconItem,
        ]}
        onPress={() => handleIconSelect(item.id, true)}
      >
        {!hasError ? (
          <Image
            source={{ uri: item.uri }}
            style={styles.customIconImage}
            onError={(error) => {
              console.error('Error loading custom icon:', error);
              setImageErrors((prev) => ({ ...prev, [item.id]: true }));
            }}
            onLoad={() => {
              console.log('Custom icon loaded successfully:', item.uri);
              setImageErrors((prev) => ({ ...prev, [item.id]: false }));
            }}
          />
        ) : (
          <View style={styles.fallbackIconContainer}>
            <Ionicons name="image-outline" size={20} color="#999" />
          </View>
        )}
        <Text style={styles.iconName}>{item.name}</Text>
        <TouchableOpacity
          style={styles.deleteIconButton}
          onPress={() => deleteCustomIcon(item.id)}
        >
          <Ionicons name="close-circle" size={16} color="#FF6B6B" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderCategoryButton = (category) => {
    const categoryLabel = category === 'custom' ? 'Tùy chỉnh' : category;

    return (
      <TouchableOpacity
        key={category}
        style={[
          styles.categoryButton,
          selectedCategory === category && styles.selectedCategoryButton,
        ]}
        onPress={() => setSelectedCategory(category)}
      >
        <Text
          style={[
            styles.categoryText,
            selectedCategory === category && styles.selectedCategoryText,
          ]}
        >
          {categoryLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Chọn Icon cho {currentProcessKey}</Text>
          <TouchableOpacity onPress={handleConfirm}>
            <Text style={styles.confirmButton}>Xác nhận</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Xem trước:</Text>
          <View style={styles.previewIcon}>
            <Ionicons name={selectedIcon} size={40} color="#007AFF" />
          </View>
          <Text style={styles.previewText}>{selectedIcon}</Text>
        </View>

        <View style={styles.categoriesContainer}>
          <Text style={styles.sectionTitle}>Danh mục:</Text>
          <View style={styles.categoriesRow}>
            {categories.map(renderCategoryButton)}
          </View>
        </View>

        <View style={styles.iconsContainer}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'custom'
                ? 'Icons tùy chỉnh:'
                : `Icons trong danh mục "${selectedCategory}":`}
            </Text>
            {selectedCategory === 'custom' && (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={uploadCustomIcon}
              >
                <Ionicons name="add-circle" size={24} color="#007AFF" />
                <Text style={styles.uploadButtonText}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>

          {selectedCategory === 'custom' ? (
            customIcons.length > 0 ? (
              <FlatList
                data={customIcons}
                renderItem={renderCustomIconItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={styles.iconsList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Chưa có icon tùy chỉnh</Text>
                <Text style={styles.emptySubText}>
                  Bấm nút "Upload" để thêm icon của bạn
                </Text>
              </View>
            )
          ) : (
            <FlatList
              data={AVAILABLE_ICONS[selectedCategory]}
              renderItem={renderIconItem}
              keyExtractor={(item) => item}
              numColumns={3}
              contentContainerStyle={styles.iconsList}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    color: '#666',
    fontSize: 16,
  },
  confirmButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  previewLabel: {
    fontSize: 16,
    marginBottom: 10,
  },
  previewIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewText: {
    fontSize: 12,
    color: '#666',
  },
  categoriesContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  selectedCategoryButton: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  selectedCategoryText: {
    color: '#fff',
  },
  iconsContainer: {
    flex: 1,
    padding: 16,
  },
  iconsList: {
    paddingBottom: 20,
  },
  iconItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    margin: 4,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedIconItem: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  iconName: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    color: '#666',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
  },
  uploadButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  customIconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    borderRadius: 4,
  },
  fallbackIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  deleteIconButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default StageIconManager;
