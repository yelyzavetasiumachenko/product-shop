const express = require("express");
const router = express.Router();

// Імпорт контролерів
const adminController = require("../controllers/AdminController");
const warehouseController = require("../controllers/WarehouseController");
const posController = require("../controllers/POSController");

// Маршрути для Адмін-панелі (Директор)
router.get("/admin/dashboard", adminController.getDashboard);

// Маршрути для Складу (Товарознавець)
router.get("/warehouse", warehouseController.getWarehousePage);

// Маршрути для Каси (Касир)
router.get("/pos", posController.getPOSPage);
router.get("/api/products/search", posController.searchProductsByName);
router.get("/api/products/scan/:barcode", posController.scanProduct); // API для сканування

router.get("/api/customers/search", posController.searchCustomers);
router.post("/api/customers", posController.createCustomer);

router.post("/api/pos/checkout", posController.checkout); // API для оплати чеку

module.exports = router;
