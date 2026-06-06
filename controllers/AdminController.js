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
// 1. Отримання денних метрик (Верхні картки)
exports.getDailyStats = async (req, res) => {
  try {
    const selectedDate = req.query.date;

    // Запит тільки для продажів (Виторг, Кількість чеків, Середній чек)
    const [dailyStats] = await sequelize.query(
      `
            SELECT 
                COUNT(id) AS total_receipts,
                COALESCE(SUM(total_amount), 0) AS total_revenue,
                COALESCE(AVG(total_amount), 0) AS avg_receipt
            FROM sales 
            WHERE DATE(sale_date) = :date;
        `,
      {
        replacements: { date: selectedDate },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    res.json({
      success: true,
      revenue: parseFloat(dailyStats?.total_revenue || 0).toFixed(2),
      receipts: dailyStats?.total_receipts || 0,
      avgReceipt: parseFloat(dailyStats?.avg_receipt || 0).toFixed(2),
    });
  } catch (error) {
    console.error("Помилка денної статистики:", error);
    res.status(500).json({ success: false, message: "Помилка БД" });
  }
};

// 2. Отримання статистики за період (Графік та ТОП-3)
exports.getPeriodStats = async (req, res) => {
  try {
    const { start, end } = req.query;

    // Дані для графіка (групуємо по днях у межах періоду)
    const chartData = await sequelize.query(
      `
            SELECT 
                TO_CHAR(sale_date, 'DD.MM') AS sale_day,
                COALESCE(SUM(total_amount), 0) AS daily_revenue
            FROM sales
            WHERE DATE(sale_date) >= :start AND DATE(sale_date) <= :end
            GROUP BY DATE(sale_date), TO_CHAR(sale_date, 'DD.MM')
            ORDER BY DATE(sale_date) ASC;
        `,
      {
        replacements: { start: start, end: end },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    const topProducts = await sequelize.query(
      `
            SELECT 
                p.name AS product_name,
                CASE p.uom
                    WHEN 'Kilogram' THEN 'кг'
                    WHEN 'Liter' THEN 'л'
                    WHEN 'Piece' THEN 'шт'
                    ELSE 'шт' 
                END AS product_unit,
                SUM(si.quantity_sold) AS total_sold 
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN batches b ON si.batch_id = b.id
            JOIN products p ON b.product_id = p.id
            WHERE DATE(s.sale_date) >= :start AND DATE(s.sale_date) <= :end
            GROUP BY p.name, p.uom
            ORDER BY total_sold DESC
            LIMIT 3;
        `,
      {
        replacements: { start: start, end: end },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    res.json({ success: true, chartData, topProducts });
  } catch (error) {
    console.error("Помилка періодичної статистики:", error);
    res.status(500).json({ success: false, message: "Помилка БД" });
  }
};

// 3. Отримання детального списку товарів на карантині (Для модального вікна)
// exports.getQuarantineDetails = async (req, res) => {
//   try {
//     const items = await sequelize.query(
//       `
//             SELECT
//                 p.name AS product_name,
//                 p.barcode,
//                 b.quantity,
//                 'Перебуває на карантині' AS reason
//             FROM batches b
//             JOIN products p ON b.product_id = p.id
//             WHERE b.status = 'Quarantine'
//             ORDER BY p.name ASC;
//         `,
//       { type: sequelize.QueryTypes.SELECT },
//     );

//     res.json({ success: true, items });
//   } catch (error) {
//     console.error("Помилка завантаження карантину:", error);
//     res.status(500).json({ success: false, message: "Помилка БД" });
//   }
// };

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
