//App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UIManager, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AIChatProvider } from './src/contexts/AIChatContext';
import AppNavigator from './src/navigation/AppNavigator';
// Import để đảm bảo Firebase được khởi tạo trước
import './src/config/firebaseConfig';
import RNFetchBlob from 'react-native-blob-util';

// Kích hoạt LayoutAnimation trên Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Polyfill Blob and fetch for binary uploads
if (!global.Blob || !global.fetch) {
  const Fetch = RNFetchBlob.polyfill.Fetch;
  global.fetch = new Fetch({
    auto: true,
    binaryContentTypes: ['application/pdf', 'application/octet-stream'],
  }).build();
  global.Blob = RNFetchBlob.polyfill.Blob;
}

export default function App() {
  useEffect(() => {
    // Log để xác nhận App component đã mount
    console.log('App component mounted');

    // Cấu hình GoogleSignin
    GoogleSignin.configure({
      // Web application client ID từ Google Cloud Console
      webClientId:
        '370615243912-fesvpqtf06r7ugj31ma1urmrii85m7at.apps.googleusercontent.com',
      // Yêu cầu quyền truy cập offline để có thể lấy refresh token
      offlineAccess: true,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <AuthProvider>
            <ThemeProvider>
              <AIChatProvider>
                <AppNavigator />
              </AIChatProvider>
            </ThemeProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
