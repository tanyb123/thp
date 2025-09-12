import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import wallet from '../api/walletService';

const fmt = (n) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));

const WalletScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const ws = await wallet.listWallets();
      setWallets(ws);
      if (ws[0]) {
        setSelected(ws[0]);
        const led = await wallet.listLedger(ws[0].id);
        setLedger(led);
      } else {
        setSelected(null);
        setLedger([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSelect = async (w) => {
    setSelected(w);
    const led = await wallet.listLedger(w.id);
    setLedger(led);
  };

  const createDefaultWallet = async () => {
    try {
      await wallet.createWallet({ name: 'Quỹ công ty' });
      await load();
    } catch (e) {
      console.warn('Create wallet failed', e);
    }
  };

  const openRename = () => {
    if (!selected) return;
    setRenameValue(selected.name || '');
    setRenameVisible(true);
  };

  const confirmRename = async () => {
    try {
      await wallet.updateWalletName(selected.id, renameValue.trim() || 'Ví');
      setRenameVisible(false);
      await load();
    } catch (e) {
      console.warn('Rename wallet failed', e);
    }
  };

  const deleteCurrent = async () => {
    if (!selected) return;
    try {
      await wallet.deleteWallet({ walletId: selected.id, cascade: true });
      await load();
    } catch (e) {
      console.warn('Delete wallet failed', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 6 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Ví/Quỹ tiền vào
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {selected && (
            <>
              <TouchableOpacity onPress={openRename} style={{ padding: 6 }}>
                <Ionicons name="pencil-outline" size={20} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteCurrent} style={{ padding: 6 }}>
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={theme.error || '#d00'}
                />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={createDefaultWallet}
            style={{ padding: 6 }}
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={theme.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
            <FlatList
              data={wallets}
              keyExtractor={(it) => it.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => onSelect(item)}
                  style={[
                    styles.walletPill,
                    {
                      borderColor: theme.border,
                      backgroundColor:
                        selected?.id === item.id
                          ? theme.primary + '22'
                          : theme.card,
                    },
                  ]}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>
                    {item.name || 'Ví'}
                  </Text>
                  <Text style={{ color: theme.textSecondary }}>
                    {fmt(item.balance)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {wallets.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.textSecondary, marginBottom: 12 }}>
                Chưa có ví/quỹ
              </Text>
              <TouchableOpacity
                onPress={createDefaultWallet}
                style={{
                  backgroundColor: theme.primary,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Tạo ví mặc định
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={ledger}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ padding: 12 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View style={[styles.row, { borderColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>
                      {item.type === 'in' ? 'Thu' : 'Chi'}
                    </Text>
                    <Text style={{ color: theme.textSecondary }}>
                      {item.note || '-'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: item.type === 'in' ? '#2E7D32' : '#C62828',
                      fontWeight: '800',
                    }}
                  >
                    {item.type === 'in' ? '+' : '-'}
                    {fmt(item.amount)}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text
                  style={{
                    color: theme.textSecondary,
                    textAlign: 'center',
                    marginTop: 20,
                  }}
                >
                  Chưa có giao dịch
                </Text>
              }
            />
          )}
        </View>
      )}

      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: '85%',
              backgroundColor: theme.card,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text
              style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}
            >
              Đổi tên ví
            </Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Tên ví"
              placeholderTextColor={theme.textMuted}
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 10,
                padding: 10,
                color: theme.text,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => setRenameVisible(false)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: theme.text }}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmRename}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: theme.primary,
                  borderRadius: 8,
                }}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  walletPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});

export default WalletScreen;


