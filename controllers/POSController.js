const {
  sequelize,
  Product,
  Batch,
  Sale,
  SaleItem,
  SalePayment,
  LoyaltyCard,
  Customer,
  Employee,
  Shift,
} = require("../models");

const { Op } = require("sequelize");

// 1. Відображення головної сторінки каси
exports.getPOSPage = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Рахуємо, скільки чеків вже пробито за сьогодні
    const todaysSalesCount = await Sale.count({
      where: {
        sale_date: {
          [Op.gte]: today, // Дата більша або дорівнює початку сьогоднішнього дня
        },
      },
    });

    res.render("pos/index", {
      user: { username: "snr_cashier_olga" },
      // Передаємо на фронтенд номер для наступного чека
      nextReceiptNumber: todaysSalesCount + 1,
    });
  } catch (error) {
    console.error("Помилка завантаження каси:", error);
    res.status(500).send("Помилка сервера");
  }
};

// 2. API: Пошук товару за штрих-кодом
exports.scanProduct = async (req, res) => {
  try {
    const { barcode } = req.params;

    const product = await Product.findOne({ where: { barcode } });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Товар не знайдено" });
    }

    // Перевіряємо наявність доступних активних залишків на складі
    const totalStock =
      (await Batch.sum("quantity", {
        where: { product_id: product.id, status: "Active" },
      })) || 0;

    res.json({
      success: true,
      product: {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        price: parseFloat(product.current_retail_price),
        uom: product.uom,
        is_weight: product.is_weight_item,
        available_stock: parseFloat(totalStock),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. API: Проведення чеку (Транзакція + FIFO)
// exports.checkout = async (req, res) => {
//   // Відкриваємо транзакцію Sequelize
//   const t = await sequelize.transaction();

//   try {
//     const { items, customer_id, payment_method, bonus_spent, shift_id } =
//       req.body;

//     let totalAmount = 0;
//     const saleItemsToCreate = [];

//     // Обробляємо кожен товар у кошику каси
//     for (const item of items) {
//       let requiredQty = parseFloat(item.quantity);
//       totalAmount += requiredQty * parseFloat(item.price);

//       // Знаходимо всі активні партії цього товару за принципом FIFO (сортування за expiry_date)
//       const activeBatches = await Batch.findAll({
//         where: { product_id: item.id, status: "Active" },
//         order: [["expiry_date", "ASC"]],
//         transaction: t,
//       });

//       let availableQtyForProduct = activeBatches.reduce(
//         (sum, b) => sum + parseFloat(b.quantity),
//         0,
//       );
//       if (availableQtyForProduct < requiredQty) {
//         throw new Error(`Недостатньо товару "${item.name}" на складі!`);
//       }

//       // Списуємо кількість із партій за алгоритмом FIFO
//       for (const batch of activeBatches) {
//         if (requiredQty <= 0) break;

//         let batchQty = parseFloat(batch.quantity);
//         if (batchQty <= 0) continue;

//         if (batchQty >= requiredQty) {
//           // У партії достатньо товару
//           await batch.update(
//             { quantity: batchQty - requiredQty },
//             { transaction: t },
//           );
//           saleItemsToCreate.push({
//             batch_id: batch.id,
//             quantity_sold: requiredQty,
//             price_at_sale: item.price,
//           });
//           requiredQty = 0;
//         } else {
//           // Забираємо всю партію під нуль і йдемо до наступної
//           await batch.update({ quantity: 0 }, { transaction: t });
//           saleItemsToCreate.push({
//             batch_id: batch.id,
//             quantity_sold: batchQty,
//             price_at_sale: item.price,
//           });
//           requiredQty -= batchQty;
//         }
//       }
//     }

//     // Розрахунок бонусів (1% кешбеку, якщо не було списання бонусів)
//     let bonusEarned = 0;
//     if (customer_id && parseFloat(bonus_spent) === 0) {
//       bonusEarned = parseFloat((totalAmount * 0.01).toFixed(2));
//     }

//     // Кінцева сума до сплати грошима
//     const finalPayable = totalAmount - parseFloat(bonus_spent);

//     // 1. Створюємо запис у таблиці Sales
//     const sale = await Sale.create(
//       {
//         shift_id: shift_id || "a2222222-0000-0000-0000-000000000003", // Поточна зміна Світлани
//         customer_id: customer_id || null,
//         fiscal_number: "FN-" + Date.now().toString().slice(-6),
//         total_amount: totalAmount,
//         bonus_earned: bonusEarned,
//         bonus_spent: bonus_spent,
//       },
//       { transaction: t },
//     );

//     // 2. Зберігаємо всі позиції чеку зв'язані з Sale ID
//     for (const saleItem of saleItemsToCreate) {
//       saleItem.sale_id = sale.id;
//       await SaleItem.create(saleItem, { transaction: t });
//     }

//     // 3. Фіксуємо оплату в Sale_Payments
//     if (parseFloat(bonus_spent) > 0) {
//       await SalePayment.create(
//         { sale_id: sale.id, method: "Points", amount: bonus_spent },
//         { transaction: t },
//       );
//     }
//     await SalePayment.create(
//       { sale_id: sale.id, method: payment_method, amount: finalPayable },
//       { transaction: t },
//     );

//     // ----------------------------------------------------------------------
//     // 4. ОНОВЛЕННЯ БАЛАНСУ LOYALTY CARD (Вставлено логіку)
//     // ----------------------------------------------------------------------
//     if (customer_id) {
//       // Знаходимо картку клієнта в межах поточної транзакції
//       const card = await LoyaltyCard.findOne({
//         where: { customer_id: customer_id },
//         transaction: t,
//       });

//       if (card) {
//         let currentBalance = parseFloat(card.bonus_balance) || 0;

//         // Віднімаємо використані бонуси та додаємо нові зароблені
//         currentBalance -= parseFloat(bonus_spent) || 0;
//         currentBalance += bonusEarned;

//         // Зберігаємо оновлений баланс у базі даних
//         await card.update(
//           { bonus_balance: currentBalance },
//           { transaction: t },
//         );
//       }
//     }
//     // ----------------------------------------------------------------------

//     // Якщо все пройшло успішно — фіксуємо зміни в БД
//     await t.commit();
//     res.json({
//       success: true,
//       message: "Чек успішно проведено!",
//       fiscal_number: sale.fiscal_number,
//     });
//   } catch (error) {
//     // Якщо сталася будь-яка помилка (наприклад, пересорт на складі) — скасовуємо ВСІ дії
//     await t.rollback();
//     res.status(400).json({ success: false, message: error.message });
//   }
// };

exports.checkout = async (req, res) => {
  // Відкриваємо транзакцію Sequelize
  const t = await sequelize.transaction();

  try {
    const { items, customer_id, payment_method, bonus_spent, shift_id } =
      req.body;

    let totalAmount = 0;
    const saleItemsToCreate = [];

    // Обробляємо кожен товар у кошику каси
    for (const item of items) {
      let requiredQty = parseFloat(item.quantity);
      totalAmount += requiredQty * parseFloat(item.price);

      // Знаходимо всі активні партії цього товару за принципом FIFO (сортування за expiry_date)
      const activeBatches = await Batch.findAll({
        where: { product_id: item.id, status: "Active" },
        order: [["expiry_date", "ASC"]],
        transaction: t,
      });

      let availableQtyForProduct = activeBatches.reduce(
        (sum, b) => sum + parseFloat(b.quantity),
        0,
      );
      if (availableQtyForProduct < requiredQty) {
        throw new Error(`Недостатньо товару "${item.name}" на складі!`);
      }

      // Списуємо кількість із партій за алгоритмом FIFO
      for (const batch of activeBatches) {
        if (requiredQty <= 0) break;

        let batchQty = parseFloat(batch.quantity);
        if (batchQty <= 0) continue;

        if (batchQty >= requiredQty) {
          await batch.update(
            { quantity: batchQty - requiredQty },
            { transaction: t },
          );
          saleItemsToCreate.push({
            batch_id: batch.id,
            quantity_sold: requiredQty,
            price_at_sale: item.price,
          });
          requiredQty = 0;
        } else {
          await batch.update({ quantity: 0 }, { transaction: t });
          saleItemsToCreate.push({
            batch_id: batch.id,
            quantity_sold: batchQty,
            price_at_sale: item.price,
          });
          requiredQty -= batchQty;
        }
      }
    }

    // 1. ВИПРАВЛЕНО: Кінцева сума до сплати грошима
    const finalPayable = totalAmount - (parseFloat(bonus_spent) || 0);

    // 2. ВИПРАВЛЕНО: Розрахунок нових бонусів (1% тільки від РЕАЛЬНО сплачених грошей)
    let bonusEarned = 0;
    if (customer_id && finalPayable > 0) {
      bonusEarned = parseFloat((finalPayable * 0.01).toFixed(2));
    }

    // Створюємо запис у таблиці Sales
    const sale = await Sale.create(
      {
        shift_id: shift_id,
        customer_id: customer_id || null,
        fiscal_number: "FN-" + Date.now().toString().slice(-6),
        total_amount: totalAmount,
        bonus_earned: bonusEarned,
        bonus_spent: parseFloat(bonus_spent) || 0,
      },
      { transaction: t },
    );

    // Зберігаємо всі позиції чеку
    for (const saleItem of saleItemsToCreate) {
      saleItem.sale_id = sale.id;
      await SaleItem.create(saleItem, { transaction: t });
    }

    // Фіксуємо оплату в Sale_Payments
    if (parseFloat(bonus_spent) > 0) {
      await SalePayment.create(
        { sale_id: sale.id, method: "Points", amount: bonus_spent },
        { transaction: t },
      );
    }

    if (finalPayable > 0) {
      await SalePayment.create(
        { sale_id: sale.id, method: payment_method, amount: finalPayable },
        { transaction: t },
      );
    }

    // ----------------------------------------------------------------------
    // 3. ВИПРАВЛЕНО: ЗАЛІЗОБЕТОННЕ ОНОВЛЕННЯ БАЛАНСУ LOYALTY CARD
    // ----------------------------------------------------------------------
    if (customer_id) {
      const card = await LoyaltyCard.findOne({
        where: { customer_id: customer_id },
        transaction: t,
      });

      if (card) {
        const currentBalance = parseFloat(card.bonus_balance) || 0;

        // Вираховуємо точний новий баланс
        const newBalance =
          currentBalance - (parseFloat(bonus_spent) || 0) + bonusEarned;

        // Використовуємо прямий SQL-виклик моделі для гарантованого запису
        await LoyaltyCard.update(
          { bonus_balance: newBalance },
          {
            where: { customer_id: customer_id },
            transaction: t,
          },
        );
      }
    }
    // ----------------------------------------------------------------------

    // Фіксуємо зміни в БД
    await t.commit();
    res.json({
      success: true,
      message: "Чек успішно проведено!",
      fiscal_number: sale.fiscal_number,
    });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, message: error.message });
  }
};

// 4. API: Пошук товару за назвою (Живий пошук)
exports.searchProductsByName = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.json({ success: true, products: [] });
    }

    // Шукаємо АБО за частковою назвою, АБО за частиною штрих-коду
    const products = await Product.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { barcode: { [Op.like]: `%${query}%` } },
        ],
      },
      limit: 10,
    });

    const results = [];

    // Перевіряємо залишки для кожного знайденого товару
    for (const prod of products) {
      const totalStock =
        (await Batch.sum("quantity", {
          where: { product_id: prod.id, status: "Active" },
        })) || 0;

      if (totalStock > 0) {
        results.push({
          id: prod.id,
          barcode: prod.barcode,
          name: prod.name,
          price: parseFloat(prod.current_retail_price),
          uom: prod.uom,
          is_weight: prod.is_weight_item,
          available_stock: parseFloat(totalStock),
        });
      }
    }

    res.json({ success: true, products: results });
  } catch (error) {
    console.error("Помилка живого пошуку:", error);
    res.status(500).json({ success: false, message: "Помилка пошуку" });
  }
};

// 5. API: Живий пошук клієнта (за телефоном або ПІБ)
exports.searchCustomers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2)
      return res.json({ success: true, customers: [] });

    // Шукаємо в таблиці CUSTOMER, і "приєднуємо" їхню картку лояльності
    const customers = await Customer.findAll({
      where: {
        [Op.or]: [
          { phone: { [Op.like]: `%${query}%` } },
          { last_name: { [Op.iLike]: `%${query}%` } },
          { first_name: { [Op.iLike]: `%${query}%` } },
        ],
      },
      include: [
        {
          model: LoyaltyCard,
          required: false, // LEFT JOIN: знайде клієнта, навіть якщо в нього ще немає картки
        },
      ],
      limit: 5,
    });

    res.json({ success: true, customers });
  } catch (error) {
    console.error("Помилка пошуку клієнта:", error);
    res.status(500).json({ success: false });
  }
};

// 6. API: Створення нової картки та клієнта
exports.createCustomer = async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;

    // 1. Спочатку створюємо самого клієнта
    const newCustomer = await Customer.create({
      first_name,
      last_name,
      phone,
    });

    // 2. Генеруємо номер і створюємо йому картку
    const newBarcode =
      "200" + Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const newCard = await LoyaltyCard.create({
      customer_id: newCustomer.id,
      card_number: newBarcode,
      bonus_balance: 0.0,
      status: "Active",
    });

    // Об'єднуємо дані для відправки на фронтенд
    newCustomer.dataValues.LoyaltyCard = newCard;

    res.json({ success: true, customer: newCustomer });
  } catch (error) {
    console.error("Помилка створення клієнта:", error);
    res
      .status(500)
      .json({ success: false, message: "Не вдалося створити клієнта" });
  }
};

// Реальна функція логіну та відкриття зміни у БД
// exports.openShiftAPI = async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     // 1. АВТОРИЗАЦІЯ КАСИРА
//     // Використовуємо правильну назву колонки: password_hash
//     const employee = await Employee.findOne({
//       where: {
//         username: username,
//         password_hash: password, // <--- Виправили тут
//       },
//     });

//     if (!employee) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Невірний логін або пароль" });
//     }

//     // 2. ПЕРЕВІРКА ВІДКРИТОЇ ЗМІНИ
//     let currentShift = await Shift.findOne({
//       where: {
//         employee_id: employee.id,
//         end_time: null,
//       },
//     });

//     // 3. СТВОРЕННЯ НОВОЇ ЗМІНИ (якщо відкритої немає)
//     if (!currentShift) {
//       currentShift = await Shift.create({
//         employee_id: employee.id,
//         start_time: new Date(),
//         starting_cash: 1000.0,
//       });
//     }

//     // 4. ВІДПРАВКА ДАНИХ НА ФРОНТЕНД
//     res.json({
//       success: true,
//       shift_id: currentShift.id,
//       // Використовуємо username, оскільки first_name немає в таблиці
//       cashier_name: employee.username,
//     });
//   } catch (error) {
//     console.error("Помилка відкриття зміни:", error);
//     res
//       .status(500)
//       .json({ success: false, message: "Внутрішня помилка сервера" });
//   }
// };

// Універсальна авторизація в ERP-системі
exports.loginAPI = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Шукаємо працівника за логіном
    const employee = await Employee.findOne({ where: { username: username } });
    if (!employee) {
      return res
        .status(401)
        .json({ success: false, message: "Користувача не знайдено" });
    }

    // 2. Перевірка пароля (як ми робили раніше)
    let isMatch = false;
    if (employee.password_hash === password) {
      isMatch = true;
    } else {
      try {
        const bcrypt = require("bcrypt");
        isMatch = await bcrypt.compare(password, employee.password_hash);
      } catch (e) {}
    }

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Невірний пароль" });
    }

    // 3. РОЗПОДІЛ ЗА РОЛЯМИ (Role-Based Routing)
    const roleId = employee.role_id;

    // ВАЖЛИВО: Замініть ці цифри на ті, які реально стоять у вашій БД
    const ROLE_ADMIN = "a0000000-0000-0000-0000-000000000003"; // Директор
    const ROLE_CASHIER = "a0000000-0000-0000-0000-000000000001"; // Касир
    const ROLE_WAREHOUSE = "a0000000-0000-0000-0000-000000000002"; // Комірник

    const currentRole = roleId.toString();

    // Відповідь, яку ми відправимо
    let responseData = {
      success: true,
      role_id: currentRole,
      cashier_name: employee.username,
    };

    // А) ЛОГІКА ДЛЯ КАСИРА (Створюємо зміну)
    if (roleId === ROLE_CASHIER.toString()) {
      let currentShift = await Shift.findOne({
        where: { employee_id: employee.id, end_time: null },
      });

      if (!currentShift) {
        currentShift = await Shift.create({
          employee_id: employee.id,
          start_time: new Date(),
          starting_cash: 1000.0,
        });
      }
      responseData.shift_id = currentShift.id;
      responseData.redirect_url = "/pos"; // Куди перекинути
    }
    // Б) ЛОГІКА ДЛЯ ДИРЕКТОРА (Без зміни)
    else if (roleId === ROLE_ADMIN.toString()) {
      responseData.redirect_url = "/admin";
    }
    // В) ЛОГІКА ДЛЯ КОМІРНИКА (Без зміни)
    else if (roleId === ROLE_WAREHOUSE.toString()) {
      responseData.redirect_url = "/warehouse";
    }
    // ЯКЩО РОЛЬ НЕВІДОМА
    else {
      return res
        .status(403)
        .json({ success: false, message: "У вас немає доступу до системи" });
    }

    // 4. Відправляємо дані клієнту
    res.json(responseData);
  } catch (error) {
    console.error("Помилка авторизації:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутрішня помилка сервера" });
  }
};

// Закриття зміни (Вихід)
// exports.closeShiftAPI = async (req, res) => {
//   try {
//     const { shift_id } = req.body;

//     if (shift_id) {
//       // Знаходимо поточну зміну в базі
//       const shift = await Shift.findByPk(shift_id);

//       // Якщо зміна існує і ще не закрита, ставимо поточний час
//       if (shift && !shift.end_time) {
//         await shift.update({
//           end_time: new Date(),
//           // У майбутньому тут можна додати підрахунок expected_cash (Z-звіт)
//         });
//       }
//     }

//     res.json({ success: true, message: "Зміну закрито" });
//   } catch (error) {
//     console.error("Помилка закриття зміни:", error);
//     res.status(500).json({ success: false, message: "Помилка сервера" });
//   }
// };
// Закриття зміни (Вихід та підрахунок каси)
// exports.closeShiftAPI = async (req, res) => {
//   try {
//     const { shift_id } = req.body;

//     if (!shift_id) {
//       return res
//         .status(400)
//         .json({ success: false, message: "ID зміни не передано" });
//     }

//     // 1. Знаходимо поточну зміну
//     const shift = await Shift.findByPk(shift_id);

//     if (!shift) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Зміну не знайдено" });
//     }

//     if (!shift.end_time) {
//       // 2. Шукаємо ВСІ чеки (Sales), які були пробиті під час цієї зміни
//       const shiftSales = await Sale.findAll({
//         where: { shift_id: shift.id },
//         attributes: ["id"], // Нам потрібні тільки їхні ID
//       });

//       const saleIds = shiftSales.map((sale) => sale.id);

//       let totalCashSales = 0;

//       // 3. Якщо чеки були, рахуємо всю ГОТІВКУ з таблиці SalePayments
//       if (saleIds.length > 0) {
//         const cashPayments = await SalePayment.findAll({
//           where: {
//             sale_id: { [Op.in]: saleIds },
//             method: "Cash", // Рахуємо ТІЛЬКИ готівку
//           },
//         });

//         // Сумуємо всі готівкові платежі
//         totalCashSales = cashPayments.reduce(
//           (sum, payment) => sum + parseFloat(payment.amount),
//           0,
//         );
//       }

//       // 4. Вираховуємо, скільки готівки МАЄ бути в шухляді каси
//       // (Розмінна монета зранку + уся готівка за день)
//       const startingCash = parseFloat(shift.starting_cash) || 0;
//       const expectedCashInDrawer = startingCash + totalCashSales;

//       // 5. Закриваємо зміну: ставимо час і записуємо очікувану суму
//       await shift.update({
//         end_time: new Date(),
//         expected_cash: expectedCashInDrawer,
//       });

//       // Тут можна було б також повернути дані для Z-звіту на фронтенд,
//       // щоб показати касиру віконце: "Здайте в сейф 3450 грн"
//     }

//     res.json({ success: true, message: "Зміну успішно закрито!" });
//   } catch (error) {
//     console.error("Помилка закриття зміни:", error);
//     res
//       .status(500)
//       .json({ success: false, message: "Помилка сервера при закритті зміни" });
//   }
// };

// 1. ОТРИМАННЯ ФІНАЛЬНОГО Z-ЗВІТУ (БЕЗ ЗАКРИТТЯ)
exports.getShiftSummaryAPI = async (req, res) => {
  try {
    const { shift_id } = req.params;

    const shift = await Shift.findByPk(shift_id);
    if (!shift) {
      return res
        .status(404)
        .json({ success: false, message: "Зміну не знайдено" });
    }

    // Шукаємо всі чеки за цю зміну
    const shiftSales = await Sale.findAll({
      where: { shift_id: shift.id },
    });

    const saleIds = shiftSales.map((sale) => sale.id);

    let cashTotal = 0;
    let cardTotal = 0;
    let pointsTotal = 0;
    let totalBonusEarned = 0;

    // Рахуємо суму нарахованих бонусів за день
    shiftSales.forEach((sale) => {
      totalBonusEarned += parseFloat(sale.bonus_earned) || 0;
    });

    // Рахуємо всі типи оплат з таблиці SalePayments
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
    const expectedCash = startingCash + cashTotal;

    // Відправляємо детальну статистику на фронтенд
    res.json({
      success: true,
      summary: {
        starting_cash: startingCash.toFixed(2),
        cash_sales: cashTotal.toFixed(2),
        card_sales: cardTotal.toFixed(2),
        bonuses_spent: pointsTotal.toFixed(2),
        bonuses_earned: totalBonusEarned.toFixed(2),
        expected_cash: expectedCash.toFixed(2),
        sales_count: shiftSales.length,
      },
    });
  } catch (error) {
    console.error("Помилка генерації Z-звіту:", error);
    res
      .status(500)
      .json({ success: false, message: "Не вдалося згенерувати звіт" });
  }
};

// 2. ОСТАТОЧНЕ ЗАКРИТТЯ ЗМІНИ ТА ЗБЕРЕЖЕННЯ
exports.closeShiftAPI = async (req, res) => {
  try {
    const { shift_id } = req.body;

    const shift = await Shift.findByPk(shift_id);
    if (!shift || shift.end_time) {
      return res
        .status(400)
        .json({ success: false, message: "Зміна недійсна або вже закрита" });
    }

    // Перераховуємо фінальну готівку для безпеки (захист від підміни даних)
    const shiftSales = await Sale.findAll({
      where: { shift_id: shift.id },
      attributes: ["id"],
    });
    const saleIds = shiftSales.map((s) => s.id);
    let cashTotal = 0;

    if (saleIds.length > 0) {
      const cashPayments = await SalePayment.findAll({
        where: { sale_id: { [Op.in]: saleIds }, method: "Cash" },
      });
      cashTotal = cashPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0,
      );
    }

    const finalExpected = (parseFloat(shift.starting_cash) || 0) + cashTotal;

    // Жорстко закриваємо зміну в базі даних
    await shift.update({
      end_time: new Date(),
      expected_cash: finalExpected,
    });

    res.json({ success: true, message: "Зміну успішно закрито в БД" });
  } catch (error) {
    console.error("По500 помилка:", error);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
};

// Перевірка пароля касира для виходу з режиму перерви
exports.unlockAPI = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Шукаємо користувача за логіном
    const employee = await Employee.findOne({ where: { username: username } });

    if (!employee) {
      return res
        .status(401)
        .json({ success: false, message: "Користувача не знайдено" });
    }

    // Перевіряємо пароль (як і в логіні — текстовий або через bcrypt)
    let isMatch = false;
    if (employee.password_hash === password) {
      isMatch = true;
    } else {
      try {
        const bcrypt = require("bcrypt");
        isMatch = await bcrypt.compare(password, employee.password_hash);
      } catch (e) {}
    }

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Невірний пароль!" });
    }

    // Якщо пароль підійшов, просто кажемо "так" (зміну НЕ перестворюємо)
    res.json({ success: true });
  } catch (error) {
    console.error("Помилка розблокування:", error);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
};
