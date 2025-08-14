import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * ProcessPickerModal component
 * Props:
 *  - visible: boolean
 *  - onClose(): void  // close without saving
 *  - onConfirm(templates: ProcessTemplate[]): void // return chosen templates
 *  - existingStageKeys: string[] // list of process keys already in workflow
 */
const ProcessPickerModal = ({
  visible,
  onClose,
  onConfirm,
  existingStageKeys = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState([]); // [{title, data: ProcessTemplate[]}]
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Predefined templates to seed if collection is empty
  const DEFAULT_TEMPLATES = [
    // Tạo phôi & Cắt gọt
    {
      processKey: 'laser_plasma_cut',
      processName: 'Cắt Laser/Plasma',
      category: 'Tạo phôi & Cắt gọt',
    },
    {
      processKey: 'oxy_gas_cut',
      processName: 'Cắt Oxy-Gas',
      category: 'Tạo phôi & Cắt gọt',
    },
    {
      processKey: 'saw_cut',
      processName: 'Cắt bằng Máy cưa',
      category: 'Tạo phôi & Cắt gọt',
    },
    {
      processKey: 'punch',
      processName: 'Đột / Dập lỗ',
      category: 'Tạo phôi & Cắt gọt',
    },
    {
      processKey: 'turning',
      processName: 'Tiện',
      category: 'Tạo phôi & Cắt gọt',
    },
    {
      processKey: 'milling',
      processName: 'Phay',
      category: 'Tạo phôi & Cắt gọt',
    },
    {
      processKey: 'drill_tap',
      processName: 'Khoan / Ta-rô',
      category: 'Tạo phôi & Cắt gọt',
    },
    // Biến dạng
    {
      processKey: 'bending',
      processName: 'Chấn / Gấp',
      category: 'Biến dạng',
    },
    {
      processKey: 'rolling',
      processName: 'Lốc / Uốn Tôn',
      category: 'Biến dạng',
    },
    {
      processKey: 'pressing',
      processName: 'Dập / Ép',
      category: 'Biến dạng',
    },
    // Lắp ráp & Hoàn thiện
    {
      processKey: 'fit_up',
      processName: 'Tổ hợp / Gá đặt',
      category: 'Lắp ráp & Hoàn thiện',
    },
    {
      processKey: 'welding',
      processName: 'Hàn',
      category: 'Lắp ráp & Hoàn thiện',
    },
    {
      processKey: 'grinding',
      processName: 'Mài / Xử lý bề mặt',
      category: 'Lắp ráp & Hoàn thiện',
    },
    {
      processKey: 'sand_blasting',
      processName: 'Phun cát / Phun bi',
      category: 'Lắp ráp & Hoàn thiện',
    },
    {
      processKey: 'painting',
      processName: 'Sơn',
      category: 'Lắp ráp & Hoàn thiện',
    },
    {
      processKey: 'inox_polish',
      processName: 'Đánh bóng Inox',
      category: 'Lắp ráp & Hoàn thiện',
    },
    {
      processKey: 'qc_ndt',
      processName: 'Kiểm tra KCS / NDT',
      category: 'Lắp ráp & Hoàn thiện',
    },
    {
      processKey: 'pack_ship',
      processName: 'Đóng gói & Vận chuyển',
      category: 'Lắp ráp & Hoàn thiện',
    },
  ];

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'process_templates'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Auto-seed if empty
      if (list.length === 0) {
        await Promise.all(
          DEFAULT_TEMPLATES.map((tpl) =>
            addDoc(collection(db, 'process_templates'), tpl)
          )
        );
        // Re-fetch after seeding
        return fetchTemplates();
      }

      // Group by category
      const grouped = list.reduce((acc, tpl) => {
        const key = tpl.category || 'Khác';
        if (!acc[key]) acc[key] = [];
        acc[key].push(tpl);
        return acc;
      }, {});
      const groupedSections = Object.keys(grouped).map((cat) => ({
        title: cat,
        data: grouped[cat],
      }));
      setSections(groupedSections);
    } catch (err) {
      console.error('Error loading process templates', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when opened
  useEffect(() => {
    if (visible) {
      fetchTemplates();
    } else {
      // reset selection when closing
      setSelectedIds(new Set());
    }
  }, [visible, fetchTemplates]);

  const toggleSelect = (template) => {
    const id = template.id;
    const disabled = existingStageKeys.includes(template.processKey);
    if (disabled) return; // ignore taps on already-added stages

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    // flatten all sections to find selected templates
    const allTemplates = sections.flatMap((s) => s.data);
    const selected = allTemplates.filter((tpl) => selectedIds.has(tpl.id));
    onConfirm(selected);
    onClose();
  };

  const renderItem = ({ item }) => {
    const disabled = existingStageKeys.includes(item.processKey);
    const selected = disabled || selectedIds.has(item.id);
    const iconColor = disabled ? '#bbb' : selected ? '#4CAF50' : '#999';

    return (
      <TouchableOpacity
        style={[styles.itemRow, disabled && styles.disabledRow]}
        activeOpacity={disabled ? 1 : 0.6}
        onPress={() => toggleSelect(item)}
      >
        <Text style={[styles.itemText, disabled && styles.disabledText]}>
          {item.processName}
        </Text>
        {selected ? (
          <Ionicons name="checkbox" size={22} color={iconColor} />
        ) : (
          <Ionicons name="square-outline" size={22} color={iconColor} />
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Chọn Công đoạn</Text>

          {loading ? (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator size="large" color="#0066cc" />
            </View>
          ) : sections.length === 0 ||
            sections.every((s) => s.data.length === 0) ? (
            <View style={styles.emptyWrapper}>
              <Ionicons name="alert-circle-outline" size={40} color="#999" />
              <Text style={styles.emptyText}>Chưa có công đoạn nào.</Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={styles.listContent}
            />
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.btnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { opacity: selectedIds.size ? 1 : 0.5 },
              ]}
              disabled={!selectedIds.size}
              onPress={handleConfirm}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>Thêm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    backgroundColor: '#f1f1f1',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  loaderWrapper: {
    paddingVertical: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  confirmBtn: {
    backgroundColor: '#0066cc',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnText: {
    fontSize: 16,
  },
  emptyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  disabledRow: {
    backgroundColor: '#f4f4f4',
  },
  disabledText: {
    color: '#999',
  },
});

export default ProcessPickerModal;
