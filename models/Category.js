// models/Category.js
const { sequelize, DataTypes } = require("./db");

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    default_markup_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 20.0,
    },
  },
  {
    tableName: "categories", // Точна назва таблиці в PostgreSQL
  },
);

module.exports = Category;
