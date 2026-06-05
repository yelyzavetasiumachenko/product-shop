const { sequelize, DataTypes } = require("./db");

const SaleItem = sequelize.define(
  "SaleItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sale_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    batch_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    quantity_sold: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    price_at_sale: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    tableName: "sale_items",
  },
);

module.exports = SaleItem;
