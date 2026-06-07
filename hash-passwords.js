const bcrypt = require("bcrypt");
// Підключіть ваш файл із налаштуваннями бази даних (змініть шлях, якщо потрібно)
const { sequelize } = require("./models/db");

async function resetDatabase() {
  try {
    console.log("⏳ Починаємо оновлення бази даних...\n");
    const tableName = "employees";

    // КРОК 2. Список користувачів та їхні нові відкриті паролі
    const usersToUpdate = [
      { username: "admin_yelyzaveta", plainPassword: "admin123" },
      { username: "director_ivan", plainPassword: "director123" },
      { username: "snr_cashier_olga", plainPassword: "olga123" },
      { username: "cashier_petro", plainPassword: "petro123" },
      { username: "cashier_svitlana", plainPassword: "svitlana123" },
      { username: "cashier_maksym", plainPassword: "maksym123" },
      { username: "cashier_maria", plainPassword: "maria123" },
    ];

    console.log("🔐 Починаємо хешування та оновлення паролів...");

    // Проходимося по кожному користувачу
    for (const user of usersToUpdate) {
      // Генеруємо хеш для відкритого пароля
      const hashedPassword = await bcrypt.hash(user.plainPassword, 10);

      // Записуємо хеш у БД
      const [results, metadata] = await sequelize.query(
        `UPDATE ${tableName} SET password_hash = :hash WHERE username = :username`,
        {
          replacements: { hash: hashedPassword, username: user.username },
        },
      );

      if (metadata.rowCount > 0) {
        console.log(
          `✅ ${user.username}: пароль оновлено (відкритий пароль: ${user.plainPassword})`,
        );
      } else {
        console.log(`⚠️ ${user.username}: не знайдено в базі.`);
      }
    }

    console.log(
      "\n🎉 Всі дії успішно завершено! Тепер ви можете логінитися з новими паролями.",
    );
  } catch (error) {
    console.error("\n❌ Виникла помилка:", error);
  } finally {
    // Закриваємо з'єднання, щоб скрипт зупинився
    if (sequelize) await sequelize.close();
    process.exit(0);
  }
}

resetDatabase();
