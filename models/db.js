const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("Product-shop", "postgres", "20252025", {
  host: "localhost",
  dialect: "postgres",
  logging: false,
  define: {
    timestamps: false,
    freezeTableName: true,
  },
});

module.exports = { sequelize, DataTypes };
