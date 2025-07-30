import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();

/**
 * Scheduled function to aggregate financial data for the director's dashboard
 * Runs daily at 1:00 AM Vietnam time
 */
export const aggregateDashboardData = functions.scheduler.onSchedule(
  {
    schedule: '0 1 * * *',
    timeZone: 'Asia/Ho_Chi_Minh',
    region: 'asia-southeast1',
  },
  async (context) => {
    try {
      console.log('Starting dashboard data aggregation');

      // Get all payable transactions
      const payableSnapshot = await db.collection('payable_transactions').get();
      const transactions = payableSnapshot.docs.map((doc) => doc.data());

      // Calculate total accounts payable (phải trả)
      const payableTransactions = transactions.filter(
        (t) => t.type === 'payable'
      );
      const totalAccountsPayable = payableTransactions.reduce(
        (sum, t) => sum + (t.remainingAmount || 0),
        0
      );

      // Calculate total accounts receivable (phải thu)
      const receivableTransactions = transactions.filter(
        (t) => t.type === 'receivable'
      );
      const totalAccountsReceivable = receivableTransactions.reduce(
        (sum, t) => sum + (t.remainingAmount || 0),
        0
      );

      // Calculate net debt position (negative means company owes more than it's owed)
      const netDebtPosition = totalAccountsReceivable - totalAccountsPayable;

      // Calculate top 5 suppliers by outstanding amount (phải trả)
      const supplierTotals: Record<string, number> = {};
      payableTransactions.forEach((t) => {
        if (!supplierTotals[t.supplier]) {
          supplierTotals[t.supplier] = 0;
        }
        supplierTotals[t.supplier] += t.remainingAmount || 0;
      });

      const top5Payable = Object.entries(supplierTotals)
        .map(([supplier, amount]) => ({ supplier, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((item) => ({
          ...item,
          // Convert to millions for display
          amountInMillions:
            Math.round((Number(item.amount) / 1000000) * 100) / 100,
        }));

      // Calculate top 5 customers by outstanding amount (phải thu)
      const customerTotals: Record<string, number> = {};
      receivableTransactions.forEach((t) => {
        if (!customerTotals[t.supplier]) {
          // supplier field is used for both suppliers and customers
          customerTotals[t.supplier] = 0;
        }
        customerTotals[t.supplier] += t.remainingAmount || 0;
      });

      const top5Receivable = Object.entries(customerTotals)
        .map(([customer, amount]) => ({ customer, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((item) => ({
          ...item,
          // Convert to millions for display
          amountInMillions:
            Math.round((Number(item.amount) / 1000000) * 100) / 100,
        }));

      // Save aggregated data to Firestore
      await db
        .collection('summaries')
        .doc('directorDashboard')
        .set({
          totalAccountsPayable,
          totalAccountsReceivable,
          netDebtPosition,
          top5Payable,
          top5Receivable,
          lastUpdated: Timestamp.now(),
          formattedTotals: {
            totalAccountsPayable: formatCurrency(totalAccountsPayable),
            totalAccountsReceivable: formatCurrency(totalAccountsReceivable),
            netDebtPosition: formatCurrency(netDebtPosition),
          },
        });

      console.log('Dashboard data aggregation completed successfully');
    } catch (error) {
      console.error('Error aggregating dashboard data:', error);
      throw error;
    }
  }
);

/**
 * Format currency for display (VND)
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
