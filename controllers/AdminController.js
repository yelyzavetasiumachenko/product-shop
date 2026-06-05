const { sequelize, Sale, SaleItem, Product, Batch } = require("../models");
const { Op } = require("sequelize");

exports.getDashboard = async (req, res) => {
  try {
    // 1. Розрахунок KPI (За поточну дату - наприклад, 2026-06-03)
    const todayStr = "2026-06-03"; // У реальному проєкті: new Date().toISOString().split('T')[0]

    // Виторг за сьогодні
    const todayRevenue =
      (await Sale.sum("total_amount", {
        where: sequelize.where(
          sequelize.fn("DATE", sequelize.col("sale_date")),
          todayStr,
        ),
      })) || 0;

    // Кількість чеків за сьогодні
    const totalChecks = await Sale.count({
      where: sequelize.where(
        sequelize.fn("DATE", sequelize.col("sale_date")),
        todayStr,
      ),
    });

    // Кількість партій на карантині
    const quarantineItems = await Batch.count({
      where: { status: "Quarantine" },
    });

    // 2. Дані для графіка Chart.js (Виторг за останні 7 днів)
    // Використовуємо чистий SQL-запит для точного групування по днях
    const revenueData = await sequelize.query(
      `
      SELECT 
        TO_CHAR(sale_date, 'DD.MM') AS date_label,
        SUM(total_amount) AS daily_sum
      FROM sales
      GROUP BY TO_CHAR(sale_date, 'DD.MM'), DATE_TRUNC('day', sale_date)
      ORDER BY DATE_TRUNC('day', sale_date) ASC
      LIMIT 7
    `,
      { type: sequelize.QueryTypes.SELECT },
    );

    const chartLabels = revenueData.map((item) => item.date_label);
    const chartData = revenueData.map((item) => parseFloat(item.daily_sum));

    // 3. ТОП-3 товари за кількістю продажів
    const topProducts = await sequelize.query(
      `
      SELECT 
        p.name,
        SUM(si.quantity_sold) AS sold_qty
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN products p ON b.product_id = p.id
      GROUP BY p.name
      ORDER BY sold_qty DESC
      LIMIT 3
    `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // Рендеринг сторінки з передачею всієї зібраної аналітики
    res.render("admin/dashboard", {
      user: { username: "admin_yelyzaveta" }, // Емуляція авторизованого користувача
      kpi: {
        todayRevenue: parseFloat(todayRevenue).toFixed(2),
        totalChecks,
        quarantineItems,
      },
      chartLabels,
      chartData,
      topProducts,
    });
  } catch (error) {
    console.error("Помилка завантаження дашборду директора:", error);
    res.status(500).send("Внутрішня помилка сервера");
  }
};
