import React, { useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch, 
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const SettingItem = ({ icon, title, value, onPress, type = 'chevron', color }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[styles.settingItem, { borderBottomColor: theme.border }]} 
      onPress={onPress}
      disabled={type === 'switch'}
    >
      <View style={styles.settingLeft}>
        <Ionicons 
          name={icon} 
          size={22} 
          color={color || theme.text} 
          style={styles.settingIcon} 
        />
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
      </View>
      
      <View style={styles.settingRight}>
        {type === 'switch' && (
          <Switch
            value={value}
            onValueChange={onPress}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={value ? '#fff' : '#f4f3f4'}
          />
        )}
        {type === 'value' && (
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>{value}</Text>
        )}
        {type === 'chevron' && (
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const AccountScreen = () => {
  const { logout, currentUser } = useAuth();
  const { theme, isDarkMode, toggleTheme, followSystem, toggleFollowSystem } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      'Xác nhận đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất không?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          onPress: () => logout(),
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {currentUser?.email ? currentUser.email[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={[styles.emailText, { color: theme.text }]}>
            {currentUser?.email || 'user@example.com'}
          </Text>
        </View>
        
        {/* Settings Groups */}
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>Giao diện</Text>
          <SettingItem 
            icon="contrast-outline" 
            title="Chế độ tối" 
            value={isDarkMode}
            onPress={toggleTheme}
            type="switch"
          />
          <SettingItem 
            icon="phone-portrait-outline" 
            title="Theo hệ thống" 
            value={followSystem}
            onPress={toggleFollowSystem}
            type="switch"
          />
        </View>
        
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>Tài khoản</Text>
          <SettingItem 
            icon="person-outline" 
            title="Thông tin cá nhân" 
            onPress={() => {}}
          />
          <SettingItem 
            icon="key-outline" 
            title="Đổi mật khẩu" 
            onPress={() => {}}
          />
        </View>
        
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>Ứng dụng</Text>
          <SettingItem 
            icon="information-circle-outline" 
            title="Thông tin ứng dụng" 
            value="1.0.0"
            type="value"
            onPress={() => {}}
          />
          <SettingItem 
            icon="help-circle-outline" 
            title="Trợ giúp & Hỗ trợ" 
            onPress={() => {}}
          />
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.danger }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingsGroup: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 16,
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AccountScreen;