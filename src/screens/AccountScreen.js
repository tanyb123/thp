//src/screens/AccountScreen.js
import React, { useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SettingItem = ({
  icon,
  title,
  value,
  onPress,
  type = 'chevron',
  color,
}) => {
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
        <Text style={[styles.settingTitle, { color: theme.text }]}>
          {title}
        </Text>
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
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
            {value}
          </Text>
        )}
        {type === 'chevron' && (
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
};

// Helper function to map role keys to display labels
const getRoleLabel = (role) => {
  switch (role) {
    case 'admin':
      return 'Quản trị viên';
    case 'giam_doc':
      return 'Giám đốc';
    case 'pho_giam_doc':
      return 'Phó Giám đốc';
    case 'quan_ly':
      return 'Quản lý';
    case 'ky_su':
      return 'Kỹ sư';
    case 'ke_toan':
      return 'Kế toán';
    case 'thuong_mai':
      return 'Thương mại';
    case 'cong_nhan':
      return 'Công nhân';
    case 'user':
      return 'Người dùng';
    default:
      return 'Không xác định';
  }
};

// Helper function to get style based on role
const getRoleStyle = (role) => {
  switch (role) {
    case 'giam_doc':
      return { backgroundColor: '#FFD700', textColor: '#8C6D00' };
    case 'pho_giam_doc':
      return { backgroundColor: '#E6E6FA', textColor: '#483D8B' };
    case 'ky_su':
      return {
        backgroundColor: 'rgba(0, 102, 204, 0.2)',
        textColor: '#0066cc',
      };
    case 'ke_toan':
      return {
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
        textColor: '#27AE60',
      };
    case 'thuong_mai':
      return {
        backgroundColor: 'rgba(243, 156, 18, 0.2)',
        textColor: '#D35400',
      };
    case 'cong_nhan':
      return { backgroundColor: '#f0f0f0', textColor: '#555' };
    case 'admin':
    case 'quan_ly':
    case 'user':
    default:
      return {
        backgroundColor: 'rgba(108, 122, 137, 0.2)',
        textColor: '#6C7A89',
      };
  }
};

const AccountScreen = ({ navigation }) => {
  const { logout, currentUser, userRole } = useAuth();
  const { theme, isDarkMode, toggleTheme, followSystem, toggleFollowSystem } =
    useTheme();

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

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

  const switchGoogleAccount = async () => {
    try {
      // Ngắt kết nối tài khoản Google hiện tại
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();

      Alert.alert(
        'Đã ngắt kết nối',
        'Tài khoản Google đã được ngắt kết nối. Bạn có thể kết nối lại khi cần thiết trong màn hình chi tiết dự án.'
      );
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_REQUIRED) {
        // This error is expected after a sign-out or if the user isn't signed in.
        // We can safely ignore it.
        console.log(
          'User is not signed in, which is expected after revokeAccess.'
        );
        Alert.alert(
          'Đã ngắt kết nối',
          'Tài khoản Google đã được ngắt kết nối thành công.'
        );
      } else {
        // For any other unexpected errors, show an alert to the user.
        console.error('Lỗi khi chuyển tài khoản Google:', error);
        Alert.alert(
          'Lỗi',
          'Không thể ngắt kết nối tài khoản Google. Vui lòng thử lại.'
        );
      }
    }
  };

  // Get dynamic style for role badge
  const roleStyle = getRoleStyle(currentUser?.role);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.avatarContainer,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.primary }]}>
                {currentUser?.displayName
                  ? currentUser.displayName[0].toUpperCase()
                  : currentUser?.email
                  ? currentUser.email[0].toUpperCase()
                  : 'U'}
              </Text>
            </View>
            <View style={styles.userInfoContainer}>
              <Text style={[styles.nameText, { color: theme.text }]}>
                {currentUser?.displayName || 'Tên Người Dùng'}
              </Text>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: roleStyle.backgroundColor },
                ]}
              >
                <Text
                  style={[styles.roleBadgeText, { color: roleStyle.textColor }]}
                >
                  {getRoleLabel(currentUser?.role)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Settings Groups */}
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>
            Giao diện
          </Text>
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
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>
            Tài khoản
          </Text>
          <SettingItem
            icon="person-outline"
            title="Thông tin cá nhân"
            onPress={() => Alert.alert('Tính năng đang phát triển')}
          />
          <SettingItem
            icon="key-outline"
            title="Đổi mật khẩu"
            onPress={() => Alert.alert('Tính năng đang phát triển')}
          />
          <SettingItem
            icon="swap-horizontal-outline"
            title="Chuyển tài khoản Google"
            onPress={switchGoogleAccount}
            color="#4285F4"
          />
          <SettingItem
            icon="location-outline"
            title="Địa chỉ Xưởng ngoài (Xưởng 1)"
            onPress={async () => {
              await Clipboard.setStringAsync(
                'https://www.google.com/maps/place/X%C6%B0%E1%BB%9Fng+CK+MT+-+T%C3%A2n+H%C3%B2a+Ph%C3%A1t+1/@10.7782508,106.5291403,12z/data=!4m10!1m2!2m1!1zY8ahIGtow60gdMOibiBow7JhIHBow6F0!3m6!1s0x3175290ffa823bfb:0x23c923d5a8d1a031!8m2!3d10.8614882!4d106.6831661!15sChhjxqEga2jDrSB0w6JuIGjDsmEgcGjDoXSSARVtZWNoYW5pY2FsX2NvbnRyYWN0b3KqAVAKDS9nLzExc2s2djkwODYQATIfEAEiG23AjuWtNDJVRipKVSAA9Rbpkjo81fIfZYNOsDIcEAIiGGPGoSBraMOtIHTDom4gaMOyYSBwaMOhdOABAA!16s%2Fg%2F11h6gd6mg4?entry=ttu&g_ep=EgoyMDI1MDgxOS4wIKXMDSoASAFQAw%3D%3D'
              );
              Alert.alert(
                'Đã sao chép',
                'Liên kết địa chỉ Xưởng 1 đã được copy'
              );
            }}
            color={theme.primary}
          />
          <SettingItem
            icon="location-outline"
            title="Địa chỉ Xưởng trong (Xưởng 2)"
            onPress={async () => {
              await Clipboard.setStringAsync(
                'https://www.google.com/maps/place/102+%C4%90.+Th%E1%BA%A1nh+L%E1%BB%99c+15,+Th%E1%BA%A1nh+L%E1%BB%99c,+Qu%E1%BA%ADn+12,+H%E1%BB%93+Ch%C3%AD+Minh,+Vi%E1%BB%87t+Nam/@10.8675172,106.6876414,17z/data=!3m1!4b1!4m5!3m4!1s0x3175282515d55d23:0xdf8406f9ca9fa24a!8m2!3d10.8675119!4d106.6902163?entry=ttu&g_ep=EgoyMDI1MDgxOS4wIKXMDSoASAFQAw%3D%3D'
              );
              Alert.alert(
                'Đã sao chép',
                'Liên kết địa chỉ Xưởng 2 đã được copy'
              );
            }}
            color={theme.primary}
          />
          {(userRole === 'giam_doc' || userRole === 'admin') && (
            <>
              <SettingItem
                icon="people-outline"
                title="Quản lý nhân viên"
                onPress={() => navigation.navigate('UserManagement')}
                color={theme.primary}
              />
              <SettingItem
                icon="color-palette-outline"
                title="Cài đặt Icon Stage"
                onPress={() => navigation.navigate('IconSettings')}
                color="#FF6B35"
              />
              <SettingItem
                icon="bug-outline"
                title="Debug Custom Icons"
                onPress={() => navigation.navigate('CustomIconDebug')}
                color="#9C27B0"
              />
            </>
          )}
        </View>

        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>
            Ứng dụng
          </Text>
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
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#fff"
            style={styles.logoutIcon}
          />
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
  scrollViewContent: {
    paddingVertical: 16,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  userInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingsGroup: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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
    marginTop: 24,
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
