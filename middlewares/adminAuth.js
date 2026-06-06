// middlewares/adminAuth.js
const { Employee } = require("../models");

module.exports = async (req, res, next) => {
  try {
    // Очікуємо, що клієнт передасть свій логін (або ID) у заголовках запиту
    const username = req.headers["x-user-name"];

    if (!username) {
      return res.status(403).json({
        success: false,
        message: "Доступ заборонено: Немає даних авторизації",
      });
    }

    const employee = await Employee.findOne({ where: { username: username } });

    // Перевіряємо, чи існує працівник і чи є він Директором (наприклад, role_id === 1)
    if (
      !employee ||
      employee.role_id !== "a0000000-0000-0000-0000-000000000003"
    ) {
      return res.status(403).json({
        success: false,
        message: "Доступ заборонено: Тільки для адміністрації",
      });
    }

    // Якщо все добре, пропускаємо запит далі
    req.admin = employee;
    next();
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Помилка перевірки прав доступу" });
  }
};
