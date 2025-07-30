//src/config/firebaseConfig.js
// Import the required Firebase modules
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import Firebase compat to support legacy code that still uses the namespaced API (e.g., firebase.firestore())
import firebaseCompat from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/storage';
import 'firebase/compat/functions';

// Firebase configuration object
const firebaseConfig = {
  apiKey: 'AIzaSyBYQoTM8YwjL4cq1TdF7dFz5U6Ss-wxb3A',
  authDomain: 'tanyb-fe4bf.firebaseapp.com',
  projectId: 'tanyb-fe4bf',
  storageBucket: 'tanyb-fe4bf.appspot.com',
  messagingSenderId: '370615243912',
  appId: '1:370615243912:web:f070ed1f8a20f4baaf7b3d',
  measurementId: 'G-DY64DPJJVQ',
};

let app;
let auth;

// Singleton pattern to avoid re-initialization
if (getApps().length < 1) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'asia-southeast1');

// (Tùy chọn) Nếu bạn dùng emulator để test local, hãy bỏ comment dòng dưới
// if (__DEV__) {
//   try {
//     connectFunctionsEmulator(functions, 'localhost', 5001);
//   } catch (e) {
//     console.warn('Functions emulator already connected?');
//   }
// }

console.log('Firebase services handled.');

// Initialize firebase compat (namespaced) app if not already initialized
if (!firebaseCompat.apps.length) {
  firebaseCompat.initializeApp(firebaseConfig);
}

// Firestore and other services are now accessible via firebaseCompat.firestore(), etc.

// Export the initialized services
export { auth, db, storage, functions, firebaseCompat as firebase };
export default app;
