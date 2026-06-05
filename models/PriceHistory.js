const { sequelize, DataTypes } = require("./db");

const PriceHistory = sequelize.define(
  "PriceHistory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    effective_from: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    effective_to: {
      type: DataTypes.DATE,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "price_history",
  },
);

module.exports = PriceHistory;
