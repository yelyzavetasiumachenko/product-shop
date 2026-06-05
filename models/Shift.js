const { sequelize, DataTypes } = require("./db");

const Shift = sequelize.define(
  "Shift",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    start_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    end_time: {
      type: DataTypes.DATE,
    },
    starting_cash: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    expected_cash: {
      type: DataTypes.DECIMAL(10, 2),
    },
  },
  {
    tableName: "shifts",
  },
);

module.exports = Shift;
