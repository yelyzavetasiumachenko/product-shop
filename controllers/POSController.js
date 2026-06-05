const {
  sequelize,
  Product,
  Batch,
  Sale,
  SaleItem,
  SalePayment,
  LoyaltyCard,
  Customer,
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
          // У партії достатньо товару
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
          // Забираємо всю партію під нуль і йдемо до наступної
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

    // Розрахунок бонусів (1% кешбеку, якщо не було списання бонусів)
    let bonusEarned = 0;
    if (customer_id && parseFloat(bonus_spent) === 0) {
      bonusEarned = parseFloat((totalAmount * 0.01).toFixed(2));
    }

    // Кінцева сума до сплати грошима
    const finalPayable = totalAmount - parseFloat(bonus_spent);

    // 1. Створюємо запис у таблиці Sales
    const sale = await Sale.create(
      {
        shift_id: shift_id || "a2222222-0000-0000-0000-000000000003", // Поточна зміна Світлани
        customer_id: customer_id || null,
        fiscal_number: "FN-" + Date.now().toString().slice(-6),
        total_amount: totalAmount,
        bonus_earned: bonusEarned,
        bonus_spent: bonus_spent,
      },
      { transaction: t },
    );

    // 2. Зберігаємо всі позиції чеку зв'язані з Sale ID
    for (const saleItem of saleItemsToCreate) {
      saleItem.sale_id = sale.id;
      await SaleItem.create(saleItem, { transaction: t });
    }

    // 3. Фіксуємо оплату в Sale_Payments
    if (parseFloat(bonus_spent) > 0) {
      await SalePayment.create(
        { sale_id: sale.id, method: "Points", amount: bonus_spent },
        { transaction: t },
      );
    }
    await SalePayment.create(
      { sale_id: sale.id, method: payment_method, amount: finalPayable },
      { transaction: t },
    );

    // Якщо все пройшло успішно — фіксуємо зміни в БД
    await t.commit();
    res.json({
      success: true,
      message: "Чек успішно проведено!",
      fiscal_number: sale.fiscal_number,
    });
  } catch (error) {
    // Якщо сталася будь-яка помилка (наприклад, пересорт на складі) — скасовуємо ВСІ дії
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
