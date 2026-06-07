const express = require("express");
const router = express.Router();
const { sequelize } = require("../models/db");

// Імпорт контролерів
const adminController = require("../controllers/AdminController");
const warehouseController = require("../controllers/WarehouseController");
const posController = require("../controllers/POSController");
const adminAuth = require("../middlewares/adminAuth");
const cashierAuth = require("../middlewares/cashierAuth");

// Маршрути для Адмін-панелі (Директор)
// router.get("/admin/dashboard", adminController.getDashboard);

// Маршрути для Складу (Товарознавець)
// router.get("/warehouse", warehouseController.getWarehousePage);
// Сторінка Складу для Директора
router.get("/admin/warehouse", adminAuth, adminController.getWarehousePage);
// Обробка форми прийому нової партії
router.post(
  "/admin/warehouse/receive",
  adminAuth,
  adminController.postReceiveBatch,
);
router.post(
  "/admin/warehouse/dispose",
  adminAuth,
  adminController.postDisposeBatch,
);

// Маршрути для Каси (Касир)
router.get("/pos", cashierAuth, posController.getPOSPage);
router.get("/api/products/search", posController.searchProductsByName);
router.get("/api/products/scan/:barcode", posController.scanProduct); // API для сканування

router.get("/api/customers/search", posController.searchCustomers);
router.post("/api/customers", posController.createCustomer);

router.post("/api/pos/checkout", posController.checkout); // API для оплати чеку

// Сторінка клієнтів
router.get("/admin/clients", adminAuth, adminController.getClientsPage);

// Відкриття сторінки логіну
// router.get("/pos/login", (req, res) => res.render("pos/login"));
// Сторінка універсального входу
router.get("/login", (req, res) => res.render("pos/login")); // Можете потім перенести файл login.ejs у views/login.ejs

// API авторизації
router.post("/api/auth/login", posController.loginAPI);

// API для перевірки пароля і створення зміни
// router.post("/api/auth/open-shift", posController.openShiftAPI);

// Отримання статистики Z-звіту перед закриттям
router.get(
  "/api/auth/shift-summary/:shift_id",
  posController.getShiftSummaryAPI,
);
// Маршрут для закриття зміни
router.post("/api/auth/close-shift", posController.closeShiftAPI);

// Сторінка екрану перерви
// router.get("/pos/lock", (req, res) => res.render("pos/lock"));
router.get("/pos/lock", cashierAuth, (req, res) => {
  res.render("pos/lock", { user: req.session.user });
});

// API перевірки пароля при поверненні з перерви
router.post("/api/auth/unlock", posController.unlockAPI);

// 1. Маршрут для відмальовки Головної панелі Директора
// router.get("/admin", (req, res) => {
//   res.render("admin/dashboard");
// });

// 2. Приклад захищеного API-маршруту (використаємо на Етапі 2)
// Додаємо adminAuth як проміжний обробник
// router.get('/api/admin/dashboard-stats', adminAuth, adminController.getDashboardStats);
// Додаємо adminAuth як проміжний обробник (захист)
// Аналітика для дашборду Директора
router.get("/api/admin/stats/daily", adminAuth, adminController.getDailyStats);
router.get(
  "/api/admin/stats/period",
  adminAuth,
  adminController.getPeriodStats,
);
// router.get(
//   "/api/admin/stats/quarantine-details",
//   adminAuth,
//   adminController.getQuarantineDetails,
// );

// Сторінка Персоналу для Директора
router.get("/admin/staff", adminAuth, adminController.getStaffPage);

router.post("/admin/clients/edit", adminController.postEditClient);
router.post("/admin/clients/toggle-card", adminController.postToggleCardStatus);
router.delete("/admin/clients/:id", adminController.deleteClient);

const bcrypt = require("bcrypt");

// ==========================================
// 1. МАРШРУТ ДЛЯ ВІДМАЛЬОВКИ ДАШБОРДУ
// Він має бути окремо!
// ==========================================
// router.get("/admin", (req, res) => {
//   console.log("-> 1. Отримано запит на сторінку /admin");
//   try {
//     console.log("-> 2. Пробуємо відрендерити admin/dashboard.ejs...");
//     res.render("admin/dashboard");
//     console.log("-> 3. Дашборд успішно відправлено в браузер!");
//   } catch (error) {
//     console.error("❌ Помилка під час рендеру дашборду:", error);
//     res.status(500).send("Сталася помилка при завантаженні сторінки.");
//   }
// });

router.get("/admin", (req, res) => {
  // Захист: якщо сесії немає, відкидаємо на сторінку логіну
  if (
    !req.session.user ||
    req.session.user.role_id !== "a0000000-0000-0000-0000-000000000003"
  ) {
    return res.redirect("/login");
  }

  try {
    // Передаємо об'єкт user у файл EJS
    res.render("admin/dashboard", { user: req.session.user });
  } catch (error) {
    console.error("❌ Помилка під час рендеру:", error);
    res.status(500).send("Помилка.");
  }
});

// ==========================================
// 2. МАРШРУТ ДЛЯ ОБРОБКИ ЛОГІНУ
// ==========================================
router.post("/login", async (req, res) => {
  console.log("1. Початок логіну. Отримано дані:", req.body);

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      console.log("Помилка: Пустий логін або пароль");
      return res.send("Будь ласка, введіть логін та пароль");
    }

    console.log(`2. Шукаємо користувача: ${username}`);

    const [users] = await sequelize.query(
      `SELECT * FROM employees WHERE username = :username LIMIT 1`,
      { replacements: { username } },
    );

    const user = users[0];

    if (!user) {
      console.log("3. Користувача НЕ знайдено в базі");
      return res.send("Користувача не знайдено");
    }

    console.log("4. Користувача знайдено. Порівнюємо паролі...");

    const isMatch = await bcrypt.compare(password, user.password_hash);

    console.log("5. Результат порівняння:", isMatch);

    if (isMatch) {
      console.log("6. Пароль ВІРНИЙ! Роль користувача:", user.role_id);

      req.session.user = {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
      };

      // РОЗПОДІЛ ЗА РОЛЯМИ (на основі ID з БД)
      // 1. Адміністратор / Директор
      if (user.role_id === "a0000000-0000-0000-0000-000000000003") {
        return res.redirect("/admin");
      }
      // 2. Касир
      // 2. Касир
      else if (user.role_id === "a0000000-0000-0000-0000-000000000001") {
        console.log("-> Зайшли в блок касира. ID користувача:", user.id);

        try {
          console.log(`-> Шукаємо відкриту зміну для касира...`);
          const [activeShifts] = await sequelize.query(
            `SELECT id FROM shifts WHERE employee_id = :empId AND end_time IS NULL LIMIT 1`,
            { replacements: { empId: user.id } },
          );

          let shiftId;

          if (activeShifts.length > 0) {
            shiftId = activeShifts[0].id;
            console.log(`-> Знайдено існуючу відкриту зміну: ${shiftId}`);
          } else {
            console.log("-> Відкритої зміни немає. Створюємо нову...");
            const [newShift] = await sequelize.query(
              `INSERT INTO shifts (employee_id, start_time, starting_cash) VALUES (:empId, NOW(), 1000) RETURNING id`,
              { replacements: { empId: user.id } },
            );
            shiftId = newShift[0].id;
            console.log(`-> Успішно створено нову зміну: ${shiftId}`);
          }

          req.session.shift_id = shiftId;
          console.log("-> Зміну записано в сесію. Робимо редирект на /pos");

          return res.redirect("/pos");
        } catch (dbError) {
          console.error("❌ Помилка створення зміни в БД:", dbError);
          return res
            .status(500)
            .send("Помилка бази даних при відкритті зміни.");
        }
      }
      // Якщо роль не розпізнана
      else {
        return res.send("У вас немає призначеної ролі для входу в систему.");
      }
    } else {
      console.log("7. Пароль НЕПРАВИЛЬНИЙ");
      return res.send("Неправильний пароль");
    }
  } catch (error) {
    console.error("❌ КРИТИЧНА ПОМИЛКА під час авторизації:", error);
    return res
      .status(500)
      .send("Внутрішня помилка сервера. Дивіться термінал.");
  }
});

// Маршрут для повного виходу з системи (знищення сесії)
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Помилка при знищенні сесії:", err);
      return res.status(500).send("Не вдалося вийти з системи");
    }
    res.redirect("/login");
  });
});

module.exports = router;
