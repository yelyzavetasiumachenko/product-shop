const { sequelize, DataTypes } = require("./db");

const PurchaseOrderItem = sequelize.define(
  "PurchaseOrderItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    po_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ordered_quantity: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    agreed_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    tableName: "purchase_order_items",
  },
);

module.exports = PurchaseOrderItem;
