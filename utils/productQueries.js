import mongoose from "mongoose";
import { Product, Category, Review } from "./models.js";
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
        const parent = categoryMap.get(category.parent._id.toString());
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    // Get all category names for product filtering
    const allCategoryNames = categories.map(cat => cat.name);

    // Get available brands, colors, and price ranges for products in these categories
    const productFilters = await Product.aggregate([
      { $match: { categories: { $in: allCategoryNames }, isActive: true } },
      { $unwind: "$categories" },
      {
        $group: {
          _id: "$categories",
          brands: { $addToSet: "$brand" },
          colors: { $addToSet: "$customAttributes.value" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" }
        }
      }
    ]);

    const filterMap = new Map();
    productFilters.forEach(filter => {
      const colors = filter.colors.filter(c => c != null);
      filterMap.set(filter._id, {
        brands: filter.brands.filter(Boolean),
        colors: colors,
        priceRange: {
          min: filter.minPrice || 0,
          max: filter.maxPrice || 0
        }
      });
    });

    // Add images and filters to categories
    const addImagesAndFilters = (categories) => {
      return categories.map(category => {
        const filters = filterMap.get(category.name) || { brands: [], colors: [], priceRange: { min: 0, max: 0 } };
        return {
          ...category,
          image: category.image || categoryImages[category.name] || "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png",
          filters: {
            brands: filters.brands,
            colors: filters.colors,
            priceRange: filters.priceRange
          },
          children: category.children.length > 0 ? addImagesAndFilters(category.children) : []
        };
      });
    };

    return addImagesAndFilters(rootCategories);
  } catch (error) {
    console.error("Error fetching hierarchical categories:", error);
    return [];
  }
};

export const getBrands = async (category = "") => {
  const categoryTerm = normalize(category);
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (!categoryTerm && cachedBrands) return cachedBrands;
  
  try {
    const matchFilter = { brand: { $ne: null, $exists: true, $ne: "" } };
    if (categoryTerm) {
      matchFilter.categories = { $regex: new RegExp(`^${escapeRegex(categoryTerm)}$`, "i") };
    }

    const brands = await Product.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);

    if (brands && brands.length > 0) {
      if (!categoryTerm) cachedBrands = brands;
      return brands;
    }

    // Fallback from products dataset if DB aggregation is empty
    const brandMap = new Map();
    const filteredProducts = categoryTerm 
      ? products.filter(p => p.categories && p.categories.some(c => c.toLowerCase() === categoryTerm))
      : products;

    filteredProducts.forEach(p => {
      if (p.brand) {
        brandMap.set(p.brand, (brandMap.get(p.brand) || 0) + 1);
      }
    });
    const fallbackBrands = Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return fallbackBrands;
  } catch (error) {
    console.error("Error fetching brands:", error);
    const brandMap = new Map();
    const filteredProducts = categoryTerm 
      ? products.filter(p => p.categories && p.categories.some(c => c.toLowerCase() === categoryTerm))
      : products;

    filteredProducts.forEach(p => {
      if (p.brand) {
        brandMap.set(p.brand, (brandMap.get(p.brand) || 0) + 1);
      }
    });
    return Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
};

export const getColors = async (category = "") => {
  const categoryTerm = normalize(category);
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  try {
    const matchFilter = {};
    if (categoryTerm) {
      matchFilter.categories = { $regex: new RegExp(`^${escapeRegex(categoryTerm)}$`, "i") };
    }

    const attrColors = await Product.aggregate([
      { $match: matchFilter },
      { $unwind: "$customAttributes" },
      { $match: { "customAttributes.name": { $regex: /^color$/i } } },
      { $group: { _id: "$customAttributes.value", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);

    if (attrColors.length > 0) return attrColors;

    const commonColors = ["Black", "White", "Red", "Blue", "Gold", "Purple", "Green", "Silver", "Gray"];
    const results = [];

    // Try counting from database
    for (const color of commonColors) {
      const dbFilter = {
        ...matchFilter,
        $or: [
          { name: { $regex: color, $options: "i" } },
          { tags: { $regex: color, $options: "i" } }
        ]
      };
      const count = await Product.countDocuments(dbFilter);
      if (count > 0) {
        results.push({ name: color, count });
      }
    }

    if (results.length > 0) return results;

    // Fallback from products dataset if DB is empty
    const filteredProducts = categoryTerm 
      ? products.filter(p => p.categories && p.categories.some(c => c.toLowerCase() === categoryTerm))
      : products;

    for (const color of commonColors) {
      const count = filteredProducts.filter(p => 
        (p.name && p.name.toLowerCase().includes(color.toLowerCase())) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(color.toLowerCase())))
      ).length;

      if (count > 0) {
        results.push({ name: color, count });
      }
    }

    return results;
  } catch (error) {
    console.error("Error fetching colors:", error);
    const filteredProducts = categoryTerm 
      ? products.filter(p => p.categories && p.categories.some(c => c.toLowerCase() === categoryTerm))
      : products;

    const commonColors = ["Black", "White", "Red", "Blue", "Gold", "Purple", "Green", "Silver", "Gray"];
    const results = [];
    for (const color of commonColors) {
      const count = filteredProducts.filter(p => 
        (p.name && p.name.toLowerCase().includes(color.toLowerCase())) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(color.toLowerCase())))
      ).length;

      if (count > 0) {
        results.push({ name: color, count });
      }
    }
    return results;
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

    // Get approved reviews for this product
    const reviews = await Review.find({ product: product._id, status: "approved" })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Calculate rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { product: product._id, status: "approved" } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const ratingDistribution = {};
    for (let i = 5; i >= 1; i--) {
      ratingDistribution[i] = ratingStats.find(r => r._id === i)?.count || 0;
    }

    return {
      ...product,
      randomCombo: randomComboProducts,
      relatedProducts: relatedProducts,
      reviews: reviews,
      reviewStats: {
        total: reviews.length,
        ratingDistribution
      }
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
    color,
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
  const colorTerm = normalize(color);
  const tagTerm = normalize(tag);
  const min = Number(minPrice);
  const max = Number(maxPrice);
  const currentPage = Math.max(Number(page) || 1, 1);
  const perPage = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const filter = {};

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (searchTerm) {
    const safeSearch = escapeRegex(searchTerm);
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { sku: { $regex: safeSearch, $options: "i" } },
      { brand: { $regex: safeSearch, $options: "i" } },
      { categories: { $regex: safeSearch, $options: "i" } },
      { tags: { $regex: safeSearch, $options: "i" } }
    ];
  }

  if (categoryTerm) {
    // Exact case-insensitive category match
    filter.categories = { $regex: new RegExp(`^${escapeRegex(categoryTerm)}$`, "i") };
  }

  if (brandTerm) {
    const brandsList = brandTerm.split(',').map(b => b.trim()).filter(Boolean);
    if (brandsList.length > 1) {
      filter.brand = { $in: brandsList.map(b => new RegExp(`^${escapeRegex(b)}$`, "i")) };
    } else {
      filter.brand = { $regex: new RegExp(`^${escapeRegex(brandTerm)}$`, "i") };
    }
  }

  if (colorTerm) {
    filter.$or = [
      { "customAttributes.value": { $regex: new RegExp(`^${escapeRegex(colorTerm)}$`, "i") } },
      { name: { $regex: escapeRegex(colorTerm), $options: "i" } },
      { tags: { $regex: escapeRegex(colorTerm), $options: "i" } }
    ];
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
    case "avg-rating":
      sortObj = { rating: -1 };
      break;
    case "popularity":
      sortObj = { reviews: -1 };
      break;
    case "newest":
    case "latest":
      sortObj = { id: -1 };
      break;
    case "name":
      sortObj = { name: 1 };
      break;
    case "relevance":
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
