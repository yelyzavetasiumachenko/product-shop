const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("Product-shop", "postgres", "20252025", {
  host: "localhost",
  dialect: "postgres",
  timezone: "+03:00",
  logging: false,
  define: {
    timestamps: false,
    freezeTableName: true,
  },
  dialectOptions: {
    useUTC: false, // Кажемо базі не конвертувати дати назад у Гринвіч
  },
});

module.exports = { sequelize, DataTypes };
