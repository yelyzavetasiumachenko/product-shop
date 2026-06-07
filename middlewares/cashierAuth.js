const cashierAuth = (req, res, next) => {
  // 1. Перевіряємо, чи є сесія
  if (!req.session || !req.session.user) {
    if (req.originalUrl.startsWith("/api/")) {
      return res
        .status(401)
        .json({ success: false, message: "Не авторизовано" });
    }
    return res.redirect("/login");
  }

  // 2. Перевіряємо, чи це саме Касир (використовуємо ID ролі з вашої БД)
  const cashierRoleId = "a0000000-0000-0000-0000-000000000001";

  if (req.session.user.role_id !== cashierRoleId) {
    if (req.originalUrl.startsWith("/api/")) {
      return res
        .status(403)
        .json({ success: false, message: "Доступ заборонено" });
    }
    return res.send("Доступ заборонено! Це робоче місце виключно для касирів.");
  }

  // 3. Все добре, пускаємо на касу
  next();
};

module.exports = cashierAuth;
