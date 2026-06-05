// models/Batch.js
const { sequelize, DataTypes } = require("./db");

const Batch = sequelize.define(
  "Batch",
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    product_id: { type: DataTypes.UUID, allowNull: false },
    supplier_id: { type: DataTypes.UUID, allowNull: false },
    po_id: { type: DataTypes.UUID, allowNull: true },
    quantity: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0.0 },
    production_date: DataTypes.DATEONLY, // DATEONLY для типу DATE в PostgreSQL
    expiry_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM(
        "Active",
        "Quarantine",
        "Returned",
        "Disposed",
        "Expired",
      ),
      defaultValue: "Quarantine",
    },
    purchase_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  },
  {
    tableName: "batches",
  },
);

module.exports = Batch;

// const { DataTypes } = require("sequelize");
// const sequelize = require("./db");

// const Batch = sequelize.define(
//   "Batch",
//   {
//     id: { type: DataTypes.UUID, primaryKey: true },
//     product_id: { type: DataTypes.UUID },
//     supplier_id: { type: DataTypes.UUID },
//     quantity: { type: DataTypes.INTEGER },
//     expiry_date: { type: DataTypes.DATEONLY },
//     status: { type: DataTypes.STRING },
//     price_per_unit: { type: DataTypes.DECIMAL },
//   },
//   { tableName: "Batches" },
// );

// module.exports = Batch;
