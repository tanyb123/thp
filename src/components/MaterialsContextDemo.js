import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useMaterialsContext } from '../hooks/useMaterialsContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * Component demo để test function getAutoMaterialsContext
 * Hiển thị thông tin vật tư từ báo giá hoặc file Excel
 */
const MaterialsContextDemo = ({ project }) => {
  const {
    materialsContext,
    isLoading,
    error,
    hasMaterialsContext,
    materialsSource,
    materialsCount,
    materialsList,
    isFromQuotation,
    isFromExcel,
    hasNoData,
    fetchMaterialsContext,
    refreshContext,
    clearCache,
  } = useMaterialsContext(project);

  const [accessToken, setAccessToken] = useState(null);

  // Lấy access token khi component mount
  useEffect(() => {
    const getToken = async () => {
      try {
        const isSignedIn = await GoogleSignin.isSignedIn();
        if (isSignedIn) {
          const tokens = await GoogleSignin.getTokens();
          setAccessToken(tokens.accessToken);
        }
      } catch (error) {
        console.error('Lỗi khi lấy access token:', error);
      }
    };

    getToken();
  }, []);

  // Tự động fetch context khi có project
  useEffect(() => {
    if (project && accessToken) {
      fetchMaterialsContext(accessToken);
    }
  }, [project, accessToken, fetchMaterialsContext]);

  const handleFetchContext = async () => {
    try {
      await fetchMaterialsContext(accessToken);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lấy context vật tư: ' + error.message);
    }
  };

  const handleRefreshContext = async () => {
    try {
      await refreshContext(accessToken);
      Alert.alert('Thành công', 'Đã refresh context vật tư');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể refresh context: ' + error.message);
    }
  };

  const handleClearCache = () => {
    clearCache();
    Alert.alert('Thành công', 'Đã xóa cache');
  };

  const renderMaterialsList = () => {
    if (!materialsList || materialsList.length === 0) {
      return <Text style={styles.noData}>Không có danh sách vật tư</Text>;
    }

    return (
      <View style={styles.materialsList}>
        <Text style={styles.sectionTitle}>
          Danh sách vật tư ({materialsList.length}):
        </Text>
        {materialsList.slice(0, 10).map((item, index) => (
          <View key={index} style={styles.materialItem}>
            <Text style={styles.materialName}>
              {index + 1}. {item.name || item.materialName || 'Không có tên'}
            </Text>
            {item.code && (
              <Text style={styles.materialCode}>Mã: {item.code}</Text>
            )}
            {item.quantity && (
              <Text style={styles.materialQuantity}>
                SL: {item.quantity} {item.unit || ''}
              </Text>
            )}
            {item.price && (
              <Text style={styles.materialPrice}>Giá: {item.price}</Text>
            )}
          </View>
        ))}
        {materialsList.length > 10 && (
          <Text style={styles.moreItems}>
            ... và {materialsList.length - 10} vật tư khác
          </Text>
        )}
      </View>
    );
  };

  const renderContextInfo = () => {
    if (!materialsContext) {
      return <Text style={styles.noData}>Chưa có context vật tư</Text>;
    }

    return (
      <View style={styles.contextInfo}>
        <Text style={styles.sectionTitle}>Thông tin Context:</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nguồn dữ liệu:</Text>
          <Text style={styles.infoValue}>
            {materialsSource === 'quotation'
              ? 'Báo giá mới nhất'
              : materialsSource === 'excel'
              ? 'File Excel Google Drive'
              : 'Không có dữ liệu'}
          </Text>
        </View>

        {materialsCount > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số lượng vật tư:</Text>
            <Text style={styles.infoValue}>{materialsCount}</Text>
          </View>
        )}

        {isFromQuotation && materialsContext.materialsData && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mã báo giá:</Text>
              <Text style={styles.infoValue}>
                {materialsContext.materialsData.quotationNumber ||
                  materialsContext.materialsData.quotationId}
              </Text>
            </View>
            {materialsContext.materialsData.totalAmount && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tổng giá trị:</Text>
                <Text style={styles.infoValue}>
                  {materialsContext.materialsData.totalAmount.toLocaleString(
                    'vi-VN'
                  )}{' '}
                  VNĐ
                </Text>
              </View>
            )}
          </>
        )}

        {isFromExcel && materialsContext.materialsData && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tên file:</Text>
              <Text style={styles.infoValue}>
                {materialsContext.materialsData.fileName}
              </Text>
            </View>
            {materialsContext.materialsData.lastModified && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cập nhật lúc:</Text>
                <Text style={styles.infoValue}>
                  {new Date(
                    materialsContext.materialsData.lastModified
                  ).toLocaleString('vi-VN')}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>
          Vui lòng chọn dự án để xem context vật tư
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Demo Context Vật Tư</Text>
        <Text style={styles.subtitle}>Dự án: {project.name}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleFetchContext}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Lấy Context</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleRefreshContext}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={handleClearCache}
        >
          <Text style={styles.buttonText}>Xóa Cache</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Lỗi: {error}</Text>
        </View>
      )}

      {renderContextInfo()}
      {renderMaterialsList()}

      <View style={styles.status}>
        <Text style={styles.statusText}>
          Trạng thái: {hasMaterialsContext ? 'Có dữ liệu' : 'Không có dữ liệu'}
        </Text>
        <Text style={styles.statusText}>Nguồn: {materialsSource}</Text>
        <Text style={styles.statusText}>Số lượng: {materialsCount}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D70015',
    textAlign: 'center',
  },
  contextInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  materialsList: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  materialItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
  },
  materialName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  materialCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  materialQuantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  materialPrice: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  moreItems: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  status: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  noData: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  error: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    padding: 20,
  },
});

export default MaterialsContextDemo;




















































