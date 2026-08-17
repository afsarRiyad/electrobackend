import { Router } from "express";
import { Product } from "../utils/models.js";
import {
  findProduct,
  getBrands,
  getColors,
  getCategories,
  getHierarchicalCategories,
  getHomeV3Payload,
  queryProducts,
} from "../utils/productQueries.js";

const router = Router();

// ─── POST /api/products/add-specs-to-mobiles ───────────────────────────
// Add specifications to mobile and accessory products (temporary utility endpoint)
router.post("/add-specs-to-mobiles", async (req, res) => {
  try {
    console.log("Adding specifications to mobile and accessory products...");
    
    // Find mobile and accessory products
    const mobileAccessories = await Product.find({
      $or: [
        { categories: { $in: ["Mobile", "Mobiles", "Phone", "Phones", "Smartphone", "Smartphones"] } },
        { categories: { $in: ["Accessories", "Accessory", "Mobile Accessories", "Phone Accessories"] } },
        { name: { $regex: /mobile|phone|smartphone|iphone|samsung|android/i } },
        { name: { $regex: /case|charger|cable|headphone|earphone|powerbank|screen protector/i } }
      ]
    }).lean();

    console.log(`Found ${mobileAccessories.length} mobile and accessory products`);

    let updatedCount = 0;

    for (const product of mobileAccessories) {
      let specifications = [];

      // Determine if it's a mobile phone or accessory
      const isMobile = /mobile|phone|smartphone|iphone|samsung|android/i.test(product.name) && 
                      !/case|charger|cable|headphone|earphone|powerbank|screen protector/i.test(product.name);
      
      if (isMobile) {
        // Mobile phone specifications
        specifications = [
          { name: "Display", value: "6.5", unit: "inches" },
          { name: "Storage", value: "128", unit: "GB" },
          { name: "RAM", value: "8", unit: "GB" },
          { name: "Camera", value: "48", unit: "MP" },
          { name: "Battery", value: "4500", unit: "mAh" },
          { name: "Processor", value: "Snapdragon 8 Gen 2" },
          { name: "Weight", value: "180", unit: "g" },
          { name: "OS", value: "Android 14" }
        ];
      } else {
        // Accessory specifications
        if (/case/i.test(product.name)) {
          specifications = [
            { name: "Material", value: "Silicone" },
            { name: "Compatibility", value: "Universal" },
            { name: "Weight", value: "25", unit: "g" },
            { name: "Color", value: "Various" }
          ];
        } else if (/charger/i.test(product.name)) {
          specifications = [
            { name: "Power", value: "25", unit: "W" },
            { name: "Connector", value: "USB-C" },
            { name: "Cable Length", value: "1.2", unit: "m" },
            { name: "Weight", value: "45", unit: "g" }
          ];
        } else if (/cable/i.test(product.name)) {
          specifications = [
            { name: "Length", value: "1.2", unit: "m" },
            { name: "Connector", value: "USB-C" },
            { name: "Material", value: "Braided Nylon" },
            { name: "Current", value: "3A", unit: "A" }
          ];
        } else if (/headphone|earphone/i.test(product.name)) {
          specifications = [
            { name: "Type", value: "Wireless" },
            { name: "Battery Life", value: "1200", unit: "mAh" },
            { name: "Connectivity", value: "Bluetooth 5.0" },
            { name: "Weight", value: "200", unit: "g" }
          ];
        } else if (/powerbank/i.test(product.name)) {
          specifications = [
            { name: "Capacity", value: "10000", unit: "mAh" },
            { name: "Output", value: "20", unit: "W" },
            { name: "Ports", value: "2 USB-A, 1 USB-C" },
            { name: "Weight", value: "300", unit: "g" }
          ];
        } else if (/screen protector/i.test(product.name)) {
          specifications = [
            { name: "Material", value: "Tempered Glass" },
            { name: "Thickness", value: "0.33", unit: "mm" },
            { name: "Hardness", value: "9H" },
            { name: "Compatibility", value: "Universal" }
          ];
        } else {
          // Generic accessory specs
          specifications = [
            { name: "Weight", value: "100", unit: "g" },
            { name: "Material", value: "Plastic" },
            { name: "Color", value: "Black" },
            { name: "Warranty", value: "1 Year" }
          ];
        }
      }

      // Update the product
      await Product.findByIdAndUpdate(product._id, { specifications });
      console.log(`Updated: ${product.name}`);
      updatedCount++;
    }

    console.log(`Successfully added specifications to ${updatedCount} products!`);
    
    return res.json({ 
      message: `Successfully added specifications to ${updatedCount} products`,
      updatedCount 
    });
  } catch (error) {
    console.error("Error adding product specifications:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/products", async (req, res) => {
  res.json(await queryProducts(req.query));
});

router.get("/products/featured", async (req, res) => {
  try {
    const featuredProducts = await Product.find({ tags: "featured" })
      .select("id name slug sku brand categories tags price regularPrice salePrice rating reviews stock image productUrl description customAttributes metaTitle metaDescription metaKeywords isActive")
      .limit(20)
      .lean();
    res.json({ data: featuredProducts });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/products/:idOrSlug", async (req, res) => {
  const product = await findProduct(req.params.idOrSlug);

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  return res.json({ data: product });
});

router.get("/categories", async (req, res) => {
  res.json({ data: await getCategories() });
});

router.get("/categories/hierarchical", async (req, res) => {
  res.json({ data: await getHierarchicalCategories() });
});

router.get("/brands", async (req, res) => {
  res.json({ data: await getBrands(req.query.category) });
});

router.get("/colors", async (req, res) => {
  res.json({ data: await getColors(req.query.category) });
});

router.get("/home-v3", async (req, res) => {
  res.json({ data: await getHomeV3Payload() });
});

// ─── POST /api/products/add-specs-to-mobiles ───────────────────────────
// Add specifications to mobile and accessory products (temporary utility endpoint)
router.post("/products/add-specs-to-mobiles", async (req, res) => {
  try {
    console.log("Adding specifications to mobile and accessory products...");
    
    // Find mobile and accessory products
    const mobileAccessories = await Product.find({
      $or: [
        { categories: { $in: ["Mobile", "Mobiles", "Phone", "Phones", "Smartphone", "Smartphones"] } },
        { categories: { $in: ["Accessories", "Accessory", "Mobile Accessories", "Phone Accessories"] } },
        { name: { $regex: /mobile|phone|smartphone|iphone|samsung|android/i } },
        { name: { $regex: /case|charger|cable|headphone|earphone|powerbank|screen protector/i } }
      ]
    }).lean();

    console.log(`Found ${mobileAccessories.length} mobile and accessory products`);

    let updatedCount = 0;

    for (const product of mobileAccessories) {
      let specifications = [];

      // Determine if it's a mobile phone or accessory
      const isMobile = /mobile|phone|smartphone|iphone|samsung|android/i.test(product.name) && 
                      !/case|charger|cable|headphone|earphone|powerbank|screen protector/i.test(product.name);
      
      if (isMobile) {
        // Mobile phone specifications
        specifications = [
          { name: "Display", value: "6.5", unit: "inches" },
          { name: "Storage", value: "128", unit: "GB" },
          { name: "RAM", value: "8", unit: "GB" },
          { name: "Camera", value: "48", unit: "MP" },
          { name: "Battery", value: "4500", unit: "mAh" },
          { name: "Processor", value: "Snapdragon 8 Gen 2" },
          { name: "Weight", value: "180", unit: "g" },
          { name: "OS", value: "Android 14" }
        ];
      } else {
        // Accessory specifications
        if (/case/i.test(product.name)) {
          specifications = [
            { name: "Material", value: "Silicone" },
            { name: "Compatibility", value: "Universal" },
            { name: "Weight", value: "25", unit: "g" },
            { name: "Color", value: "Various" }
          ];
        } else if (/charger/i.test(product.name)) {
          specifications = [
            { name: "Power", value: "25", unit: "W" },
            { name: "Connector", value: "USB-C" },
            { name: "Cable Length", value: "1.2", unit: "m" },
            { name: "Weight", value: "45", unit: "g" }
          ];
        } else if (/cable/i.test(product.name)) {
          specifications = [
            { name: "Length", value: "1.2", unit: "m" },
            { name: "Connector", value: "USB-C" },
            { name: "Material", value: "Braided Nylon" },
            { name: "Current", value: "3A", unit: "A" }
          ];
        } else if (/headphone|earphone/i.test(product.name)) {
          specifications = [
            { name: "Type", value: "Wireless" },
            { name: "Battery Life", value: "1200", unit: "mAh" },
            { name: "Connectivity", value: "Bluetooth 5.0" },
            { name: "Weight", value: "200", unit: "g" }
          ];
        } else if (/powerbank/i.test(product.name)) {
          specifications = [
            { name: "Capacity", value: "10000", unit: "mAh" },
            { name: "Output", value: "20", unit: "W" },
            { name: "Ports", value: "2 USB-A, 1 USB-C" },
            { name: "Weight", value: "300", unit: "g" }
          ];
        } else if (/screen protector/i.test(product.name)) {
          specifications = [
            { name: "Material", value: "Tempered Glass" },
            { name: "Thickness", value: "0.33", unit: "mm" },
            { name: "Hardness", value: "9H" },
            { name: "Compatibility", value: "Universal" }
          ];
        } else {
          // Generic accessory specs
          specifications = [
            { name: "Weight", value: "100", unit: "g" },
            { name: "Material", value: "Plastic" },
            { name: "Color", value: "Black" },
            { name: "Warranty", value: "1 Year" }
          ];
        }
      }

      // Update the product
      await Product.findByIdAndUpdate(product._id, { specifications });
      console.log(`Updated: ${product.name}`);
      updatedCount++;
    }

    console.log(`Successfully added specifications to ${updatedCount} products!`);
    
    return res.json({ 
      message: `Successfully added specifications to ${updatedCount} products`,
      updatedCount 
    });
  } catch (error) {
    console.error("Error adding product specifications:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
