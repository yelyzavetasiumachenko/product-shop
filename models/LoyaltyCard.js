const { sequelize, DataTypes } = require("./db");

const LoyaltyCard = sequelize.define(
  "LoyaltyCard",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    card_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    bonus_balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "Active",
    },
  },
  {
    tableName: "loyalty_cards",
  },
);

module.exports = LoyaltyCard;
