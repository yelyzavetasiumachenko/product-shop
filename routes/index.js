const express = require("express");
const router = express.Router();

// Імпорт контролерів
const adminController = require("../controllers/AdminController");
const warehouseController = require("../controllers/WarehouseController");
const posController = require("../controllers/POSController");
const adminAuth = require("../middlewares/adminAuth");

// Маршрути для Адмін-панелі (Директор)
// router.get("/admin/dashboard", adminController.getDashboard);

// Маршрути для Складу (Товарознавець)
// router.get("/warehouse", warehouseController.getWarehousePage);
// Сторінка Складу для Директора
router.get("/admin/warehouse", adminController.getWarehousePage);
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
router.get("/pos", posController.getPOSPage);
router.get("/api/products/search", posController.searchProductsByName);
router.get("/api/products/scan/:barcode", posController.scanProduct); // API для сканування

router.get("/api/customers/search", posController.searchCustomers);
router.post("/api/customers", posController.createCustomer);

router.post("/api/pos/checkout", posController.checkout); // API для оплати чеку

// Сторінка клієнтів
router.get("/admin/clients", adminController.getClientsPage);

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
router.get("/pos/lock", (req, res) => res.render("pos/lock"));

// API перевірки пароля при поверненні з перерви
router.post("/api/auth/unlock", posController.unlockAPI);

// 1. Маршрут для відмальовки Головної панелі Директора
router.get("/admin", (req, res) => {
  res.render("admin/dashboard");
});

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
router.get("/admin/staff", adminController.getStaffPage);

router.post("/admin/clients/edit", adminController.postEditClient);
router.post("/admin/clients/toggle-card", adminController.postToggleCardStatus);
router.delete("/admin/clients/:id", adminController.deleteClient);

module.exports = router;
