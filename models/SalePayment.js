const { sequelize, DataTypes } = require("./db");

const SalePayment = sequelize.define(
  "SalePayment",
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
    method: {
      type: DataTypes.ENUM("Cash", "Card", "Points"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    tableName: "sale_payments",
  },
);

module.exports = SalePayment;
