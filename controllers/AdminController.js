const { Op } = require("sequelize");
const { Sale, SalePayment } = require("../models"); // Шлях може відрізнятися залежно від папки
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

exports.getStaffPage = async (req, res) => {
  try {
    // 1. Отримуємо всі зміни з БД (разом з іменами касирів)
    const shiftsRaw = await sequelize.query(
      `
            SELECT s.*, u.username AS cashier_name
            FROM shifts s
            JOIN employees u ON s.employee_id = u.id
            ORDER BY s.start_time DESC;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 2. Проходимося по кожній зміні і рахуємо фінанси так само, як у Z-звіті
    const shiftsWithStats = await Promise.all(
      shiftsRaw.map(async (shift) => {
        // Шукаємо чеки цієї зміни
        const shiftSales = await Sale.findAll({
          where: { shift_id: shift.id },
        });
        const saleIds = shiftSales.map((s) => s.id);

        let cashTotal = 0;
        let cardTotal = 0;
        let pointsTotal = 0;
        let totalBonusEarned = 0;

        // Рахуємо нараховані бонуси
        shiftSales.forEach((sale) => {
          totalBonusEarned += parseFloat(sale.bonus_earned) || 0;
        });

        // Рахуємо методи оплат з таблиці SalePayment
        if (saleIds.length > 0) {
          const payments = await SalePayment.findAll({
            where: { sale_id: { [Op.in]: saleIds } },
          });

          payments.forEach((p) => {
            const amt = parseFloat(p.amount) || 0;
            if (p.method === "Cash") cashTotal += amt;
            if (p.method === "Card") cardTotal += amt;
            if (p.method === "Points") pointsTotal += amt;
          });
        }

        const startingCash = parseFloat(shift.starting_cash) || 0;
        const totalHandedOver = startingCash + cashTotal;

        // Збираємо фінальний об'єкт для таблиці
        return {
          ...shift,
          cash_revenue: cashTotal,
          card_revenue: cardTotal,
          bonuses_spent: pointsTotal,
          bonuses_earned: totalBonusEarned,
          total_handed_over: totalHandedOver,
        };
      }),
    );

    // 3. Відправляємо оновлений масив на сторінку
    res.render("admin/staff", {
      title: "Персонал та Каси",
      path: "/admin/staff",
      user: req.user,
      shifts: shiftsWithStats, // ТУТ ТЕПЕР ПОВНІ ДАНІ
    });
  } catch (error) {
    console.error("Помилка завантаження сторінки персоналу:", error);
    res.status(500).send("Помилка сервера");
  }
};

exports.getWarehousePage = async (req, res) => {
  try {
    // 1. ОБОВ'ЯЗКОВО витягуємо категорії з БД (саме цього зараз не вистачає)
    const categories = await sequelize.query(
      `
            SELECT id, name FROM categories ORDER BY name ASC;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 1. ДОДАЄМО: Витягуємо товари для випадаючого списку
    const products = await sequelize.query(
      `SELECT id, name, sku FROM products ORDER BY name ASC;`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 2. ДОДАЄМО: Витягуємо постачальників для випадаючого списку
    const suppliers = await sequelize.query(
      `SELECT id, name FROM suppliers ORDER BY name ASC;`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 2. Витягуємо інвентар
    const inventory = await sequelize.query(
      `
            SELECT 
                b.id AS batch_id,
                p.sku AS article,
                p.name AS product_name,
                c.id AS category_id,
                c.name AS category_name,
                b.quantity,
                p.uom AS unit,
                s.name AS supplier_name,
                b.expiry_date,
                b.status
            FROM batches b
            JOIN products p ON b.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s ON b.supplier_id = s.id
            ORDER BY b.expiry_date ASC;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 3. ОБОВ'ЯЗКОВО передаємо обидва масиви на сторінку
    res.render("admin/warehouse", {
      title: "Управління складом",
      path: "/admin/warehouse",
      user: req.user,
      inventory: inventory,
      categories: categories,
      products: products, // Передаємо на сторінку
      suppliers: suppliers, // Передаємо на сторінку
    });
  } catch (error) {
    console.error("Помилка завантаження сторінки складу:", error);
    res.status(500).send("Помилка сервера");
  }
};

exports.postReceiveBatch = async (req, res) => {
  const { product_id, supplier_id, quantity, purchase_price, expiry_date } =
    req.body;
  const employee_id = req.user.id; // ID адміна, хто робить прийом

  const transaction = await sequelize.transaction();

  try {
    // 1. Додаємо партію в batches
    const newBatch = await sequelize.query(
      `
            INSERT INTO batches (product_id, supplier_id, quantity, expiry_date, purchase_price, status)
            VALUES (:product_id, :supplier_id, :quantity, :expiry_date, :purchase_price, 'Active')
            RETURNING id;
        `,
      {
        replacements: {
          product_id,
          supplier_id,
          quantity,
          expiry_date,
          purchase_price,
        },
        transaction,
      },
    );

    const batch_id = newBatch[0][0].id;

    // 2. Додаємо запис у inventory_logs
    await sequelize.query(
      `
            INSERT INTO inventory_logs (batch_id, employee_id, operation_type, quantity_changed, reason, operation_date)
            VALUES (:batch_id, :employee_id, 'Delivery', :quantity, 'Прийом нової партії', NOW());
        `,
      {
        replacements: { batch_id, employee_id, quantity },
        transaction,
      },
    );

    await transaction.commit();
    res.json({ success: true, message: "Партія успішно прийнята!" });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: "Помилка прийому товару" });
  }
};
