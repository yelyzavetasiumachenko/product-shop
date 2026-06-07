const { Op } = require("sequelize");
const { Sale, SalePayment } = require("../models"); // Шлях може відрізнятися залежно від папки
const { sequelize } = require("../models");
const crypto = require("crypto");

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
      user: req.session.user,
      shifts: shiftsWithStats, // ТУТ ТЕПЕР ПОВНІ ДАНІ
    });
  } catch (error) {
    console.error("Помилка завантаження сторінки персоналу:", error);
    res.status(500).send("Помилка сервера");
  }
};

// exports.getWarehousePage = async (req, res) => {
//   try {
//     // 1. ОБОВ'ЯЗКОВО витягуємо категорії з БД (саме цього зараз не вистачає)
//     const categories = await sequelize.query(
//       `
//             SELECT id, name FROM categories ORDER BY name ASC;
//         `,
//       { type: sequelize.QueryTypes.SELECT },
//     );

//     // 1. ДОДАЄМО: Витягуємо товари для випадаючого списку
//     const products = await sequelize.query(
//       `SELECT id, name, sku FROM products ORDER BY name ASC;`,
//       { type: sequelize.QueryTypes.SELECT },
//     );

//     // 2. ДОДАЄМО: Витягуємо постачальників для випадаючого списку
//     const suppliers = await sequelize.query(
//       `SELECT id, name FROM suppliers ORDER BY name ASC;`,
//       { type: sequelize.QueryTypes.SELECT },
//     );

//     // 2. Витягуємо інвентар
//     const inventory = await sequelize.query(
//       `
//             SELECT
//                 b.id AS batch_id,
//                 p.sku AS article,
//                 p.name AS product_name,
//                 c.id AS category_id,
//                 c.name AS category_name,
//                 b.quantity,
//                 p.uom AS unit,
//                 s.name AS supplier_name,
//                 b.expiry_date,
//                 b.status
//             FROM batches b
//             JOIN products p ON b.product_id = p.id
//             LEFT JOIN categories c ON p.category_id = c.id
//             LEFT JOIN suppliers s ON b.supplier_id = s.id
//             ORDER BY b.expiry_date ASC;
//         `,
//       { type: sequelize.QueryTypes.SELECT },
//     );

//     // 3. ОБОВ'ЯЗКОВО передаємо обидва масиви на сторінку
//     res.render("admin/warehouse", {
//       title: "Управління складом",
//       path: "/admin/warehouse",
//       user: req.user,
//       inventory: inventory,
//       categories: categories,
//       products: products, // Передаємо на сторінку
//       suppliers: suppliers, // Передаємо на сторінку
//     });
//   } catch (error) {
//     console.error("Помилка завантаження сторінки складу:", error);
//     res.status(500).send("Помилка сервера");
//   }
// };

exports.getWarehousePage = async (req, res) => {
  try {
    const categories = await sequelize.query(
      `SELECT id, name FROM categories ORDER BY name ASC;`,
      { type: sequelize.QueryTypes.SELECT },
    );
    const products = await sequelize.query(
      `SELECT id, name, sku FROM products ORDER BY name ASC;`,
      { type: sequelize.QueryTypes.SELECT },
    );
    const suppliers = await sequelize.query(
      `SELECT id, name FROM suppliers ORDER BY name ASC;`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 1. Залишки
    const inventory = await sequelize.query(
      `
            SELECT 
                b.id AS batch_id, p.sku AS article, p.name AS product_name, c.id AS category_id,
                c.name AS category_name, b.quantity, p.uom AS unit, s.name AS supplier_name,
                b.expiry_date, b.status
            FROM batches b
            JOIN products p ON b.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s ON b.supplier_id = s.id
            ORDER BY b.expiry_date ASC;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 2. ДОДАЄМО: Логи інвентаризації (останні 100 записів)
    const logs = await sequelize.query(
      `
            SELECT 
                l.operation_type, l.quantity_changed, l.reason, l.operation_date,
                p.sku, p.name AS product_name, e.username AS employee_name
            FROM inventory_logs l
            LEFT JOIN batches b ON l.batch_id = b.id
            LEFT JOIN products p ON b.product_id = p.id
            LEFT JOIN employees e ON l.employee_id = e.id
            ORDER BY l.operation_date DESC
            LIMIT 100;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 3. ДОДАЄМО: Замовлення (PO)
    // УВАГА: Якщо у вас інші назви колонок у purchase_orders (наприклад, created_at замість order_date), змініть їх у запиті!
    // const purchaseOrders = await sequelize.query(
    //   `
    //         SELECT
    //             po.id, po.status, s.name AS supplier_name /*, po.total_amount, po.created_at */
    //         FROM purchase_orders po
    //         LEFT JOIN suppliers s ON po.supplier_id = s.id
    //         -- ORDER BY po.created_at DESC;
    //     `,
    //   { type: sequelize.QueryTypes.SELECT },
    // );
    // 3. ДОДАЄМО: Замовлення (PO) з деталями про товари та сумою
    // 3. ДОДАЄМО: Замовлення (PO) з правильними одиницями виміру
    // 3. ДОДАЄМО: Замовлення (PO) з правильними одиницями виміру
    const purchaseOrders = await sequelize.query(
      `
            SELECT 
                po.id, 
                po.status, 
                s.name AS supplier_name,
                po.expected_delivery_date,
                -- Збираємо товари у красивий список, перетворюючи uom у текст (::text)
                STRING_AGG(
                    '• ' || p.name || ' (' || ROUND(poi.ordered_quantity, 2) || ' ' || 
                    CASE p.uom::text 
                        WHEN 'Piece' THEN 'шт' 
                        WHEN 'Kilogram' THEN 'кг' 
                        WHEN 'Liter' THEN 'л' 
                        ELSE 'шт' 
                    END || ')', 
                    '<br>'
                ) AS products_list,
                SUM(poi.ordered_quantity * poi.agreed_price) AS total_sum
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
            LEFT JOIN products p ON poi.product_id = p.id
            GROUP BY po.id, po.status, s.name, po.expected_delivery_date
            ORDER BY po.expected_delivery_date DESC;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    res.render("admin/warehouse", {
      title: "Управління складом",
      path: "/admin/warehouse",
      user: req.session.user,
      inventory: inventory,
      categories: categories,
      products: products,
      suppliers: suppliers,
      logs: logs, // Передаємо логи
      purchaseOrders: purchaseOrders, // Передаємо замовлення
    });
  } catch (error) {
    console.error("Помилка завантаження сторінки складу:", error);
    res.status(500).send("Помилка сервера");
  }
};

exports.postReceiveBatch = async (req, res) => {
  const { product_id, supplier_id, quantity, purchase_price, expiry_date } =
    req.body;

  // Беремо ID з req.admin, який турботливо підготував наш мідлвар
  const employee_id = req.admin.id;

  const transaction = await sequelize.transaction();

  try {
    const batch_id = crypto.randomUUID();
    const log_id = crypto.randomUUID();

    // 1. Додаємо партію в batches
    await sequelize.query(
      `
      INSERT INTO batches (id, product_id, supplier_id, quantity, expiry_date, purchase_price, status)
      VALUES (:batch_id, :product_id, :supplier_id, :quantity, :expiry_date, :purchase_price, 'Active')
      `,
      {
        replacements: {
          batch_id,
          product_id,
          supplier_id,
          quantity,
          expiry_date,
          purchase_price: purchase_price || 0,
        },
        transaction,
      },
    );

    // 2. Додаємо запис у inventory_logs
    await sequelize.query(
      `
      INSERT INTO inventory_logs (id, batch_id, employee_id, operation_type, quantity_changed, reason, operation_date)
      VALUES (:log_id, :batch_id, :employee_id, 'Delivery', :quantity, 'Прийом нової партії', NOW());
      `,
      {
        replacements: { log_id, batch_id, employee_id, quantity },
        transaction,
      },
    );

    await transaction.commit();
    res.json({ success: true, message: "Партія успішно прийнята!" });
  } catch (error) {
    await transaction.rollback();
    console.error("Помилка прийому товару:", error);
    res
      .status(500)
      .json({ success: false, message: "Помилка сервера: " + error.message });
  }
};

exports.postDisposeBatch = async (req, res) => {
  const { batch_id, reason } = req.body;

  // Беремо ID з req.admin
  const employee_id = req.admin.id;

  const transaction = await sequelize.transaction();

  try {
    const [batch] = await sequelize.query(
      `SELECT quantity FROM batches WHERE id = :batch_id`,
      {
        replacements: { batch_id },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      },
    );

    if (!batch) throw new Error("Партію не знайдено");

    const quantityToDispose = batch.quantity;
    // РОБИМО ЧИСЛО ВІД'ЄМНИМ ПРЯМО В JS:
    const negativeQuantity = -Math.abs(quantityToDispose);
    const log_id = crypto.randomUUID();

    await sequelize.query(
      `UPDATE batches SET status = 'Disposed', quantity = 0 WHERE id = :batch_id`,
      { replacements: { batch_id }, transaction },
    );

    // В SQL ЗАБИРАЄМО МІНУС І ПЕРЕДАЄМО НОВУ ЗМІННУ:
    await sequelize.query(
      `
      INSERT INTO inventory_logs (id, batch_id, employee_id, operation_type, quantity_changed, reason, operation_date)
      VALUES (:log_id, :batch_id, :employee_id, 'Disposal', :negativeQuantity, :reason, NOW());
      `,
      {
        replacements: {
          log_id,
          batch_id,
          employee_id,
          negativeQuantity,
          reason,
        },
        transaction,
      },
    );

    await transaction.commit();
    res.json({ success: true });
  } catch (error) {
    await transaction.rollback();
    console.error("Помилка списання:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClientsPage = async (req, res) => {
  try {
    const clients = await sequelize.query(
      `
            SELECT 
                c.id, 
                c.first_name, 
                c.last_name,
                CONCAT(c.first_name, ' ', c.last_name) AS name, 
                c.phone, 
                c.created_at AS registration_date,
                lc.card_number AS barcode, 
                COALESCE(lc.bonus_balance, 0) AS points,
                lc.status AS card_status
            FROM customers c
            LEFT JOIN loyalty_cards lc ON c.id = lc.customer_id
            ORDER BY c.created_at DESC;
        `,
      { type: sequelize.QueryTypes.SELECT },
    );

    res.render("admin/clients", {
      title: "Клієнти та Лояльність",
      path: "/admin/clients",
      user: req.session.user,
      clients: clients,
    });
  } catch (error) {
    console.error("Помилка завантаження сторінки клієнтів:", error);
    res.status(500).send("Помилка сервера");
  }
};

// --- КЛІЄНТИ ---
exports.postEditClient = async (req, res) => {
  try {
    let { id, first_name, last_name, phone, barcode } = req.body;

    // ПЕРЕВІРКА ТЕЛЕФОНУ:
    // Якщо телефон прийшов без +380, додаємо префікс.
    // Також прибираємо нуль на початку, якщо раптом його ввели (наприклад, 050 -> +38050)
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith("+380")) {
      // Якщо номер починається з нуля (050...), прибираємо нуль
      if (formattedPhone.startsWith("0")) {
        formattedPhone = formattedPhone.substring(1);
      }
      formattedPhone = "+380" + formattedPhone;
    }

    // 1. Оновлюємо дані клієнта з відформатованим телефоном
    await sequelize.query(
      `UPDATE customers SET first_name = :first_name, last_name = :last_name, phone = :phone WHERE id = :id`,
      { replacements: { id, first_name, last_name, phone: formattedPhone } },
    );

    // 2. Оновлюємо картку (тут без змін)
    if (barcode) {
      await sequelize.query(
        `INSERT INTO loyalty_cards (id, customer_id, card_number, status) 
                 VALUES (gen_random_uuid(), :id, :barcode, 'Active')
                 ON CONFLICT (customer_id) DO UPDATE SET card_number = :barcode`,
        { replacements: { id, barcode } },
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Помилка редагування:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.postToggleCardStatus = async (req, res) => {
  try {
    const { clientId, newStatus } = req.body;

    await sequelize.query(
      `UPDATE loyalty_cards SET status = :newStatus WHERE customer_id = :clientId`,
      { replacements: { clientId, newStatus } },
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Помилка зміни статусу:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.deleteClient = async (req, res) => {
  try {
    const clientId = req.params.id;

    // 1. Спочатку видаляємо картку (бо є зв'язок)
    await sequelize.query(`DELETE FROM loyalty_cards WHERE customer_id = :id`, {
      replacements: { id: clientId },
    });

    // 2. Потім видаляємо самого клієнта
    await sequelize.query(`DELETE FROM customers WHERE id = :id`, {
      replacements: { id: clientId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Помилка видалення:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
