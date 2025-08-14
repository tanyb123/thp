import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useCustomerImport } from '../hooks/useCustomerImport';

const CustomerImportScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const {
    driveFiles: files,
    isLoadingFiles: loading,
    isProcessingFile: importing,
    fetchCustomerFiles,
    importCustomersFromFile,
  } = useCustomerImport();
  const [selectedFile, setSelectedFile] = useState(null);

  // Tải danh sách file khi component mount
  useEffect(() => {
    fetchCustomerFiles();
  }, [fetchCustomerFiles]);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      Alert.alert('Lỗi', 'Vui lòng chọn file để import');
      return;
    }

    Alert.alert(
      'Xác nhận Import',
      `Bạn có chắc chắn muốn import khách hàng từ file "${selectedFile.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await importCustomersFromFile(
                selectedFile.id,
                selectedFile.name
              );

              if (result) {
                // Import thành công, quay lại màn hình trước
                navigation.goBack();
              }
            } catch (error) {
              console.error('Lỗi khi import:', error);
              // Error đã được xử lý trong hook
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const renderFileItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.fileItem,
        {
          backgroundColor: theme.card,
          borderColor:
            selectedFile?.id === item.id ? theme.primary : theme.border,
        },
      ]}
      onPress={() => handleFileSelect(item)}
    >
      <View style={styles.fileInfo}>
        <Ionicons name="document-outline" size={24} color={theme.primary} />
        <View style={styles.fileDetails}>
          <Text
            style={[styles.fileName, { color: theme.text }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <Text style={[styles.fileMeta, { color: theme.textSecondary }]}>
            {formatFileSize(item.size)} • {formatDate(item.modifiedTime)}
          </Text>
        </View>
      </View>
      {selectedFile?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Import Khách Hàng
        </Text>
        <TouchableOpacity onPress={fetchCustomerFiles} disabled={loading}>
          <Ionicons
            name="refresh"
            size={24}
            color={loading ? theme.textMuted : theme.text}
          />
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View
        style={[
          styles.instructions,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.instructionsTitle, { color: theme.text }]}>
          Hướng dẫn Import
        </Text>
        <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
          • Cột A: Tên công ty{'\n'}• Cột B: Mã số thuế{'\n'}• Cột C: Địa chỉ
          {'\n'}• Cột D: Email{'\n'}• File Excel phải có tên chứa từ "customer"
        </Text>
      </View>

      {/* File List */}
      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Chọn File Excel
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Đang tải danh sách file...
            </Text>
          </View>
        ) : files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={60}
              color={theme.textMuted}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Không tìm thấy file customer nào
            </Text>
            <TouchableOpacity
              style={[styles.refreshButton, { borderColor: theme.border }]}
              onPress={fetchCustomerFiles}
            >
              <Ionicons name="refresh" size={16} color={theme.primary} />
              <Text style={[styles.refreshText, { color: theme.primary }]}>
                Thử lại
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={files}
            renderItem={renderFileItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.fileList}
          />
        )}
      </View>

      {/* Import Button */}
      {selectedFile && (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.importButton,
              { backgroundColor: theme.primary },
              importing && styles.importButtonDisabled,
            ]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={20} color="white" />
            )}
            <Text style={styles.importButtonText}>
              {importing ? 'Đang Import...' : 'Import Khách Hàng'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructions: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  refreshText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  fileList: {
    gap: 12,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileMeta: {
    fontSize: 12,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default CustomerImportScreen;
