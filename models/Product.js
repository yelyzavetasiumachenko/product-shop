// models/Product.js
const { sequelize, DataTypes } = require("./db");

const Product = sequelize.define(
  "Product",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    sku: { type: DataTypes.STRING(50), allowNull: false },
    barcode: { type: DataTypes.STRING(50), allowNull: false },
    brand: DataTypes.STRING(100),
    name: { type: DataTypes.STRING(150), allowNull: false },
    category_id: { type: DataTypes.UUID, allowNull: false },

    // Робота з ENUM
    uom: {
      type: DataTypes.ENUM("Piece", "Kilogram", "Liter"),
      defaultValue: "Piece",
    },

    is_weight_item: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    current_retail_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    min_stock_level: { type: DataTypes.DECIMAL(10, 3), defaultValue: 10.0 },
  },
  {
    tableName: "products",
  },
);

module.exports = Product;
