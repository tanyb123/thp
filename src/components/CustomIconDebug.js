import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

/**
 * Component debug để kiểm tra custom icons
 */
const CustomIconDebug = () => {
  const [customIcons, setCustomIcons] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    loadAndDebugIcons();
  }, []);

  const loadAndDebugIcons = async () => {
    try {
      // Load custom icons
      const saved = await AsyncStorage.getItem('customIconFiles');
      if (saved) {
        const icons = JSON.parse(saved);
        setCustomIcons(icons);

        // Debug each icon
        let debugText = `Found ${icons.length} custom icons:\n\n`;

        for (const icon of icons) {
          debugText += `Icon: ${icon.name}\n`;
          debugText += `ID: ${icon.id}\n`;
          debugText += `URI: ${icon.uri}\n`;

          // Check if file exists
          const fileInfo = await FileSystem.getInfoAsync(icon.uri);
          debugText += `File exists: ${fileInfo.exists}\n`;
          debugText += `File size: ${fileInfo.size || 'N/A'} bytes\n`;
          debugText += `File type: ${
            fileInfo.isDirectory ? 'Directory' : 'File'
          }\n`;
          debugText += `---\n`;
        }

        setDebugInfo(debugText);
      } else {
        setDebugInfo('No custom icons found in AsyncStorage');
      }
    } catch (error) {
      setDebugInfo(`Error loading icons: ${error.message}`);
    }
  };

  const clearAllCustomIcons = async () => {
    Alert.alert('Xác nhận', 'Bạn có muốn xóa tất cả custom icons để debug?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa tất cả',
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete all files
            for (const icon of customIcons) {
              await FileSystem.deleteAsync(icon.uri, { idempotent: true });
            }

            // Clear AsyncStorage
            await AsyncStorage.removeItem('customIconFiles');
            await AsyncStorage.removeItem('customStageIcons');

            setCustomIcons([]);
            setDebugInfo('All custom icons cleared');

            Alert.alert('Thành công', 'Đã xóa tất cả custom icons');
          } catch (error) {
            Alert.alert('Lỗi', `Không thể xóa: ${error.message}`);
          }
        },
      },
    ]);
  };

  const renderIcon = (icon) => (
    <View key={icon.id} style={styles.iconContainer}>
      <Text style={styles.iconTitle}>{icon.name}</Text>
      <View style={styles.iconPreview}>
        <Image
          source={{ uri: icon.uri }}
          style={styles.iconImage}
          onError={(error) => {
            console.error('Image load error:', error);
          }}
          onLoad={() => {
            console.log('Image loaded successfully:', icon.uri);
          }}
        />
      </View>
      <Text style={styles.iconUri} numberOfLines={2}>
        {icon.uri}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Custom Icon Debug</Text>
        <TouchableOpacity
          onPress={loadAndDebugIcons}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.debugSection}>
        <Text style={styles.debugTitle}>Debug Info:</Text>
        <Text style={styles.debugText}>{debugInfo}</Text>
      </View>

      <View style={styles.iconsSection}>
        <Text style={styles.sectionTitle}>Custom Icons Preview:</Text>
        {customIcons.map(renderIcon)}
      </View>

      <TouchableOpacity
        onPress={clearAllCustomIcons}
        style={styles.clearButton}
      >
        <Text style={styles.clearButtonText}>Clear All Custom Icons</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  debugSection: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  iconsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  iconContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  iconTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  iconPreview: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconImage: {
    width: 48,
    height: 48,
    backgroundColor: '#ddd',
    borderRadius: 4,
  },
  iconUri: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CustomIconDebug;

































































































































