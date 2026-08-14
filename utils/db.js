import mongoose from "mongoose";
import { Product } from "./models.js";
import { products } from "../data/products.js";
import { clearProductCache } from "./productQueries.js";

export const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI;
    if (!connUri) {
      throw new Error("MONGODB_URI is required");
    }
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

    // Sync products to database (upsert via bulkWrite) - always update to include new fields
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

    // Sync categories to database if empty
    const { Category } = await import("./models.js");
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      console.log("Seeding default Electro category hierarchy...");
      const defaultCategories = [
        {
          name: "Accessories",
          slug: "accessories",
          displayOrder: 1,
          children: [
            { name: "Headphones", slug: "headphones", displayOrder: 1 },
            { name: "Headphone Cases", slug: "headphone-cases", displayOrder: 2 },
            { name: "Headphone Accessories", slug: "headphone-accessories", displayOrder: 3 },
            { name: "Power Banks", slug: "power-banks", displayOrder: 4 },
            { name: "Chargers", slug: "chargers", displayOrder: 5 },
          ],
        },
        {
          name: "Cameras & Photography",
          slug: "cameras-photography",
          displayOrder: 2,
          children: [
            { name: "Cameras", slug: "cameras", displayOrder: 1 },
          ],
        },
        {
          name: "Computer Components",
          slug: "computer-components",
          displayOrder: 3,
          children: [
            { name: "Computer Cases", slug: "computer-cases", displayOrder: 1 },
            { name: "Servers", slug: "servers", displayOrder: 2 },
          ],
        },
        {
          name: "Gadgets",
          slug: "gadgets",
          displayOrder: 4,
          children: [
            { name: "Smartwatches", slug: "smartwatches", displayOrder: 1 },
          ],
        },
        {
          name: "Laptops & Computers",
          slug: "laptops-computers",
          displayOrder: 5,
          children: [
            { name: "Laptops", slug: "laptops", displayOrder: 1 },
            { name: "Ultrabooks", slug: "ultrabooks", displayOrder: 2 },
            { name: "Mac Computers", slug: "mac-computers", displayOrder: 3 },
          ],
        },
        {
          name: "Printers & Ink",
          slug: "printers-ink",
          displayOrder: 6,
          children: [
            { name: "Printers", slug: "printers", displayOrder: 1 },
          ],
        },
        {
          name: "Smart Phones & Tablets",
          slug: "smart-phones-tablets",
          displayOrder: 7,
          children: [
            { name: "Smartphones", slug: "smartphones", displayOrder: 1 },
            { name: "Tablets", slug: "tablets", displayOrder: 2 },
          ],
        },
        {
          name: "TV & Audio",
          slug: "tv-audio",
          displayOrder: 8,
          children: [
            { name: "Audio Speakers", slug: "audio-speakers", displayOrder: 1 },
            { name: "Television", slug: "television", displayOrder: 2 },
            { name: "Streaming Devices", slug: "streaming-devices", displayOrder: 3 },
            { name: "Home Theater Systems", slug: "home-theater-systems", displayOrder: 4 },
          ],
        },
        {
          name: "Video Games & Consoles",
          slug: "video-games-consoles",
          displayOrder: 9,
          children: [
            { name: "Game Consoles", slug: "game-consoles", displayOrder: 1 },
          ],
        },
      ];

      for (const parentCat of defaultCategories) {
        const createdParent = await Category.create({
          name: parentCat.name,
          slug: parentCat.slug,
          displayOrder: parentCat.displayOrder,
          parent: null,
          isActive: true,
        });

        if (parentCat.children && parentCat.children.length > 0) {
          for (const childCat of parentCat.children) {
            await Category.create({
              name: childCat.name,
              slug: childCat.slug,
              displayOrder: childCat.displayOrder,
              parent: createdParent._id,
              isActive: true,
            });
          }
        }
      }
      console.log("Successfully seeded category hierarchy.");
    }
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};