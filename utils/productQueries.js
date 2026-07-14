import mongoose from "mongoose";
import { Product } from "./models.js";
import { homeV3Sections } from "../data/products.js";

const normalize = (value = "") => value.toString().trim().toLowerCase();

export const getCategories = async () => {
  try {
    const categories = await Product.aggregate([
      { $unwind: "$categories" },
      { $group: { _id: "$categories", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);
    return categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

export const getBrands = async () => {
  try {
    const brands = await Product.aggregate([
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);
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
      const product = await Product.findById(idOrSlug);
      if (product) return product;
    }

    // 2. Try matching by numeric product id or slug
    const numericId = Number(normalized);
    if (!isNaN(numericId)) {
      const product = await Product.findOne({ id: numericId });
      if (product) return product;
    }
    
    // 3. Fallback to slug match
    return await Product.findOne({ slug: normalized.toLowerCase() });
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
    const total = await Product.countDocuments(filter);
    const data = await Product.find(filter)
      .sort(sortObj)
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

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
    const heroDeals = await Product.find({ tags: "top-rated" }).limit(3);
    const categories = await getCategories();
    
    const sections = [];
    for (const section of homeV3Sections) {
      const products = [];
      for (const id of section.productIds) {
        const prod = await findProduct(id);
        if (prod) products.push(prod);
      }
      sections.push({
        ...section,
        products,
      });
    }

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
