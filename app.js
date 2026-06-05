// app.js
const express = require("express");
const path = require("path");
const app = express();
const routes = require("./routes");
const { sequelize } = require("./models");

// Налаштування шаблонізатора EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Мідлвари для парсингу JSON та даних з HTML-форм
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Налаштування статичних файлів (CSS, JS-скрипти клієнта)
app.use(express.static(path.join(__dirname, "public")));

// Реєструємо головний роутер
app.use("/", routes);

// Підключення до БД
sequelize
  .authenticate()
  .then(() => {
    console.log("Успішне підключення до PostgreSQL.");

    // ВАЖЛИВО: force: false та alter: false гарантують,
    // що Sequelize не видалить і не змінить ваші існуючі таблиці!
    return sequelize.sync({ force: false, alter: false });
  })
  .then(() => {
    app.listen(3000, () => {
      console.log("Сервер працює на порту 3000");
    });
  })
  .catch((err) => {
    console.error("Помилка підключення до БД:", err);
  });
