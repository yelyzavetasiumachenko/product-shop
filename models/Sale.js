const { sequelize, DataTypes } = require("./db");

const Sale = sequelize.define(
  "Sale",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shift_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    customer_id: {
      type: DataTypes.UUID,
    },
    fiscal_number: {
      type: DataTypes.STRING(100),
      unique: true,
    },
    sale_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    bonus_earned: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    bonus_spent: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
  },
  {
    tableName: "sales",
  },
);

module.exports = Sale;
