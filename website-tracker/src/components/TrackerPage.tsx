import React, { useState, useEffect } from 'react';
import './TrackerPage.css';

interface WorkflowStage {
  processName: string;
  status: 'completed' | 'in-progress' | 'pending';
  order: number;
}

interface ProjectData {
  projectName: string;
  customerName: string;
  status: string;
  startDate: any;
  endDate: any;
  workflowStages: WorkflowStage[];
}

const TrackerPage: React.FC = () => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        // Get token from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
          setError('Token không hợp lệ hoặc không được cung cấp');
          setLoading(false);
          return;
        }

        // Cloud Function URL for project tracking
        const apiUrl = `https://asia-southeast1-tanyb-fe4bf.cloudfunctions.net/getProjectStatusByToken?token=${token}`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Không tìm thấy dự án với token này');
          } else {
            setError('Có lỗi xảy ra khi tải dữ liệu dự án');
          }
          setLoading(false);
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          setProjectData(result.data);
        } else {
          setError('Dữ liệu dự án không hợp lệ');
        }
      } catch (err) {
        setError('Không thể kết nối đến máy chủ');
        console.error('Error fetching project data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in-progress':
        return '⚙️';
      case 'pending':
        return '🕒';
      default:
        return '🕒';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in-progress':
        return '#FF9800';
      case 'pending':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Chưa xác định';

    try {
      if (date.toDate) {
        // Firestore Timestamp
        return date.toDate().toLocaleDateString('vi-VN');
      } else if (date instanceof Date) {
        return date.toLocaleDateString('vi-VN');
      } else {
        return new Date(date).toLocaleDateString('vi-VN');
      }
    } catch {
      return 'Chưa xác định';
    }
  };

  if (loading) {
    return (
      <div className="tracker-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Đang tải thông tin dự án...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tracker-container">
        <div className="error-container">
          <h2>❌ Lỗi</h2>
          <p>{error}</p>
          <p>
            Vui lòng kiểm tra lại link hoặc liên hệ với chúng tôi để được hỗ
            trợ.
          </p>
        </div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="tracker-container">
        <div className="error-container">
          <h2>❌ Không có dữ liệu</h2>
          <p>Không thể tải thông tin dự án.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-container">
      <div className="header">
        <h1>📊 Theo Dõi Tiến Độ Dự Án</h1>
        <div className="company-info">
          <h2>THP - Công Ty TNHH Thương Mại & Sản Xuất</h2>
        </div>
      </div>

      <div className="project-info">
        <div className="info-card">
          <h3>📋 Thông Tin Dự Án</h3>
          <div className="info-grid">
            <div className="info-item">
              <strong>Tên Dự Án:</strong>
              <span>{projectData.projectName}</span>
            </div>
            <div className="info-item">
              <strong>Khách Hàng:</strong>
              <span>{projectData.customerName}</span>
            </div>
            <div className="info-item">
              <strong>Trạng Thái:</strong>
              <span className={`status-badge status-${projectData.status}`}>
                {projectData.status === 'completed'
                  ? 'Hoàn Thành'
                  : projectData.status === 'in-progress'
                  ? 'Đang Thực Hiện'
                  : projectData.status === 'pending'
                  ? 'Chờ Xử Lý'
                  : projectData.status}
              </span>
            </div>
            <div className="info-item">
              <strong>Ngày Bắt Đầu:</strong>
              <span>{formatDate(projectData.startDate)}</span>
            </div>
            <div className="info-item">
              <strong>Ngày Kết Thúc:</strong>
              <span>{formatDate(projectData.endDate)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="workflow-section">
        <h3>🔄 Tiến Độ Công Việc</h3>
        <div className="timeline">
          {projectData.workflowStages.length > 0 ? (
            projectData.workflowStages.map((stage, index) => (
              <div key={index} className="timeline-item">
                <div
                  className="timeline-marker"
                  style={{ backgroundColor: getStatusColor(stage.status) }}
                >
                  {getStatusIcon(stage.status)}
                </div>
                <div className="timeline-content">
                  <h4>{stage.processName}</h4>
                  <div className="stage-status">
                    <span className={`status-badge status-${stage.status}`}>
                      {stage.status === 'completed'
                        ? 'Hoàn Thành'
                        : stage.status === 'in-progress'
                        ? 'Đang Thực Hiện'
                        : stage.status === 'pending'
                        ? 'Chờ Xử Lý'
                        : stage.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-stages">
              <p>Chưa có thông tin về các công đoạn sản xuất.</p>
            </div>
          )}
        </div>
      </div>

      <div className="footer">
        <p>© 2024 THP - Hệ thống theo dõi tiến độ dự án</p>
        <p>Liên hệ: info@thp.com.vn | Hotline: 1900-xxxx</p>
      </div>
    </div>
  );
};

export default TrackerPage;
