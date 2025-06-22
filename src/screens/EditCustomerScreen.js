//src/screens/EditCustomerScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateCustomer } from '../api/customerService';
import { useAuth } from '../contexts/AuthContext';

const EditCustomerScreen = ({ route, navigation }) => {
  const { customer } = route.params;
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: customer.name || '',
    contactPerson: customer.contactPerson || '',
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    type: customer.type || 'regular',
    taxCode: customer.taxCode || '',
  });

  // Cập nhật giá trị form
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Kiểm tra form hợp lệ
  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên khách hàng');
      return false;
    }

    if (!formData.contactPerson.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên người liên hệ');
      return false;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Alert.alert('Lỗi', 'Email không hợp lệ');
      return false;
    }

    return true;
  };

  // Xử lý cập nhật khách hàng
  const handleUpdate = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Gọi API cập nhật thông tin khách hàng
      await updateCustomer(customer.id, formData, currentUser?.uid);

      Alert.alert('Thành công', 'Đã cập nhật thông tin khách hàng thành công', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      if (error.code === 'permission-denied') {
        Alert.alert(
          'Lỗi quyền',
          'Bạn không có đủ quyền để thực hiện hành động này.'
        );
      } else {
        console.error('Lỗi khi cập nhật khách hàng:', error);
        Alert.alert(
          'Lỗi',
          'Không thể cập nhật thông tin khách hàng. Vui lòng thử lại sau.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý thay đổi loại khách hàng
  const handleSelectType = (type) => {
    handleChange('type', type);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chỉnh sửa thông tin khách hàng</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Tên công ty / Tổ chức <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
            placeholder="Nhập tên công ty hoặc tổ chức"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Người liên hệ <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.contactPerson}
            onChangeText={(text) => handleChange('contactPerson', text)}
            placeholder="Nhập tên người liên hệ"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(text) => handleChange('phone', text)}
            placeholder="Nhập số điện thoại"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(text) => handleChange('email', text)}
            placeholder="Nhập địa chỉ email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Địa chỉ</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.address}
            onChangeText={(text) => handleChange('address', text)}
            placeholder="Nhập địa chỉ"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mã số thuế</Text>
          <TextInput
            style={styles.input}
            value={formData.taxCode}
            onChangeText={(text) => handleChange('taxCode', text)}
            placeholder="Nhập mã số thuế"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Loại khách hàng</Text>
          <View style={styles.typeButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                formData.type === 'potential' && styles.selectedTypeButton,
              ]}
              onPress={() => handleSelectType('potential')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  formData.type === 'potential' &&
                    styles.selectedTypeButtonText,
                ]}
              >
                Tiềm năng
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                formData.type === 'regular' && styles.selectedTypeButton,
              ]}
              onPress={() => handleSelectType('regular')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  formData.type === 'regular' && styles.selectedTypeButtonText,
                ]}
              >
                Thường xuyên
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                formData.type === 'vip' && styles.selectedTypeButton,
              ]}
              onPress={() => handleSelectType('vip')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  formData.type === 'vip' && styles.selectedTypeButtonText,
                ]}
              >
                VIP
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleUpdate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  selectedTypeButton: {
    backgroundColor: '#0066cc',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedTypeButtonText: {
    color: '#fff',
  },
  footer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default EditCustomerScreen;
