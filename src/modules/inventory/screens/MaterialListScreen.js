/**
 * Màn hình danh sách vật liệu
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MaterialListScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Danh sách vật liệu</Text>
      <Text style={styles.subtitle}>Màn hình đang được phát triển</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

export default MaterialListScreen;
