// src/screens/ExpenseListScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getQuotationsByProject } from '../api/quotationService';
import { db } from '../config/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getUserById } from '../api/userService';
import { upsertProjectExpense } from '../api/expenseService';

const MATERIAL_RATE_PER_KG = {
  SUS304: 55000,
  SS400: 17000,
  OTHER: 0,
};

const getMaterialKey = (item) => {
  const fromField = (item.material || item.name || '').toString().toLowerCase();
  if (fromField.includes('sus304') || fromField.includes('304'))
    return 'SUS304';
  if (fromField.includes('ss400') || fromField.includes('400')) return 'SS400';
  return 'OTHER';
};

const getRateByMaterial = (key) => MATERIAL_RATE_PER_KG[key] ?? 0;

const toCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(Math.round(amount || 0));

const formatMinutesToHM = (minutes) => {
  const h = Math.floor((minutes || 0) / 60);
  const m = Math.round((minutes || 0) % 60);
  return `${h}h ${m}p`;
};

const ExpenseListScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();
  const { projectId, projectName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Material summary
  const [weightByType, setWeightByType] = useState({
    SUS304: 0,
    SS400: 0,
    OTHER: 0,
  });
  const weightLabel = useMemo(() => {
    const parts = [];
    if (weightByType.SUS304 > 0)
      parts.push(`SUS304: ${Math.round(weightByType.SUS304)} kg`);
    if (weightByType.SS400 > 0)
      parts.push(`SS400: ${Math.round(weightByType.SS400)} kg`);
    return parts.join(' · ');
  }, [weightByType]);

  const [materialsCost, setMaterialsCost] = useState(0);
  const [laborCost, setLaborCost] = useState(0);
  const [accessoryPrice, setAccessoryPrice] = useState('0');
  const [hasAccessories, setHasAccessories] = useState(false);

  const [workerBreakdown, setWorkerBreakdown] = useState([]); // [{ workerId, workerName, minutes, stages:[], cost }]

  const totalCost = useMemo(() => {
    const accessories =
      parseInt((accessoryPrice || '0').replace(/[^0-9]/g, ''), 10) || 0;
    return (materialsCost || 0) + (laborCost || 0) + accessories;
  }, [materialsCost, laborCost, accessoryPrice]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (!projectId) {
        setError('Thiếu projectId');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // 1) Lấy báo giá mới nhất của dự án
        const quotations = await getQuotationsByProject(projectId);
        const latest =
          Array.isArray(quotations) && quotations.length > 0
            ? quotations[0]
            : null;

        // 1a) Tính vật liệu theo kg và nhãn khối lượng
        let computedWeights = { SUS304: 0, SS400: 0, OTHER: 0 };
        let computedMaterialCost = 0;
        if (latest && Array.isArray(latest.materials)) {
          const weights = { SUS304: 0, SS400: 0, OTHER: 0 };
          for (const it of latest.materials) {
            const key = getMaterialKey(it);
            const quantity = Number(it.quantity || 0);
            const weightPerUnit = Number(it.weight || 0); // từ import vật tư
            const totalWeight = quantity * weightPerUnit; // kg
            weights[key] += totalWeight;
          }
          computedWeights = weights;
          if (isMounted) setWeightByType(weights);

          const cost =
            weights.SUS304 * getRateByMaterial('SUS304') +
            weights.SS400 * getRateByMaterial('SS400');
          computedMaterialCost = cost;
          if (isMounted) setMaterialsCost(cost);

          // 1b) Phụ kiện?
          const foundAccessories = latest.materials.some((m) => {
            const name = (m.name || '').toString().toLowerCase();
            return (
              name.includes('phụ kiện') ||
              name.includes('phu kien') ||
              name.includes('phụ kiện đi kèm')
            );
          });
          if (isMounted) setHasAccessories(foundAccessories);
        } else {
          if (isMounted) {
            setWeightByType({ SUS304: 0, SS400: 0, OTHER: 0 });
            setMaterialsCost(0);
            setHasAccessories(false);
          }
        }

        // 2) Tính chi phí nhân công từ work_sessions của dự án này
        const sessionsSnap = await getDocs(
          query(
            collection(db, 'work_sessions'),
            where('projectId', '==', projectId),
            where('endTime', '!=', null)
          )
        );

        // Gom theo workerId
        const sessions = [];
        sessionsSnap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
        const byWorker = new Map();
        for (const s of sessions) {
          const wid = s.workerId;
          if (!wid) continue;
          const durationHours = Number(s.durationInHours || 0);
          const minutes = Math.round(durationHours * 60);
          const curr = byWorker.get(wid) || {
            workerId: wid,
            workerName: s.workerName || 'Không tên',
            minutes: 0,
            stages: new Set(),
          };
          curr.minutes += minutes;
          if (s.stageName) curr.stages.add(s.stageName);
          byWorker.set(wid, curr);
        }

        // Lấy lương của từng worker và tính cost
        let totalLabor = 0;
        const breakdown = [];
        for (const [wid, info] of byWorker.entries()) {
          const userDoc = await getUserById(wid);
          const dailySalary = Number(userDoc?.dailySalary || 0);
          const monthlySalary = Number(userDoc?.monthlySalary || 0);
          // Quy đổi lương theo giờ
          let hourlyRate = 0;
          if (dailySalary > 0) hourlyRate = dailySalary / 8;
          else if (monthlySalary > 0) hourlyRate = monthlySalary / 30 / 8; // 30 ngày ~ ví dụ của bạn

          const cost = (hourlyRate * info.minutes) / 60;
          totalLabor += cost;
          breakdown.push({
            workerId: wid,
            workerName: info.workerName,
            minutes: info.minutes,
            stages: Array.from(info.stages),
            cost,
          });
        }

        if (isMounted) {
          setWorkerBreakdown(breakdown);
          setLaborCost(totalLabor);
        }

        // Lưu chi phí vào collection expenses
        try {
          const expenseData = {
            projectName: projectName || 'Dự án không tên',
            materialCost: computedMaterialCost,
            laborCost: totalLabor,
            accessoryCost:
              parseInt((accessoryPrice || '0').replace(/[^0-9]/g, ''), 10) || 0,
            totalCost:
              computedMaterialCost +
              totalLabor +
              (parseInt((accessoryPrice || '0').replace(/[^0-9]/g, ''), 10) ||
                0),
            materialBreakdown: computedWeights,
            laborBreakdown: breakdown,
          };

          console.log('💾 Lưu chi phí dự án (upsert):', projectId, expenseData);
          await upsertProjectExpense(projectId, expenseData);
        } catch (expenseError) {
          console.error('❌ Lỗi khi lưu chi phí:', expenseError);
        }
      } catch (e) {
        console.error('Expense calc error:', e);
        if (isMounted) setError(e.message || 'Có lỗi xảy ra');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Chi phí dự án
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tính toán...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={60}
            color={theme.textMuted}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {error}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Project */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {projectName ? `Dự án: ${projectName}` : 'Dự án hiện tại'}
            </Text>
            {weightLabel ? (
              <Text style={[styles.subtle, { color: theme.textSecondary }]}>
                Khối lượng: {weightLabel}
              </Text>
            ) : null}
          </View>

          {/* Materials summary */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Vật liệu
            </Text>
            <View style={styles.rowJustify}>
              <Text style={{ color: theme.textSecondary }}>SUS304</Text>
              <Text style={{ color: theme.text }}>
                {toCurrency(weightByType.SUS304 * getRateByMaterial('SUS304'))}
              </Text>
            </View>
            <View style={styles.rowJustify}>
              <Text style={{ color: theme.textSecondary }}>SS400</Text>
              <Text style={{ color: theme.text }}>
                {toCurrency(weightByType.SS400 * getRateByMaterial('SS400'))}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.rowJustify}>
              <Text style={[styles.bold, { color: theme.text }]}>
                Tổng vật liệu
              </Text>
              <Text style={[styles.bold, { color: theme.text }]}>
                {toCurrency(materialsCost)}
              </Text>
            </View>
          </View>

          {/* Accessories */}
          {hasAccessories && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Phụ kiện
              </Text>
              <View style={[styles.row, { alignItems: 'center' }]}>
                <Text style={{ color: theme.textSecondary, marginRight: 10 }}>
                  Giá phụ kiện:
                </Text>
                <View style={[styles.inputBox, { borderColor: theme.border }]}>
                  <TextInput
                    value={accessoryPrice}
                    onChangeText={(t) =>
                      setAccessoryPrice(t.replace(/[^0-9]/g, ''))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    style={{ color: theme.text, paddingVertical: 6 }}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Labor breakdown */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Nhân công
            </Text>
            {workerBreakdown.length === 0 ? (
              <Text style={{ color: theme.textSecondary }}>
                Chưa có dữ liệu nhân công.
              </Text>
            ) : (
              <View>
                {workerBreakdown.map((w) => (
                  <View key={w.workerId} style={styles.workerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bold, { color: theme.text }]}>
                        {w.workerName} ({formatMinutesToHM(w.minutes)})
                      </Text>
                      {w.stages && w.stages.length > 0 && (
                        <Text style={{ color: theme.textSecondary }}>
                          {w.stages.join(', ')}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.bold, { color: theme.text }]}>
                      {toCurrency(w.cost)}
                    </Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.rowJustify}>
                  <Text style={[styles.bold, { color: theme.text }]}>
                    Tổng nhân công
                  </Text>
                  <Text style={[styles.bold, { color: theme.text }]}>
                    {toCurrency(laborCost)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Summary table */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Tổng hợp chi phí
            </Text>
            <View style={styles.rowJustify}>
              <Text style={{ color: theme.textSecondary }}>Vật liệu</Text>
              <Text style={{ color: theme.text }}>
                {toCurrency(materialsCost)}
              </Text>
            </View>
            <View style={styles.rowJustify}>
              <Text style={{ color: theme.textSecondary }}>Nhân công</Text>
              <Text style={{ color: theme.text }}>{toCurrency(laborCost)}</Text>
            </View>
            <View style={styles.rowJustify}>
              <Text style={{ color: theme.textSecondary }}>Phụ kiện</Text>
              <Text style={{ color: theme.text }}>
                {toCurrency(
                  parseInt(
                    (accessoryPrice || '0').replace(/[^0-9]/g, ''),
                    10
                  ) || 0
                )}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.rowJustify}>
              <Text style={[styles.bold, { color: theme.text }]}>
                Tổng cộng
              </Text>
              <Text style={[styles.bold, { color: theme.text }]}>
                {toCurrency(totalCost)}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  content: {
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtle: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#eaeaea',
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
  },
  rowJustify: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bold: {
    fontWeight: '700',
  },
  inputBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});

export default ExpenseListScreen;
