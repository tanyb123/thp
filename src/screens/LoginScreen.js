//src/screens/LoginScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import StyledTextInput from '../components/StyledTextInput';

const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const passwordRef = useRef(null);
  const { login, error } = useAuth();

  // Kiểm tra tính hợp lệ của form
  useEffect(() => {
    const validateEmail = (email) => {
      const re =
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      return re.test(String(email).toLowerCase());
    };

    const isValid =
      email.trim() !== '' && password.trim() !== '' && validateEmail(email);

    setIsEmailValid(email === '' || validateEmail(email));
    setIsFormValid(isValid);
  }, [email, password]);

  // Theo dõi trạng thái hiển thị của bàn phím
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Xử lý đăng nhập
  const handleLogin = async () => {
    if (!isFormValid) {
      Alert.alert('Lỗi đăng nhập', 'Vui lòng nhập email và mật khẩu hợp lệ');
      return;
    }

    Keyboard.dismiss();
    setIsLoggingIn(true);
    try {
      const success = await login(email, password);
      if (!success) {
        console.log('Đăng nhập thất bại');
      }
    } catch (error) {
      console.error('Lỗi khi đăng nhập:', error);
      Alert.alert(
        'Lỗi đăng nhập',
        'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại sau.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Xử lý quên mật khẩu
  const handleForgotPassword = () => {
    // Sẽ triển khai sau
    Alert.alert(
      'Quên mật khẩu',
      'Tính năng này sẽ được triển khai trong phiên bản tiếp theo.'
    );
  };

  // Tạo nút hiển thị/ẩn mật khẩu
  const PasswordToggleButton = (
    <TouchableOpacity
      onPress={() => setShowPassword(!showPassword)}
      style={styles.passwordToggle}
    >
      <Ionicons
        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        color="#666"
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            keyboardVisible && { justifyContent: 'flex-start', paddingTop: 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.logoContainer,
              keyboardVisible && {
                marginBottom: 10,
                transform: [{ scale: 0.8 }],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo-placeholder.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Tân Hòa Phát</Text>
            <Text style={styles.appDescription}>
              Hệ thống quản lý khách hàng
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>Đăng nhập</Text>

            <StyledTextInput
              iconName="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current.focus()}
              error={!isEmailValid ? 'Email không hợp lệ' : null}
            />

            <StyledTextInput
              ref={passwordRef}
              iconName="lock-closed-outline"
              placeholder="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              rightIcon={PasswordToggleButton}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton,
                (!isFormValid || isLoggingIn) && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isFormValid || isLoggingIn}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#e74c3c"
                />
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            )}
          </View>

          {!keyboardVisible && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                © 2023 Tân Hòa Phát. All rights reserved.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066cc',
    marginBottom: 5,
  },
  appDescription: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
    width: '100%',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  passwordToggle: {
    padding: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#0066cc',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fde2e2',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  errorMessage: {
    color: '#e74c3c',
    fontSize: 14,
    marginLeft: 5,
    flex: 1,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#999',
    fontSize: 12,
  },
});

export default LoginScreen;
