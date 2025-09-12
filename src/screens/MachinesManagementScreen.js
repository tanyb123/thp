import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import machineService from '../api/machineService';

const STATUS_OPTIONS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'active', label: 'Đang hoạt động' },
  { key: 'maintenance', label: 'Bảo trì' },
  { key: 'broken', label: 'Hỏng' },
  { key: 'retired', label: 'Ngừng sử dụng' },
];

const MachinesManagementScreen = ({ navigation }) => {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');

  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await machineService.listMachines({
        keyword,
        status: status === 'all' ? undefined : status,
      });
      setItems(data);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể tải danh sách máy móc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openCreate = () => {
    setEditing({
      code: '',
      name: '',
      model: '',
      vendor: '',
      location: '',
      status: 'active',
      notes: '',
    });
    setEditVisible(true);
  };

  const openEdit = (m) => {
    setEditing({ ...m });
    setEditVisible(true);
  };

  const save = async () => {
    try {
      setLoading(true);
      const payload = { ...editing };
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        await machineService.updateMachine(id, payload);
      } else {
        await machineService.createMachine(payload);
      }
      setEditVisible(false);
      await load();
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu máy');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    Alert.alert('Xác nhận', 'Xóa máy này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await machineService.deleteMachine(id);
            await load();
          } catch (e) {
            Alert.alert('Lỗi', 'Không thể xóa');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: theme.card }]}
      onPress={() => openEdit(item)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemTitle, { color: theme.text }]}>
          {item.code || '-'} · {item.name || 'Máy'}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          {item.model || ''} {item.vendor ? '• ' + item.vendor : ''}{' '}
          {item.location ? '• ' + item.location : ''}
        </Text>
      </View>
      <View style={[styles.badge, { borderColor: theme.border }]}>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          {STATUS_OPTIONS.find((s) => s.key === item.status)?.label || '—'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => remove(item.id)}
        style={{ paddingHorizontal: 8 }}
      >
        <Ionicons
          name="trash-outline"
          size={18}
          color={theme.error || '#d00'}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('MaintenanceSchedule', { machine: item })
        }
        style={{ paddingHorizontal: 6 }}
      >
        <Ionicons name="calendar-outline" size={18} color={theme.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('MaintenanceLogs', { machine: item })
        }
        style={{ paddingHorizontal: 6 }}
      >
        <Ionicons name="book-outline" size={18} color={theme.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('MachineIncidents', { machine: item })
        }
        style={{ paddingHorizontal: 6 }}
      >
        <Ionicons name="alert-circle-outline" size={18} color={theme.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý máy móc</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.toolbar}>
        <View style={[styles.searchBox, { borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            placeholder="Tìm mã, tên, vị trí, hãng..."
            placeholderTextColor={theme.textMuted}
            style={{ flex: 1, color: theme.text, paddingHorizontal: 8 }}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={load}
            returnKeyType="search"
          />
          {keyword ? (
            <TouchableOpacity
              onPress={() => {
                setKeyword('');
                load();
              }}
            >
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.filtersRow}>
          {STATUS_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.chip,
                {
                  borderColor: theme.border,
                  backgroundColor:
                    status === s.key ? theme.primary + '22' : 'transparent',
                },
              ]}
              onPress={() => setStatus(s.key)}
            >
              <Text
                style={{ color: status === s.key ? theme.primary : theme.text }}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={theme.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={
            <Text
              style={{
                color: theme.textSecondary,
                textAlign: 'center',
                marginTop: 24,
              }}
            >
              Chưa có máy nào
            </Text>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={openCreate}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editing?.id ? 'Sửa máy' : 'Thêm máy'}
            </Text>

            <View style={styles.formRow}>
              <TextInput
                placeholder="Mã máy"
                placeholderTextColor={theme.textMuted}
                value={editing?.code}
                onChangeText={(v) => setEditing((e) => ({ ...e, code: v }))}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholder="Tên máy"
                placeholderTextColor={theme.textMuted}
                value={editing?.name}
                onChangeText={(v) => setEditing((e) => ({ ...e, name: v }))}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholder="Model"
                placeholderTextColor={theme.textMuted}
                value={editing?.model}
                onChangeText={(v) => setEditing((e) => ({ ...e, model: v }))}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholder="Hãng (Vendor)"
                placeholderTextColor={theme.textMuted}
                value={editing?.vendor}
                onChangeText={(v) => setEditing((e) => ({ ...e, vendor: v }))}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholder="Vị trí"
                placeholderTextColor={theme.textMuted}
                value={editing?.location}
                onChangeText={(v) => setEditing((e) => ({ ...e, location: v }))}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholder="Trạng thái (active/maintenance/broken/retired)"
                placeholderTextColor={theme.textMuted}
                value={editing?.status}
                onChangeText={(v) => setEditing((e) => ({ ...e, status: v }))}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholder="Ghi chú"
                placeholderTextColor={theme.textMuted}
                value={editing?.notes}
                onChangeText={(v) => setEditing((e) => ({ ...e, notes: v }))}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton]}
                onPress={() => setEditVisible(false)}
              >
                <Text style={{ color: theme.text }}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={save}
              >
                <Text style={{ color: '#fff' }}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  toolbar: { padding: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  badge: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { width: '90%', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  formRow: { marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
});

export default MachinesManagementScreen;


