import mongoose from "mongoose";
import { Product } from "./models.js";
import { products } from "../data/products.js";

export const connectDB = async () => {
  try {
    const connUri =
      process.env.MONGODB_URI ||
      "mongodb+srv://riyad:riyad2@cluster0.iipnz70.mongodb.net/techmart?retryWrites=true&w=majority&appName=Cluster0";

    console.log("🔄 Connecting to MongoDB...");

    await mongoose.connect(connUri);

    console.log("✅ MongoDB Connected Successfully!");

    // Check if products already exist
    const productCount = await Product.countDocuments();

    if (productCount === 0) {
      console.log("📦 No products found. Seeding database...");

      await Product.bulkWrite(
        products.map((product) => ({
          updateOne: {
            filter: { id: product.id },
            update: { $setOnInsert: product },
            upsert: true,
          },
        }))
      );

      console.log(`✅ Successfully inserted ${products.length} products.`);
    } else {
      console.log(
        `📦 Database already contains ${productCount} products. Seeding skipped.`
      );
    }
  } catch (error) {
    console.error("❌ MongoDB Connection Failed");
    console.error(error);

    process.exit(1);
  }
};