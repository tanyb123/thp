//src/components/StatusIndicator.js
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

/**
 * Component hiển thị trạng thái công việc dưới dạng hình tròn có màu sắc
 * @param {Object} props - Props của component
 * @param {string} props.status - Trạng thái công việc (pending, in_progress, completed)
 * @param {number} props.size - Kích thước của hình tròn (mặc định: 16)
 * @returns {React.Component} StatusIndicator component
 */
const StatusIndicator = ({ status, size = 16 }) => {
  // Xác định màu sắc dựa trên trạng thái
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return '#4CAF50'; // Xanh lá
      case 'in_progress':
        return '#FFC107'; // Vàng
      case 'pending':
        return '#FF9800'; // Cam
      default:
        return '#9E9E9E'; // Xám
    }
  };

  return (
    <View
      style={[
        styles.indicator,
        {
          backgroundColor: getStatusColor(),
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  indicator: {
    // Đổ bóng cho iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    // Đổ bóng cho Android
    elevation: 4,
    // Các style khác
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
});

export default StatusIndicator;
