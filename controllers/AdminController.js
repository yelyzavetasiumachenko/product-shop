// const { sequelize, Sale, SaleItem, Product, Batch } = require("../models");
// const { Op } = require("sequelize");

// exports.getDashboard = async (req, res) => {
//   try {
//     // 1. Розрахунок KPI (За поточну дату - наприклад, 2026-06-03)
//     const todayStr = "2026-06-03"; // У реальному проєкті: new Date().toISOString().split('T')[0]

//     // Виторг за сьогодні
//     const todayRevenue =
//       (await Sale.sum("total_amount", {
//         where: sequelize.where(
//           sequelize.fn("DATE", sequelize.col("sale_date")),
//           todayStr,
//         ),
//       })) || 0;

//     // Кількість чеків за сьогодні
//     const totalChecks = await Sale.count({
//       where: sequelize.where(
//         sequelize.fn("DATE", sequelize.col("sale_date")),
//         todayStr,
//       ),
//     });

//     // Кількість партій на карантині
//     const quarantineItems = await Batch.count({
//       where: { status: "Quarantine" },
//     });

//     // 2. Дані для графіка Chart.js (Виторг за останні 7 днів)
//     // Використовуємо чистий SQL-запит для точного групування по днях
//     const revenueData = await sequelize.query(
//       `
//       SELECT
//         TO_CHAR(sale_date, 'DD.MM') AS date_label,
//         SUM(total_amount) AS daily_sum
//       FROM sales
//       GROUP BY TO_CHAR(sale_date, 'DD.MM'), DATE_TRUNC('day', sale_date)
//       ORDER BY DATE_TRUNC('day', sale_date) ASC
//       LIMIT 7
//     `,
//       { type: sequelize.QueryTypes.SELECT },
//     );

//     const chartLabels = revenueData.map((item) => item.date_label);
//     const chartData = revenueData.map((item) => parseFloat(item.daily_sum));

//     // 3. ТОП-3 товари за кількістю продажів
//     const topProducts = await sequelize.query(
//       `
//       SELECT
//         p.name,
//         SUM(si.quantity_sold) AS sold_qty
//       FROM sale_items si
//       JOIN batches b ON si.batch_id = b.id
//       JOIN products p ON b.product_id = p.id
//       GROUP BY p.name
//       ORDER BY sold_qty DESC
//       LIMIT 3
//     `,
//       { type: sequelize.QueryTypes.SELECT },
//     );

//     // Рендеринг сторінки з передачею всієї зібраної аналітики
//     res.render("admin/dashboard", {
//       user: { username: "admin_yelyzaveta" }, // Емуляція авторизованого користувача
//       kpi: {
//         todayRevenue: parseFloat(todayRevenue).toFixed(2),
//         totalChecks,
//         quarantineItems,
//       },
//       chartLabels,
//       chartData,
//       topProducts,
//     });
//   } catch (error) {
//     console.error("Помилка завантаження дашборду директора:", error);
//     res.status(500).send("Внутрішня помилка сервера");
//   }
// };

const { sequelize } = require("../models");

// Рендер самої сторінки (у нас вже є в routes, але правильніше тримати тут)
exports.getDashboard = (req, res) => {
  res.render("admin/dashboard");
};

// API для отримання статистики (Сирі SQL запити)
exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Виторг та кількість чеків за сьогодні
    const [dailyStats] = await sequelize.query(
      `
            SELECT 
                COUNT(id) AS total_receipts,
                COALESCE(SUM(total_amount), 0) AS total_revenue
            FROM sales 
            WHERE DATE(sale_date) = CURRENT_DATE;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 2. Товарів на карантині (протерміновані або списані)
    const [quarantineStats] = await sequelize.query(
      `
            SELECT COUNT(id) AS quarantine_count
            FROM batches
            WHERE status IN ('Expired', 'Disposed') OR expiry_date < CURRENT_DATE;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 3. Динаміка продажів за останні 7 днів (для графіка)
    const weeklySales = await sequelize.query(
      `
            SELECT 
                TO_CHAR(sale_date, 'DD.MM') AS sale_day,
                COALESCE(SUM(total_amount), 0) AS daily_revenue
            FROM sales
            WHERE sale_date >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY DATE(sale_date), TO_CHAR(sale_date, 'DD.MM')
            ORDER BY DATE(sale_date) ASC;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 4. ТОП-3 товари (JOIN трьох таблиць)
    const topProducts = await sequelize.query(
      `
            SELECT 
                p.name AS product_name,
                SUM(si.quantity_sold) AS total_sold
            FROM sale_items si
            JOIN batches b ON si.batch_id = b.id
            JOIN products p ON b.product_id = p.id
            GROUP BY p.name
            ORDER BY total_sold DESC
            LIMIT 3;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // Відправляємо зібрані дані на фронтенд
    res.json({
      success: true,
      revenue: parseFloat(dailyStats.total_revenue).toFixed(2),
      receipts: dailyStats.total_receipts,
      quarantine: quarantineStats.quarantine_count,
      chartData: weeklySales,
      topProducts: topProducts,
    });
  } catch (error) {
    console.error("Помилка SQL Дашборду:", error);
    res
      .status(500)
      .json({ success: false, message: "Помилка завантаження статистики" });
  }
};

// Сторінка "Персонал та Каси" (Історія змін)
exports.getStaffPage = async (req, res) => {
  try {
    // Сирий SQL-запит: Об'єднуємо зміни з іменами касирів
    const shiftsHistory = await sequelize.query(
      `
            SELECT 
                s.id AS shift_id,
                e.username AS cashier_name,
                s.start_time,
                s.end_time,
                s.starting_cash,
                s.expected_cash
            FROM shifts s
            JOIN employees e ON s.employee_id = e.id
            ORDER BY s.start_time DESC
            LIMIT 50; -- Показуємо останні 50 змін
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // Рендеримо нову сторінку і передаємо туди масив shiftsHistory
    res.render("admin/staff", { shifts: shiftsHistory });
  } catch (error) {
    console.error("Помилка завантаження персоналу:", error);
    res.status(500).send("Внутрішня помилка сервера");
  }
};
