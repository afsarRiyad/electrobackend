import { Parser } from "json2csv";
import { Product, Order } from "./models.js";

export const exportProductsToCSV = async (filter = {}) => {
  try {
    const products = await Product.find(filter)
      .select('id name sku brand categories tags price regularPrice salePrice rating reviews stock isActive createdAt')
      .lean();

    const fields = [
      'id',
      'name',
      'sku',
      'brand',
      'categories',
      'tags',
      'price',
      'regularPrice',
      'salePrice',
      'rating',
      'reviews',
      'stock',
      'isActive',
      'createdAt'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(products);

    return csv;
  } catch (error) {
    console.error("Error exporting products to CSV:", error);
    throw new Error("Failed to export products");
  }
};

export const exportOrdersToCSV = async (filter = {}) => {
  try {
    const orders = await Order.find(filter)
      .select('orderNumber customerName customerEmail totalAmount status paymentStatus paymentMethod createdAt')
      .lean();

    const fields = [
      'orderNumber',
      'customerName',
      'customerEmail',
      'totalAmount',
      'status',
      'paymentStatus',
      'paymentMethod',
      'createdAt'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(orders);

    return csv;
  } catch (error) {
    console.error("Error exporting orders to CSV:", error);
    throw new Error("Failed to export orders");
  }
};
