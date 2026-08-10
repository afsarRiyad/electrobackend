import mongoose from "mongoose";
import { Product, Category } from "./models.js";
import { homeV3Sections } from "../data/products.js";

const normalize = (value = "") => value.toString().trim().toLowerCase();

let cachedCategories = null;
let cachedBrands = null;

export const clearProductCache = () => {
  cachedCategories = null;
  cachedBrands = null;
};

// Category image mapping
const categoryImages = {
  "Audio Speakers": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/WirelessSound-300x300.png",
  "TV & Audio": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/tabsamg-300x300.png",
  "Laptops": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png",
  "Laptops & Computers": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/macpro-300x300.png",
  "Accessories": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/powerbank-300x300.png",
  "Headphones": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/heade1-300x300.png",
  "Ultrabooks": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png",
  "Smart Phones & Tablets": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/GoldPhone-1-300x300.png",
  "Smartphones": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/redPhone-300x300.png",
  "Game Consoles": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/game1-300x300.png",
  "Video Games & Consoles": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/consal-300x300.png",
  "Computer Cases": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/gamecabin-300x300.png",
  "Computer Components": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/gamecabin-300x300.png",
  "Servers": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/gamecabin-300x300.png",
  "Power Banks": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/powerbank-300x300.png",
  "Gadgets": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/watch-300x300.png",
  "Smartwatches": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/watch-300x300.png",
  "Headphone Cases": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/headphonecase-300x300.png",
  "Headphone Accessories": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/usbheadphone-300x300.png",
  "Printers": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/printer-300x300.png",
  "Printers & Ink": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/printer-300x300.png",
  "Cameras": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/camera2-300x300.png",
  "Cameras & Photography": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/videocamera-300x300.png",
  "Mac Computers": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/macpro-300x300.png",
  "Tablets": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/tabsamg-300x300.png",
  "Chargers": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/whirelesscar-300x300.png",
  "Television": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/applap-300x300.png",
  "Streaming Devices": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/consal-300x300.png",
  "Home Theater Systems": "https://electro.madrasthemes.com/wp-content/uploads/2016/03/headphonecase-300x300.png",
};

export const getCategories = async () => {
  if (cachedCategories) return cachedCategories;
  
  try {
    const categories = await Product.aggregate([
      { $unwind: "$categories" },
      { $group: { _id: "$categories", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);
    
    // Add images to categories
    const categoriesWithImages = categories.map(category => ({
      ...category,
      image: categoryImages[category.name] || "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png"
    }));
    
    cachedCategories = categoriesWithImages;
    return categoriesWithImages;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

export const getHierarchicalCategories = async () => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate('parent', 'name slug')
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Fallback if no Category documents exist in database yet
    if (categories.length === 0) {
      const flatCategories = await getCategories();
      return flatCategories.map((cat, idx) => ({
        _id: `cat-fallback-${idx}`,
        name: cat.name,
        slug: cat.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        image: cat.image,
        count: cat.count,
        children: [],
      }));
    }

    // Build hierarchical structure
    const categoryMap = new Map();
    const rootCategories = [];

    // First pass: create map of all categories
    categories.forEach(category => {
      categoryMap.set(category._id.toString(), {
        ...category,
        children: []
      });
    });

    // Second pass: build hierarchy
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category._id.toString());
      
      if (category.parent) {
        const parentId = category.parent._id
          ? category.parent._id.toString()
          : category.parent.toString();
        const parent = categoryMap.get(parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        } else {
          // If parent is inactive or not found, promote active child to root level
          rootCategories.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    // Fetch product counts per category name
    const categoryCounts = await Product.aggregate([
      { $unwind: "$categories" },
      { $group: { _id: "$categories", count: { $sum: 1 } } }
    ]);
    const countMap = new Map(categoryCounts.map(item => [item._id, item.count]));

    // Add images and counts to categories recursively
    const processCategories = (catList) => {
      return catList.map(category => {
        const processedChildren = category.children.length > 0 ? processCategories(category.children) : [];
        
        // Sum counts of direct matches plus children counts
        const directCount = countMap.get(category.name) || 0;
        const childrenCount = processedChildren.reduce((sum, child) => sum + (child.count || 0), 0);
        const totalCount = directCount > 0 ? directCount : childrenCount;

        return {
          ...category,
          count: totalCount,
          image: category.image || categoryImages[category.name] || "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png",
          children: processedChildren
        };
      });
    };

    return processCategories(rootCategories);
  } catch (error) {
    console.error("Error fetching hierarchical categories:", error);
    return [];
  }
};

export const getBrands = async () => {
  if (cachedBrands) return cachedBrands;
  
  try {
    const brands = await Product.aggregate([
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);
    cachedBrands = brands;
    return brands;
  } catch (error) {
    console.error("Error fetching brands:", error);
    return [];
  }
};

export const findProduct = async (idOrSlug) => {
  if (!idOrSlug) return null;
  
  try {
    const normalized = idOrSlug.toString().trim();

    let product = null;

    // 1. Try matching by MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      product = await Product.findById(idOrSlug).lean();
      if (product) return await addRelatedProducts(product);
    }

    // 2. Try matching by numeric product id or slug
    const numericId = Number(normalized);
    if (!isNaN(numericId)) {
      product = await Product.findOne({ id: numericId }).lean();
      if (product) return await addRelatedProducts(product);
    }
    
    // 3. Fallback to slug match
    product = await Product.findOne({ slug: normalized.toLowerCase() }).lean();
    if (product) return await addRelatedProducts(product);
    
    return null;
  } catch (error) {
    console.error(`Error finding product ${idOrSlug}:`, error);
    return null;
  }
};

const addRelatedProducts = async (product) => {
  try {
    // Get random combo products (random selection from all products)
    const randomComboProducts = await Product.aggregate([
      { $match: { _id: { $ne: product._id } } },
      { $sample: { size: 4 } },
      {
        $project: {
          id: 1,
          name: 1,
          slug: 1,
          price: 1,
          regularPrice: 1,
          salePrice: 1,
          rating: 1,
          reviews: 1,
          stock: 1,
          image: 1,
          categories: 1,
          tags: 1,
          brand: 1
        }
      }
    ]);

    // Get 4 related products based on category, brand, or similar price
    const relatedProducts = await Product.aggregate([
      {
        $match: {
          _id: { $ne: product._id },
          $or: [
            { categories: { $in: product.categories || [] } },
            { brand: product.brand },
            {
              price: {
                $gte: Math.max(0, product.price - 50),
                $lte: product.price + 50
              }
            }
          ]
        }
      },
      { $sample: { size: 4 } },
      {
        $project: {
          id: 1,
          name: 1,
          slug: 1,
          price: 1,
          regularPrice: 1,
          salePrice: 1,
          rating: 1,
          reviews: 1,
          stock: 1,
          image: 1,
          categories: 1,
          tags: 1,
          brand: 1
        }
      }
    ]);

    return {
      ...product,
      randomCombo: randomComboProducts,
      relatedProducts: relatedProducts
    };
  } catch (error) {
    console.error('Error fetching related products:', error);
    return product;
  }
};

export const queryProducts = async (query = {}) => {
  const {
    search,
    category,
    brand,
    tag,
    minPrice,
    maxPrice,
    onSale,
    featured,
    sort = "featured",
    page = 1,
    limit = 12,
  } = query;

  const searchTerm = normalize(search);
  const categoryTerm = normalize(category);
  const brandTerm = normalize(brand);
  const tagTerm = normalize(tag);
  const min = Number(minPrice);
  const max = Number(maxPrice);
  const currentPage = Math.max(Number(page) || 1, 1);
  const perPage = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const filter = {};

  if (searchTerm) {
    filter.$or = [
      { name: { $regex: searchTerm, $options: "i" } },
      { sku: { $regex: searchTerm, $options: "i" } },
      { brand: { $regex: searchTerm, $options: "i" } },
      { categories: { $regex: searchTerm, $options: "i" } },
      { tags: { $regex: searchTerm, $options: "i" } }
    ];
  }

  if (categoryTerm) {
    // Exact case-insensitive category match
    filter.categories = { $regex: new RegExp(`^${categoryTerm}$`, "i") };
  }

  if (brandTerm) {
    // Exact case-insensitive brand match
    filter.brand = { $regex: new RegExp(`^${brandTerm}$`, "i") };
  }

  if (tagTerm) {
    // Exact case-insensitive tag match
    filter.tags = { $regex: new RegExp(`^${tagTerm}$`, "i") };
  }

  if (!isNaN(min) || !isNaN(max)) {
    filter.price = {};
    if (!isNaN(min)) filter.price.$gte = min;
    if (!isNaN(max)) filter.price.$lte = max;
  }

  if (onSale === "true") {
    filter.salePrice = { $ne: null };
  }

  if (featured === "true") {
    filter.tags = { $in: ["featured"] };
  }

  // Handle sorting
  let sortObj = {};
  switch (sort) {
    case "price-asc":
      sortObj = { price: 1 };
      break;
    case "price-desc":
      sortObj = { price: -1 };
      break;
    case "rating":
      sortObj = { rating: -1 };
      break;
    case "newest":
      sortObj = { id: -1 };
      break;
    case "name":
      sortObj = { name: 1 };
      break;
    default:
      // Default: sort by featured first, then rating
      sortObj = { rating: -1 };
      break;
  }

  try {
    const [total, data] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .select("id name slug price regularPrice salePrice rating reviews stock image categories tags brand")
        .sort(sortObj)
        .skip((currentPage - 1) * perPage)
        .limit(perPage)
        .lean()
    ]);

    return {
      data,
      meta: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
        sort,
      },
    };
  } catch (error) {
    console.error("Error querying products:", error);
    return {
      data: [],
      meta: {
        total: 0,
        page: currentPage,
        limit: perPage,
        totalPages: 0,
        sort,
      }
    };
  }
};

export const getHomeV3Payload = async () => {
  try {
    // Collect all unique product IDs from homeV3Sections
    const allProductIds = [...new Set(homeV3Sections.flatMap((section) => section.productIds))];

    // Fetch heroDeals, categories, and all section products in parallel
    const [heroDeals, categories, productsInDb] = await Promise.all([
      Product.find({ tags: "top-rated" })
        .select("id name slug price regularPrice salePrice rating reviews stock image categories tags brand")
        .limit(3)
        .lean(),
      getCategories(),
      Product.find({ id: { $in: allProductIds } })
        .select("id name slug price regularPrice salePrice rating reviews stock image categories tags brand")
        .lean(),
    ]);

    // Map database results by their product "id" for O(1) retrieval
    const productMap = new Map(productsInDb.map((p) => [p.id, p]));

    // Construct home v3 sections synchronously
    const sections = homeV3Sections.map((section) => ({
      ...section,
      products: section.productIds.map((id) => productMap.get(id)).filter(Boolean),
    }));

    return {
      heroDeals,
      categories,
      sections,
    };
  } catch (error) {
    console.error("Error building home-v3 payload:", error);
    return {
      heroDeals: [],
      categories: [],
      sections: [],
    };
  }
};
