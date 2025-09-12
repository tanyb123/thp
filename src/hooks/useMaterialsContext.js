import { useState, useCallback } from 'react';
import {
  getAutoMaterialsContext,
  getMaterialsContextForProject,
  refreshMaterialsContext,
} from '../api/aiChatService';

/**
 * Hook để quản lý context vật tư cho dự án
 * Tự động lấy vật tư từ báo giá mới nhất hoặc file Google Drive
 */
export const useMaterialsContext = (project) => {
  const [materialsContext, setMaterialsContext] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  /**
   * Lấy context vật tư cho dự án
   * @param {string} accessToken - Google access token (tùy chọn)
   * @param {boolean} forceRefresh - Bắt buộc refresh dữ liệu
   */
  const fetchMaterialsContext = useCallback(
    async (accessToken = null, forceRefresh = false) => {
      if (!project) {
        setError('Dự án không được để trống');
        return;
      }

      // Kiểm tra cache nếu không bắt buộc refresh
      if (!forceRefresh && materialsContext && lastUpdated) {
        const now = Date.now();
        const cacheAge = now - lastUpdated;
        // Cache trong 5 phút
        if (cacheAge < 5 * 60 * 1000) {
          console.log(
            'Sử dụng cache context vật tư (tuổi:',
            Math.round(cacheAge / 1000),
            'giây)'
          );
          return materialsContext;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getAutoMaterialsContext(project, accessToken);

        if (result.materialsContext) {
          setMaterialsContext(result);
          setLastUpdated(Date.now());
          console.log('Đã cập nhật context vật tư:', result.materialsSource);
        } else {
          setError('Không có dữ liệu vật tư');
        }

        return result;
      } catch (err) {
        const errorMessage =
          err.message || 'Có lỗi xảy ra khi lấy context vật tư';
        setError(errorMessage);
        console.error('Lỗi khi lấy context vật tư:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [project, materialsContext, lastUpdated]
  );

  /**
   * Refresh context vật tư (bắt buộc cập nhật)
   * @param {string} accessToken - Google access token (tùy chọn)
   */
  const refreshContext = useCallback(
    async (accessToken = null) => {
      return await fetchMaterialsContext(accessToken, true);
    },
    [fetchMaterialsContext]
  );

  /**
   * Lấy context vật tư với thông tin chi tiết
   * @param {string} accessToken - Google access token (tùy chọn)
   */
  const getDetailedContext = useCallback(
    async (accessToken = null) => {
      if (!project) {
        throw new Error('Dự án không được để trống');
      }

      try {
        const result = await getMaterialsContextForProject(
          project,
          accessToken
        );
        return result;
      } catch (err) {
        console.error('Lỗi khi lấy context chi tiết:', err);
        throw err;
      }
    },
    [project]
  );

  /**
   * Xóa cache context vật tư
   */
  const clearCache = useCallback(() => {
    setMaterialsContext(null);
    setLastUpdated(null);
    setError(null);
    console.log('Đã xóa cache context vật tư');
  }, []);

  /**
   * Kiểm tra xem có context vật tư hay không
   */
  const hasMaterialsContext = useCallback(() => {
    return materialsContext && materialsContext.materialsSource !== 'none';
  }, [materialsContext]);

  /**
   * Lấy thông tin nguồn dữ liệu vật tư
   */
  const getMaterialsSource = useCallback(() => {
    return materialsContext?.materialsSource || 'none';
  }, [materialsContext]);

  /**
   * Lấy số lượng vật tư
   */
  const getMaterialsCount = useCallback(() => {
    if (!materialsContext) return 0;

    switch (materialsContext.materialsSource) {
      case 'quotation':
        return materialsContext.materialsData?.materialsCount || 0;
      case 'excel':
        return materialsContext.materialsData?.materialsCount || 0;
      default:
        return 0;
    }
  }, [materialsContext]);

  /**
   * Lấy danh sách vật tư
   */
  const getMaterialsList = useCallback(() => {
    if (!materialsContext) return [];

    switch (materialsContext.materialsSource) {
      case 'quotation':
        return materialsContext.materialsData?.materials || [];
      case 'excel':
        return materialsContext.materialsData?.materials || [];
      default:
        return [];
    }
  }, [materialsContext]);

  return {
    // State
    materialsContext,
    isLoading,
    error,
    lastUpdated,

    // Actions
    fetchMaterialsContext,
    refreshContext,
    getDetailedContext,
    clearCache,

    // Computed values
    hasMaterialsContext: hasMaterialsContext(),
    materialsSource: getMaterialsSource(),
    materialsCount: getMaterialsCount(),
    materialsList: getMaterialsList(),

    // Helpers
    isFromQuotation: getMaterialsSource() === 'quotation',
    isFromExcel: getMaterialsSource() === 'excel',
    hasNoData: getMaterialsSource() === 'none',
  };
};

export default useMaterialsContext;




















































