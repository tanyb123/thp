import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../config/colors';

// Tạo context cho theme
const ThemeContext = createContext();

// Hook để sử dụng theme
export const useTheme = () => useContext(ThemeContext);

// Provider component
export const ThemeProvider = ({ children }) => {
  // Lấy theme hệ thống
  const systemColorScheme = useColorScheme();

  // State để lưu trạng thái dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  // State để lưu trạng thái theo dõi hệ thống
  const [followSystem, setFollowSystem] = useState(true);

  // Lấy theme từ storage khi component mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const storedIsDarkMode = await AsyncStorage.getItem('isDarkMode');
        const storedFollowSystem = await AsyncStorage.getItem('followSystem');

        if (storedFollowSystem !== null) {
          setFollowSystem(storedFollowSystem === 'true');
        }

        if (storedIsDarkMode !== null && !followSystem) {
          setIsDarkMode(storedIsDarkMode === 'true');
        } else if (followSystem) {
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.log('Error loading theme preference:', error);
      }
    };

    loadThemePreference();
  }, [systemColorScheme]);

  // Cập nhật theme khi systemColorScheme thay đổi và followSystem = true
  useEffect(() => {
    if (followSystem) {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, followSystem]);

  // Hàm toggle dark mode
  const toggleTheme = async () => {
    try {
      const newValue = !isDarkMode;
      setIsDarkMode(newValue);
      await AsyncStorage.setItem('isDarkMode', String(newValue));

      // Khi người dùng chủ động thay đổi theme, tắt chế độ theo dõi hệ thống
      if (followSystem) {
        setFollowSystem(false);
        await AsyncStorage.setItem('followSystem', 'false');
      }
    } catch (error) {
      console.log('Error saving theme preference:', error);
    }
  };

  // Hàm toggle chế độ theo dõi hệ thống
  const toggleFollowSystem = async () => {
    try {
      const newValue = !followSystem;
      setFollowSystem(newValue);
      await AsyncStorage.setItem('followSystem', String(newValue));

      // Nếu bật chế độ theo dõi hệ thống, cập nhật theme theo hệ thống
      if (newValue) {
        const systemIsDark = systemColorScheme === 'dark';
        setIsDarkMode(systemIsDark);
        await AsyncStorage.setItem('isDarkMode', String(systemIsDark));
      }
    } catch (error) {
      console.log('Error saving system preference:', error);
    }
  };

  // Lấy theme hiện tại
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Giá trị được cung cấp bởi context
  const value = {
    isDarkMode,
    theme,
    toggleTheme,
    followSystem,
    toggleFollowSystem,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export default ThemeContext;
