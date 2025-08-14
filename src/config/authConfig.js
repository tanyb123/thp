//src/config/authConfig.js
// Cấu hình xác thực cho các dịch vụ bên ngoài
export const googleAuthConfig = {
  // Thay thế các giá trị này bằng Client ID thực tế của bạn
  iosClientId:
    '370615243912-o6d5f9a9l5vbui1o1gcnd5t0lbkru9is.apps.googleusercontent.com',
  androidClientId:
    '370615243912-v7btvdq1e1b4min5snq7av9jpoe7lr10.apps.googleusercontent.com',
  webClientId:
    '370615243912-fesvpqtf06r7ugj31ma1urmrii85m7at.apps.googleusercontent.com',
  offlineAccess: true,

  // Các scopes mặc định cho Google Drive
  driveScopes: [
    'https://www.googleapis.com/auth/drive.file', // Cho phép app tạo và quản lý các file do app tạo
    // Nếu cần rộng hơn: 'https://www.googleapis.com/auth/drive'
  ],

  // Các scopes mặc định cho Google Sheets
  sheetsScopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
};

// Hàm helper để log chi tiết lỗi Google API
export const logGoogleApiError = (error, context = '') => {
  console.error(`Google API Error ${context ? `(${context})` : ''}:`, error);

  // Log thông tin chi tiết hơn nếu có
  if (error.response) {
    console.error('Error response:', {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
    });
  }

  // Log thông tin request nếu có
  if (error.config) {
    console.error('Request config:', {
      url: error.config.url,
      method: error.config.method,
      headers: error.config.headers,
      params: error.config.params,
    });
  }

  return error;
};
