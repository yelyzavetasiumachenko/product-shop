const { Batch, Product, Supplier } = require("../models");

exports.getWarehousePage = async (req, res) => {
  try {
    // Отримуємо всі партії, сортуючи за терміном придатності (найсвіжіші вгорі)
    const batches = await Batch.findAll({
      include: [
        { model: Product, attributes: ["sku", "name", "uom"] },
        { model: Supplier, attributes: ["name"] },
      ],
      order: [["expiry_date", "ASC"]],
    });

    res.render("warehouse/index", {
      user: { username: "warehouse_andriy" },
      batches: batches,
    });
  } catch (error) {
    console.error("Помилка завантаження складу:", error);
    res.status(500).send("Помилка при зчитуванні даних складу");
  }
};
