import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Component test đơn giản để kiểm tra app không crash
 */
const TestComponent = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>✅ App đang hoạt động bình thường</Text>
      <Text style={styles.subText}>Không có lỗi hooks</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#666',
  },
});

export default TestComponent;

































































































































