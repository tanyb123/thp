// Import the required Firebase modules
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyBYQoTM8YwjL4cq1TdF7dFz5U6Ss-wxb3A",
    authDomain: "tanyb-fe4bf.firebaseapp.com",
    projectId: "tanyb-fe4bf",
    storageBucket: "tanyb-fe4bf.appspot.com",
    messagingSenderId: "370615243912",
    appId: "1:370615243912:web:f070ed1f8a20f4baaf7b3d",
    measurementId: "G-DY64DPJJVQ"
};

// Khởi tạo Firebase App (chỉ khởi tạo một lần duy nhất)
const app = initializeApp(firebaseConfig);

// QUAN TRỌNG: Khởi tạo Auth với Persistence cho React Native
// Bằng cách này, Firebase sẽ dùng AsyncStorage để lưu session đăng nhập
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Khởi tạo Firestore
const db = getFirestore(app);

// Khởi tạo Storage
const storage = getStorage(app);

console.log('Firebase initialized successfully');
console.log('Auth instance:', auth ? 'OK' : 'NOT OK');
console.log('Firestore instance:', db ? 'OK' : 'NOT OK');
console.log('Storage instance:', storage ? 'OK' : 'NOT OK');

// Export the initialized services
export { auth, db, storage };
export default app;