import mongoose from "mongoose";
import { Product } from "./models.js";
import { homeV3Sections } from "../data/products.js";

const normalize = (value = "") => value.toString().trim().toLowerCase();

let cachedCategories = null;
let cachedBrands = null;

export const clearProductCache = () => {
  cachedCategories = null;
  cachedBrands = null;
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
    cachedCategories = categories;
    return categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
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

    // 1. Try matching by MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      const product = await Product.findById(idOrSlug).lean();
      if (product) return product;
    }

    // 2. Try matching by numeric product id or slug
    const numericId = Number(normalized);
    if (!isNaN(numericId)) {
      const product = await Product.findOne({ id: numericId }).lean();
      if (product) return product;
    }
    
    // 3. Fallback to slug match
    return await Product.findOne({ slug: normalized.toLowerCase() }).lean();
  } catch (error) {
    console.error(`Error finding product ${idOrSlug}:`, error);
    return null;
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
      Product.find({ tags: "top-rated" }).limit(3).lean(),
      getCategories(),
      Product.find({ id: { $in: allProductIds } }).lean(),
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
