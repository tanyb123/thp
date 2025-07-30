// src/screens/AddSupplierScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addSupplier } from '../api/supplierService';
import { useAuth } from '../contexts/AuthContext';

const MATERIAL_CATEGORIES = [
  'Thép tấm',
  'Nhôm',
  'Nước',
  'Sơn',
  'Khí hàn',
  'Vật liệu hoàn thiện',
  'Sắt',
  'Inox',
  'Ống',
  'Thép hình',
  'Long đền',
  'Phụ kiện',
  'Dụng cụ hàn',
  'Thiết bị đo đạc',
  'Khác',
];

const AddSupplierScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    bankAccount: '',
    bankName: '',
    description: '',
    categories: [],
    verified: false,
    createdBy: currentUser?.uid || '',
    createdByName: currentUser?.displayName || currentUser?.email || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when field is edited
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const toggleCategory = (category) => {
    setFormData((prev) => {
      const updatedCategories = [...prev.categories];

      if (updatedCategories.includes(category)) {
        // Remove category if already selected
        return {
          ...prev,
          categories: updatedCategories.filter((c) => c !== category),
        };
      } else {
        // Add category if not selected
        return {
          ...prev,
          categories: [...updatedCategories, category],
        };
      }
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập tên nhà cung cấp';
    }

    if (formData.phone && !/^[0-9]{10,11}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Số điện thoại không hợp lệ';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email.trim())) {
      newErrors.email = 'Email không hợp lệ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Lỗi', 'Vui lòng kiểm tra lại thông tin nhập');
      return;
    }

    setSaving(true);
    try {
      await addSupplier(formData);
      Alert.alert('Thành công', 'Đã thêm nhà cung cấp mới', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Lỗi khi thêm nhà cung cấp:', error);
      Alert.alert('Lỗi', 'Không thể thêm nhà cung cấp. Vui lòng thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thêm nhà cung cấp mới</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Tên nhà cung cấp <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => handleChange('name', text)}
              placeholder="Nhập tên nhà cung cấp"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Người liên hệ</Text>
            <TextInput
              style={styles.input}
              value={formData.contactName}
              onChangeText={(text) => handleChange('contactName', text)}
              placeholder="Nhập tên người liên hệ"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={formData.phone}
              onChangeText={(text) => handleChange('phone', text)}
              placeholder="Nhập số điện thoại"
              keyboardType="phone-pad"
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => handleChange('email', text)}
              placeholder="Nhập địa chỉ email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Địa chỉ</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => handleChange('address', text)}
              placeholder="Nhập địa chỉ"
              multiline
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mã số thuế</Text>
            <TextInput
              style={styles.input}
              value={formData.taxCode}
              onChangeText={(text) => handleChange('taxCode', text)}
              placeholder="Nhập mã số thuế"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Tài khoản ngân hàng</Text>
            <TextInput
              style={styles.input}
              value={formData.bankAccount}
              onChangeText={(text) => handleChange('bankAccount', text)}
              placeholder="Nhập số tài khoản"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Tên ngân hàng</Text>
            <TextInput
              style={styles.input}
              value={formData.bankName}
              onChangeText={(text) => handleChange('bankName', text)}
              placeholder="Nhập tên ngân hàng"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Danh mục vật tư cung cấp</Text>
            <View style={styles.categoriesContainer}>
              {MATERIAL_CATEGORIES.map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.categoryTag,
                    formData.categories.includes(category) &&
                      styles.categoryTagSelected,
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      formData.categories.includes(category) &&
                        styles.categoryTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mô tả</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => handleChange('description', text)}
              placeholder="Nhập mô tả về nhà cung cấp"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.verifiedContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleChange('verified', !formData.verified)}
            >
              <View
                style={[
                  styles.checkbox,
                  formData.verified && styles.checkboxChecked,
                ]}
              >
                {formData.verified && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Đã xác minh</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Lưu nhà cung cấp</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  required: {
    color: 'red',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryTagSelected: {
    backgroundColor: '#e6f2ff',
    borderWidth: 1,
    borderColor: '#0066cc',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextSelected: {
    color: '#0066cc',
    fontWeight: '500',
  },
  verifiedContainer: {
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddSupplierScreen;
