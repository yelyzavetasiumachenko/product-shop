const { sequelize, DataTypes } = require("./db");

const InventoryLog = sequelize.define(
  "InventoryLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    batch_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    operation_type: {
      type: DataTypes.ENUM(
        "Delivery",
        "Disposal",
        "ReturnToSupplier",
        "Adjustment",
        "Inspection",
      ),
      allowNull: false,
    },
    document_reference: {
      type: DataTypes.STRING(100),
    },
    quantity_changed: {
      type: DataTypes.DECIMAL(10, 3),
    },
    operation_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    reason: {
      type: DataTypes.STRING(255),
    },
  },
  {
    tableName: "inventory_logs",
  },
);

module.exports = InventoryLog;
