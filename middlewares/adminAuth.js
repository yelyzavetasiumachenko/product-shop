// // middlewares/adminAuth.js
// const { Employee } = require("../models");

// module.exports = async (req, res, next) => {
//   try {
//     // Очікуємо, що клієнт передасть свій логін (або ID) у заголовках запиту
//     const username = req.headers["x-user-name"];

//     if (!username) {
//       return res.status(403).json({
//         success: false,
//         message: "Доступ заборонено: Немає даних авторизації",
//       });
//     }

//     const employee = await Employee.findOne({ where: { username: username } });

//     // Перевіряємо, чи існує працівник і чи є він Директором (наприклад, role_id === 1)
//     if (
//       !employee ||
//       employee.role_id !== "a0000000-0000-0000-0000-000000000003"
//     ) {
//       return res.status(403).json({
//         success: false,
//         message: "Доступ заборонено: Тільки для адміністрації",
//       });
//     }

//     // Якщо все добре, пропускаємо запит далі
//     req.admin = employee;
//     next();
//   } catch (error) {
//     res
//       .status(500)
//       .json({ success: false, message: "Помилка перевірки прав доступу" });
//   }
// };

const adminAuth = (req, res, next) => {
  // 1. Перевіряємо, чи взагалі існує сесія користувача
  if (!req.session || !req.session.user) {
    // Якщо це API-запит від графіка (axios), повертаємо JSON з помилкою
    if (req.originalUrl.startsWith("/api/")) {
      return res
        .status(401)
        .json({ success: false, message: "Не авторизовано" });
    }
    // Якщо це звичайний перехід по сторінках, кидаємо на логін
    return res.redirect("/login");
  }

  // 2. Перевіряємо, чи є у користувача права Директора/Адміна
  const adminRoleId = "a0000000-0000-0000-0000-000000000003";

  if (req.session.user.role_id !== adminRoleId) {
    if (req.originalUrl.startsWith("/api/")) {
      return res
        .status(403)
        .json({ success: false, message: "Доступ заборонено" });
    }
    return res.send("Доступ заборонено! У вас немає прав адміністратора.");
  }

  // 3. Все супер, пропускаємо запит далі до AdminController
  next();
};

module.exports = adminAuth;
