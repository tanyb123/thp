import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import StageIconManager from '../components/StageIconManager';
import {
  STAGE_ICONS,
  getStageIcon,
  createCustomIconMapping,
} from '../utils/stageIcons';
import { Image } from 'react-native';

const IconSettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [customIcons, setCustomIcons] = useState({});
  const [showIconManager, setShowIconManager] = useState(false);
  const [selectedProcessKey, setSelectedProcessKey] = useState(null);

  // Load custom icons from storage
  useEffect(() => {
    loadCustomIcons();
  }, []);

  const loadCustomIcons = async () => {
    try {
      const saved = await AsyncStorage.getItem('customStageIcons');
      if (saved) {
        setCustomIcons(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading custom icons:', error);
    }
  };

  const saveCustomIcons = async (newCustomIcons) => {
    try {
      await AsyncStorage.setItem(
        'customStageIcons',
        JSON.stringify(newCustomIcons)
      );
      setCustomIcons(newCustomIcons);
    } catch (error) {
      console.error('Error saving custom icons:', error);
      Alert.alert('Lỗi', 'Không thể lưu cài đặt icon');
    }
  };

  const handleIconSelect = (processKey, iconData, isCustom = false) => {
    let newCustomIcons;

    if (isCustom) {
      // For custom icons, store the full icon object
      newCustomIcons = {
        ...customIcons,
        [processKey]: {
          type: 'custom',
          data: iconData,
        },
      };
    } else {
      // For regular icons, store just the icon name
      newCustomIcons = {
        ...customIcons,
        [processKey]: {
          type: 'ionicon',
          data: iconData,
        },
      };
    }

    saveCustomIcons(newCustomIcons);
    Alert.alert('Thành công', `Đã cập nhật icon cho ${processKey}`);
  };

  const handleResetIcon = (processKey) => {
    Alert.alert(
      'Xác nhận',
      `Bạn có muốn khôi phục icon mặc định cho ${processKey}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục',
          onPress: () => {
            const newCustomIcons = { ...customIcons };
            delete newCustomIcons[processKey];
            saveCustomIcons(newCustomIcons);
          },
        },
      ]
    );
  };

  const handleResetAll = () => {
    Alert.alert('Xác nhận', 'Bạn có muốn khôi phục tất cả icon về mặc định?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Khôi phục tất cả',
        style: 'destructive',
        onPress: () => saveCustomIcons({}),
      },
    ]);
  };

  const getCurrentIcon = (processKey) => {
    const customIcon = customIcons[processKey];
    if (customIcon) {
      return customIcon;
    }
    return {
      type: 'ionicon',
      data: STAGE_ICONS[processKey] || STAGE_ICONS.default,
    };
  };

  const renderStageItem = ({ item }) => {
    const [processKey, defaultIcon] = item;
    const currentIcon = getCurrentIcon(processKey);
    const isCustomized = customIcons[processKey] !== undefined;

    return (
      <View style={styles.stageItem}>
        <View style={styles.stageInfo}>
          <View style={styles.iconContainer}>
            {currentIcon.type === 'custom' ? (
              <Image
                source={{ uri: currentIcon.data.uri }}
                style={styles.customIconImage}
              />
            ) : (
              <Ionicons name={currentIcon.data} size={24} color="#007AFF" />
            )}
            {isCustomized && (
              <View style={styles.customBadge}>
                <Ionicons name="star" size={8} color="#FFD700" />
              </View>
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.processName}>{processKey}</Text>
            <Text style={styles.iconName}>
              {currentIcon.type === 'custom'
                ? currentIcon.data.name
                : currentIcon.data}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setSelectedProcessKey(processKey);
              setShowIconManager(true);
            }}
          >
            <Ionicons name="create" size={20} color="#007AFF" />
          </TouchableOpacity>

          {isCustomized && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => handleResetIcon(processKey)}
            >
              <Ionicons name="refresh" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const stageEntries = Object.entries(STAGE_ICONS).filter(
    ([key]) => key !== 'default'
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Cài đặt Icon Stage</Text>
        <TouchableOpacity onPress={handleResetAll}>
          <Text style={styles.resetAllText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Tùy chỉnh icon cho các loại công đoạn sản xuất. Icon có dấu ⭐ đã được
          tùy chỉnh.
        </Text>
      </View>

      <FlatList
        data={stageEntries}
        renderItem={renderStageItem}
        keyExtractor={([key]) => key}
        contentContainerStyle={styles.list}
      />

      <StageIconManager
        visible={showIconManager}
        onClose={() => setShowIconManager(false)}
        onIconSelect={handleIconSelect}
        currentProcessKey={selectedProcessKey}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetAllText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  infoContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  list: {
    padding: 16,
  },
  stageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  stageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  customBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  processName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  iconName: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 8,
    marginLeft: 8,
  },
  resetButton: {
    padding: 8,
    marginLeft: 8,
  },
  customIconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    borderRadius: 4,
  },
});

export default IconSettingsScreen;
