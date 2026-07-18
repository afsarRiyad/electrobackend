import mongoose from "mongoose";
import { Product } from "./models.js";
import { products } from "../data/products.js";
import { clearProductCache } from "./productQueries.js";

export const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || "mongodb+srv://riyad:riyad2@cluster0.iipnz70.mongodb.net/techmart?retryWrites=true&w=majority&appName=Cluster0";
    console.log(`Connecting to MongoDB at ${connUri.substring(0, 30)}...`);
    
    // Optimized connection options for free tier
    await mongoose.connect(connUri, {
      maxPoolSize: 10, // Reduced for free tier
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
    
    console.log("MongoDB Connected successfully.");

    // Sync products to database (upsert via bulkWrite) - only if needed
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
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
    } else {
      console.log(`Database already has ${productCount} products. Skipping sync.`);
    }
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};