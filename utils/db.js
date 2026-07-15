import mongoose from "mongoose";
import { Product } from "./models.js";
import { products } from "../data/products.js";
import { clearProductCache } from "./productQueries.js";

export const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || "mongodb+srv://riyad:riyad2@cluster0.iipnz70.mongodb.net/techmart?retryWrites=true&w=majority&appName=Cluster0";
    console.log(`Connecting to MongoDB at ${connUri.substring(0, 30)}...`);
    await mongoose.connect(connUri);
    console.log("MongoDB Connected successfully.");

    // Sync products to database (upsert via bulkWrite)
    console.log("Synchronizing products list with MongoDB...");
    const bulkOps = products.map((productData) => ({
      updateOne: {
        filter: { id: productData.id },
        update: { $set: productData },
        upsert: true,
      },
    }));
    await Product.bulkWrite(bulkOps);
    clearProductCache();
    console.log(`Successfully synchronized ${products.length} products to MongoDB.`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};