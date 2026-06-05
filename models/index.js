// models/index.js
const { sequelize } = require("./db");

// ==========================================
// 1. ІМПОРТ УСІХ МОДЕЛЕЙ
// ==========================================
const Category = require("./Category");
const Supplier = require("./Supplier");
const Role = require("./Role");
const Customer = require("./Customer");

const Employee = require("./Employee");
const LoyaltyCard = require("./LoyaltyCard");
const Product = require("./Product");

const PurchaseOrder = require("./PurchaseOrder");
const PurchaseOrderItem = require("./PurchaseOrderItem");
const Batch = require("./Batch");

const Shift = require("./Shift");
const Sale = require("./Sale");
const SaleItem = require("./SaleItem");
const SalePayment = require("./SalePayment");

const InventoryLog = require("./InventoryLog");
const PriceHistory = require("./PriceHistory");

// ==========================================
// 2. НАЛАШТУВАННЯ АСОЦІАЦІЙ (ЗВ'ЯЗКІВ)
// ==========================================

// --- ДОВІДНИКОВІ ЗВ'ЯЗКИ ---

// Ієрархія самих категорій (Батьківська -> Дочірня)
Category.hasMany(Category, { as: "SubCategories", foreignKey: "parent_id" });
Category.belongsTo(Category, { as: "Parent", foreignKey: "parent_id" });

// Категорії та Товари
Category.hasMany(Product, { foreignKey: "category_id" });
Product.belongsTo(Category, { foreignKey: "category_id" });

// Ролі та Співробітники
Role.hasMany(Employee, { foreignKey: "role_id" });
Employee.belongsTo(Role, { foreignKey: "role_id" });

// Клієнти та Картки Лояльності (1 до 1)
Customer.hasOne(LoyaltyCard, { foreignKey: "customer_id" });
LoyaltyCard.belongsTo(Customer, { foreignKey: "customer_id" });

// --- СКЛАД ТА ЗАКУПІВЛІ ---

// Постачальники та Замовлення
Supplier.hasMany(PurchaseOrder, { foreignKey: "supplier_id" });
PurchaseOrder.belongsTo(Supplier, { foreignKey: "supplier_id" });

// Співробітники та Замовлення (Хто створив)
Employee.hasMany(PurchaseOrder, { foreignKey: "employee_id" });
PurchaseOrder.belongsTo(Employee, { foreignKey: "employee_id" });

// Замовлення та Позиції замовлення
PurchaseOrder.hasMany(PurchaseOrderItem, {
  as: "po_items",
  foreignKey: "po_id",
});
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "po_id" });

// Товари та Позиції замовлення
Product.hasMany(PurchaseOrderItem, { foreignKey: "product_id" });
PurchaseOrderItem.belongsTo(Product, { foreignKey: "product_id" });

// Постачальники та Партії
Supplier.hasMany(Batch, { foreignKey: "supplier_id" });
Batch.belongsTo(Supplier, { foreignKey: "supplier_id" });

// Товари та Партії
Product.hasMany(Batch, { foreignKey: "product_id" });
Batch.belongsTo(Product, { foreignKey: "product_id" });

// Замовлення та Партії (За яким ордером приїхала партія)
PurchaseOrder.hasMany(Batch, { foreignKey: "po_id" });
Batch.belongsTo(PurchaseOrder, { foreignKey: "po_id" });

// --- КАСА ТА ПРОДАЖІ ---

// Співробітники та Зміни
Employee.hasMany(Shift, { foreignKey: "employee_id" });
Shift.belongsTo(Employee, { foreignKey: "employee_id" });

// Зміни та Чеки
Shift.hasMany(Sale, { foreignKey: "shift_id" });
Sale.belongsTo(Shift, { foreignKey: "shift_id" });

// Клієнти та Чеки
Customer.hasMany(Sale, { foreignKey: "customer_id" });
Sale.belongsTo(Customer, { foreignKey: "customer_id" });

// Чеки та їхні Позиції (Товари в чеку)
Sale.hasMany(SaleItem, { as: "items", foreignKey: "sale_id" });
SaleItem.belongsTo(Sale, { foreignKey: "sale_id" });

// Чеки та Оплати (Методи оплат чека)
Sale.hasMany(SalePayment, { as: "payments", foreignKey: "sale_id" });
SalePayment.belongsTo(Sale, { foreignKey: "sale_id" });

// Партії та Позиції чека (Звідки саме списали товар)
Batch.hasMany(SaleItem, { foreignKey: "batch_id" });
SaleItem.belongsTo(Batch, { foreignKey: "batch_id" });

// --- АУДИТ ТА ІСТОРІЯ ---

// Партії та Логи інвентаризації
Batch.hasMany(InventoryLog, { foreignKey: "batch_id" });
InventoryLog.belongsTo(Batch, { foreignKey: "batch_id" });

// Співробітники та Логи інвентаризації (Хто проводив операцію)
Employee.hasMany(InventoryLog, { foreignKey: "employee_id" });
InventoryLog.belongsTo(Employee, { foreignKey: "employee_id" });

// Товари та Історія цін
Product.hasMany(PriceHistory, { foreignKey: "product_id" });
PriceHistory.belongsTo(Product, { foreignKey: "product_id" });

// Співробітники та Історія цін (Хто змінив ціну)
Employee.hasMany(PriceHistory, { foreignKey: "employee_id" });
PriceHistory.belongsTo(Employee, { foreignKey: "employee_id" });

// ==========================================
// 3. ЕКСПОРТ ДЛЯ ВИКОРИСТАННЯ
// ==========================================
module.exports = {
  sequelize,
  Category,
  Supplier,
  Role,
  Customer,
  Employee,
  LoyaltyCard,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Batch,
  Shift,
  Sale,
  SaleItem,
  SalePayment,
  InventoryLog,
  PriceHistory,
};
