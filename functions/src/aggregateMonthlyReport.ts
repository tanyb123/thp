import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

/**
 * Cloud Function that runs on the 1st of every month at 2:01 AM
 * to aggregate financial data for the previous month
 */
export const aggregateMonthlyReport = functions.pubsub
  .schedule('1 2 1 * *') // Run at 2:01 AM on the 1st of every month
  .timeZone('Asia/Ho_Chi_Minh')
  .onRun(async (context) => {
    try {
      console.log('Starting monthly financial report aggregation...');

      const db = admin.firestore();

      // Get the previous month (1 is February, 0 is January, etc.)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-based index

      // If current month is January (0), then previous month is December (11) of the previous year
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      console.log(`Aggregating data for ${prevYear}-${prevMonth + 1}`);

      // Create month ID in the format YYYY-MM
      const monthId = `${prevYear}-${(prevMonth + 1)
        .toString()
        .padStart(2, '0')}`;

      // Get start and end dates for the previous month
      const startDate = new Date(prevYear, prevMonth, 1);
      const endDate = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999); // Last day of the month

      console.log(
        `Date range: ${startDate.toISOString()} - ${endDate.toISOString()}`
      );

      // Get all paid invoices for the previous month
      const invoicesSnapshot = await db
        .collection('invoices')
        .where('status', '==', 'paid')
        .where('paidDate', '>=', startDate)
        .where('paidDate', '<=', endDate)
        .get();

      // Calculate total revenue
      let totalRevenue = 0;
      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data();
        totalRevenue += invoice.amount || 0;
      });

      console.log(`Total revenue for ${monthId}: ${totalRevenue}`);

      // Get all expenses for the previous month
      const expensesSnapshot = await db
        .collection('expenses')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

      // Calculate total expenses and categorize them
      let totalExpenses = 0;
      const expenseBreakdown = {
        material: 0,
        labor: 0,
        overhead: 0,
      };

      expensesSnapshot.forEach((doc) => {
        const expense = doc.data();
        const amount = expense.amount || 0;

        // Add to total expenses
        totalExpenses += amount;

        // Categorize expense
        if (expense.projectId) {
          // Direct project expense
          if (expense.type === 'material') {
            expenseBreakdown.material += amount;
          } else if (expense.type === 'labor') {
            expenseBreakdown.labor += amount;
          } else {
            // Uncategorized project expense goes to material as default
            expenseBreakdown.material += amount;
          }
        } else {
          // No projectId means overhead/indirect expense
          expenseBreakdown.overhead += amount;
        }
      });

      console.log(`Total expenses for ${monthId}: ${totalExpenses}`);

      // Calculate profit
      const profit = totalRevenue - totalExpenses;

      // Create or update the monthly summary document
      await db
        .collection('monthly_summaries')
        .doc(monthId)
        .set({
          year: prevYear,
          month: prevMonth + 1,
          totalRevenue,
          totalExpenses,
          profit,
          expenseBreakdown,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`Successfully generated financial report for ${monthId}`);
      return null;
    } catch (error) {
      console.error('Error generating monthly financial report:', error);
      throw error;
    }
  });
 