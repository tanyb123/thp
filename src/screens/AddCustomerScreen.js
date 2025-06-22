//src/screens/AddCustomerScreen.js
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createCustomer } from '../api/customerService';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import StyledTextInput from '../components/StyledTextInput';

const AddCustomerScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    type: 'regular', // mặc định là khách hàng thường xuyên
    taxCode: '',
  });

  // Refs cho các input để điều hướng focus
  const contactPersonRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const addressRef = useRef(null);
  const taxCodeRef = useRef(null);

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

  // Xử lý lưu khách hàng
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      // Gọi API tạo khách hàng mới
      await createCustomer(formData, currentUser?.uid);

      Alert.alert('Thành công', 'Đã thêm khách hàng mới thành công', [
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
        console.error('Lỗi khi thêm khách hàng:', error);
        Alert.alert('Lỗi', 'Không thể thêm khách hàng. Vui lòng thử lại sau.');
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thêm khách hàng mới</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StyledTextInput
            label="Tên công ty / Tổ chức"
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
            placeholder="Nhập tên công ty hoặc tổ chức"
            required={true}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => contactPersonRef.current.focus()}
          />

          <StyledTextInput
            ref={contactPersonRef}
            label="Người liên hệ"
            value={formData.contactPerson}
            onChangeText={(text) => handleChange('contactPerson', text)}
            placeholder="Nhập tên người liên hệ"
            required={true}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => phoneRef.current.focus()}
          />

          <StyledTextInput
            ref={phoneRef}
            label="Số điện thoại"
            value={formData.phone}
            onChangeText={(text) => handleChange('phone', text)}
            placeholder="Nhập số điện thoại"
            keyboardType="phone-pad"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current.focus()}
          />

          <StyledTextInput
            ref={emailRef}
            label="Email"
            value={formData.email}
            onChangeText={(text) => handleChange('email', text)}
            placeholder="Nhập địa chỉ email"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => addressRef.current.focus()}
          />

          <StyledTextInput
            ref={addressRef}
            label="Địa chỉ"
            value={formData.address}
            onChangeText={(text) => handleChange('address', text)}
            placeholder="Nhập địa chỉ"
            multiline
            numberOfLines={3}
            inputStyle={styles.textArea}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => taxCodeRef.current.focus()}
          />

          <StyledTextInput
            ref={taxCodeRef}
            label="Mã số thuế"
            value={formData.taxCode}
            onChangeText={(text) => handleChange('taxCode', text)}
            placeholder="Nhập mã số thuế"
            returnKeyType="done"
          />

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
                    formData.type === 'regular' &&
                      styles.selectedTypeButtonText,
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

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color="#fff"
                  style={styles.saveIcon}
                />
                <Text style={styles.saveButtonText}>Lưu khách hàng</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
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
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  required: {
    color: '#e74c3c',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  typeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  selectedTypeButton: {
    backgroundColor: '#0066cc',
  },
  typeButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  selectedTypeButtonText: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 30,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveIcon: {
    marginRight: 8,
  },
});

export default AddCustomerScreen;
