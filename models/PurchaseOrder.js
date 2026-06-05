const { sequelize, DataTypes } = require("./db");

const PurchaseOrder = sequelize.define(
  "PurchaseOrder",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    supplier_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    order_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expected_delivery_date: {
      type: DataTypes.DATEONLY,
    },
    status: {
      type: DataTypes.ENUM("Pending", "Approved", "Delivered", "Cancelled"),
      defaultValue: "Pending",
    },
  },
  {
    tableName: "purchase_orders",
  },
);

module.exports = PurchaseOrder;
