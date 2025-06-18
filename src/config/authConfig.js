// Cấu hình xác thực cho các dịch vụ bên ngoài
export const googleAuthConfig = {
  // Client IDs from google-services.json
  iosClientId: '370615243912-o6d5f9a9l5vbui1o1gcnd5t0lbkru9is.apps.googleusercontent.com',
  androidClientId: '370615243912-u3amg1jcun5sj91p827ubcl1d9fo6fod.apps.googleusercontent.com',
  webClientId: '370615243912-dba7q8srqj951u8864lf0cv0pku7n54n.apps.googleusercontent.com',
  
  // Các scopes mặc định cho Google Drive
  driveScopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
  ],
  
  // Các scopes mặc định cho Google Sheets
  sheetsScopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ],

  // Scheme cố định cho redirect URI
  redirectScheme: 'com.tanhoaphat.thpapp'
};

// Hàm helper để log chi tiết lỗi Google API
export const logGoogleApiError = (error, context = '') => {
  console.error(`Google API Error ${context ? `(${context})` : ''}:`, error);
  
  // Log thông tin chi tiết hơn nếu có
  if (error.response) {
    console.error('Error response:', {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    });
  }
  
  // Log thông tin request nếu có
  if (error.config) {
    console.error('Request config:', {
      url: error.config.url,
      method: error.config.method,
      headers: error.config.headers,
      params: error.config.params
    });
  }
  
  return error;
}; 