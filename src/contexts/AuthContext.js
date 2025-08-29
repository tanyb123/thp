//src/contexts/AuthContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import messaging from '@react-native-firebase/messaging';
import { updateUser } from '../api/userService';

// Tạo context cho xác thực
const AuthContext = createContext();

// Provider component để cung cấp trạng thái xác thực cho toàn bộ ứng dụng
export const AuthProvider = ({ children }) => {
  // Các state cần thiết
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isOffline, setIsOffline] = useState(false);

  // Theo dõi trạng thái kết nối mạng
  useEffect(() => {
    console.log('Setting up network listener...');
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      console.log(
        'Network status:',
        state.isConnected ? 'Connected' : 'Disconnected'
      );
      setIsOffline(!state.isConnected);
      setConnectionStatus(state.isConnected ? 'connected' : 'disconnected');
    });

    return () => {
      unsubscribeNetInfo();
    };
  }, []);

  // Hàm yêu cầu quyền và lấy FCM token
  const requestUserPermissionAndGetToken = async (userId) => {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
      try {
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          console.log('A new FCM token has been generated:', fcmToken);
          // Lưu token vào Firestore
          await updateUser(userId, { fcmToken: fcmToken });
        }
      } catch (error) {
        console.error('Failed to get FCM token', error);
      }
    }
  };

  // Hàm lấy thông tin người dùng từ Firestore
  const fetchUserData = useCallback(async (userAuth) => {
    if (!userAuth) return null;

    const userRef = doc(db, 'users', userAuth.uid);
    try {
      console.log('Fetching user data for:', userAuth.uid);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        console.log('User data found:', docSnap.data());
        return { uid: userAuth.uid, email: userAuth.email, ...docSnap.data() };
      } else {
        console.log('User document not found! Creating new one.');
        const newUser = {
          uid: userAuth.uid,
          email: userAuth.email,
          role: 'user',
          createdAt: serverTimestamp(),
          displayName: userAuth.displayName || userAuth.email.split('@')[0],
          photoURL: userAuth.photoURL || '',
        };
        await setDoc(userRef, newUser);
        console.log('New user document created.');
        return newUser;
      }
    } catch (err) {
      console.error('Error fetching/creating user document:', err);
      // Fallback offline data
      return {
        uid: userAuth.uid,
        email: userAuth.email,
        displayName: userAuth.displayName || userAuth.email.split('@')[0],
        role: 'user',
        isOfflineData: true,
      };
    }
  }, []);

  // Lắng nghe sự thay đổi trạng thái xác thực
  useEffect(() => {
    console.log('Setting up auth state listener...');

    // Kiểm tra xem auth đã được khởi tạo chưa
    if (!auth) {
      console.error('Auth instance is not initialized!');
      setLoadingAuth(false);
      setError('Authentication service is not available');
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (userAuth) => {
      console.log(
        'Auth state changed:',
        userAuth ? 'User logged in' : 'User logged out'
      );
      setLoadingAuth(true);

      try {
        if (userAuth) {
          const userData = await fetchUserData(userAuth);
          if (userData) {
            setCurrentUser(userData);
            setUserRole(userData.role || 'user');
            // GỌI HÀM LẤY TOKEN Ở ĐÂY
            requestUserPermissionAndGetToken(userAuth.uid);
          }
        } else {
          setCurrentUser(null);
          setUserRole(null);
        }
      } catch (err) {
        console.error('Error in auth state change:', err);
        setError('Authentication error occurred.');
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [fetchUserData]);

  // Hàm đăng nhập
  const login = async (email, password) => {
    try {
      setLoadingAuth(true);
      setError(null);

      // Kiểm tra kết nối mạng
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error('No internet connection');
      }

      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', email);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please check your credentials.';

      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          if (
            error.message.includes('internet') ||
            error.message.includes('connection')
          ) {
            errorMessage = 'No internet connection. Please check your network.';
          }
          break;
      }

      setError(errorMessage);
      Alert.alert('Login Error', errorMessage);
      return false;
    } finally {
      setLoadingAuth(false);
    }
  };

  // Hàm đăng ký
  const register = async (email, password, displayName) => {
    try {
      setLoadingAuth(true);
      setError(null);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        displayName: displayName || email.split('@')[0],
        role: 'user',
        createdAt: serverTimestamp(),
        photoURL: '',
      });

      console.log('Registration successful:', email);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed. Please try again.';

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/weak-password':
          errorMessage =
            'Password is too weak. Please choose a stronger password.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
      }

      setError(errorMessage);
      Alert.alert('Registration Error', errorMessage);
      return false;
    } finally {
      setLoadingAuth(false);
    }
  };

  // Hàm đăng xuất
  const logout = async () => {
    try {
      // Đăng xuất khỏi Google Sign-In trước
      if (await GoogleSignin.isSignedIn()) {
        await GoogleSignin.signOut();
        console.log('Google user signed out');
      }

      // Sau đó đăng xuất khỏi Firebase
      await signOut(auth);

      // Cập nhật state
      setCurrentUser(null);
      setUserRole(null);

      console.log('User logged out successfully from all services');
      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Logout failed. Please try again.');
      Alert.alert('Error', 'Logout failed. Please try again.');
      return false;
    }
  };

  // Hàm quên mật khẩu
  const resetPassword = async (email) => {
    try {
      setLoadingAuth(true);
      setError(null);
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Password Reset Email Sent',
        'Please check your inbox and follow the instructions to reset your password.'
      );
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      let errorMessage =
        'Could not send password reset email. Please try again.';

      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.';
          break;
      }

      setError(errorMessage);
      Alert.alert('Password Reset Error', errorMessage);
      return false;
    } finally {
      setLoadingAuth(false);
    }
  };

  // Giá trị context để cung cấp cho toàn bộ ứng dụng
  const value = {
    currentUser,
    userRole,
    user: currentUser,
    loadingAuth,
    error,
    isSignedIn: !!currentUser,
    login,
    logout,
    register,
    resetPassword,
    connectionStatus,
    isOffline,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook để sử dụng AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
