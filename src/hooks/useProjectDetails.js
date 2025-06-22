//src/hooks/useProjectDetails.js
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getProjectById } from '../api/projectService';

export const useProjectDetails = (projectId) => {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjectById(projectId);

      if (data) {
        setProject(data);
      } else {
        setError('Không tìm thấy thông tin dự án');
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin dự án:', err);
      setError('Không thể tải thông tin dự án. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch when the component mounts
  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [fetchProjectData, projectId]);

  // Re-fetch when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (projectId) {
        fetchProjectData();
      }
    }, [fetchProjectData, projectId])
  );

  return { project, loading, error, fetchProjectData };
};
