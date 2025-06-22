import React, { forwardRef } from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Component TextInput tùy chỉnh và nhất quán cho toàn bộ ứng dụng
 * @param {Object} props - Props của component
 * @param {string} props.label - Nhãn cho trường nhập liệu
 * @param {string} props.iconName - Tên biểu tượng Ionicons (tùy chọn)
 * @param {string} props.error - Thông báo lỗi (tùy chọn)
 * @param {Object} props.containerStyle - Style cho container (tùy chọn)
 * @param {Object} props.inputStyle - Style cho input (tùy chọn)
 * @param {boolean} props.required - Đánh dấu trường bắt buộc (tùy chọn)
 * @returns {React.Component} StyledTextInput component
 */
const StyledTextInput = forwardRef(
  (
    {
      label,
      iconName,
      error,
      containerStyle,
      inputStyle,
      required = false,
      ...props
    },
    ref
  ) => {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.requiredMark}>*</Text>}
          </Text>
        )}

        <View
          style={[
            styles.inputContainer,
            error ? styles.inputContainerError : null,
          ]}
        >
          {iconName && (
            <Ionicons
              name={iconName}
              size={20}
              color="#666"
              style={styles.icon}
            />
          )}

          <TextInput
            ref={ref}
            style={[styles.input, inputStyle]}
            placeholderTextColor="#999"
            {...props}
          />

          {props.secureTextEntry !== undefined && (
            <View style={styles.rightIconContainer}>{props.rightIcon}</View>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  requiredMark: {
    color: '#e74c3c',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    height: 50,
    paddingHorizontal: 12,
  },
  inputContainerError: {
    borderColor: '#e74c3c',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  rightIconContainer: {
    paddingLeft: 8,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default StyledTextInput;
