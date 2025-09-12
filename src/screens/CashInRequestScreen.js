import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import wallet from '../api/walletService';

const CashInRequestScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const n = Number(amount.replace(/[^0-9]/g, '')) || 0;
    if (n <= 0) return Alert.alert('Lỗi', 'Số tiền phải > 0');
    try {
      setLoading(true);
      // For now, use the first wallet. In production, allow selecting wallet.
      let ws = await wallet.listWallets();
      let w = ws[0];
      if (!w) {
        // Auto-create default wallet
        const id = await wallet.createWallet({ name: 'Quỹ công ty' });
        ws = await wallet.listWallets();
        w = ws.find((x) => x.id === id) || ws[0];
      }
      await wallet.createCashInRequest({
        walletId: w.id,
        amount: n,
        reason,
        requestedBy: user?.uid,
      });
      Alert.alert('Đã gửi', 'Yêu cầu nạp quỹ đã được gửi để duyệt.');
      navigation.goBack();
    } finally {
      setLoading(false);
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
          Yêu cầu nạp quỹ
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={{ padding: 12 }}>
        <Text style={{ color: theme.text }}>Số tiền</Text>
        <TextInput
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border },
          ]}
        />
        <Text style={{ color: theme.text, marginTop: 10 }}>Lý do</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Ví dụ: nạp quỹ chi tiêu văn phòng"
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, height: 90 },
          ]}
          multiline
        />

        <TouchableOpacity
          disabled={loading}
          onPress={submit}
          style={[
            styles.btn,
            { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="send-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>
            Gửi yêu cầu
          </Text>
        </TouchableOpacity>
      </View>
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
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'center',
    borderRadius: 10,
    marginTop: 16,
  },
});

export default CashInRequestScreen;
