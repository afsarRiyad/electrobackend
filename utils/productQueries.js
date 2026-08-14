import mongoose from "mongoose";
import { Product, Category, Review } from "./models.js";
import { homeV3Sections } from "../data/products.js";

const normalize = (value = "") => value.toString().trim().toLowerCase();

let cachedCategories = null;
let cachedBrands = null;
let cachedHierarchicalCategories = null;
let hierarchicalCategoriesCacheTime = null;
let categoryPathCache = new Map();

export const clearProductCache = () => {
  cachedCategories = null;
  cachedBrands = null;
  cachedHierarchicalCategories = null;
  hierarchicalCategoriesCacheTime = null;
  categoryPathCache.clear();
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
    
    // Get total product count for "View All Products"
    const totalProducts = await Product.countDocuments({ isActive: { $ne: false } });
    
    // Add images to categories
    const categoriesWithImages = categories.map(category => ({
      ...category,
      image: categoryImages[category.name] || "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png"
    }));
    
    // Add "View All Products" at the beginning
    const viewAllProductsCategory = {
      name: "View All Products",
      count: totalProducts,
      image: "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png"
    };
    
    const categoriesWithViewAll = [viewAllProductsCategory, ...categoriesWithImages];
    
    cachedCategories = categoriesWithViewAll;
    return categoriesWithViewAll;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

export const getHierarchicalCategories = async () => {
  // Cache for 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;
  const now = Date.now();
  
  if (cachedHierarchicalCategories && hierarchicalCategoriesCacheTime && 
      (now - hierarchicalCategoriesCacheTime) < CACHE_DURATION) {
    return cachedHierarchicalCategories;
  }
  
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

    // Products created before the Category model use the `categories` name
    // array, while newer products use the `category` reference. Support both
    // forms so filters remain populated during the migration.
    const categoryIdsByName = new Map();
    categories.forEach(category => {
      const categoryId = category._id.toString();
      categoryIdsByName.set(category.name.trim().toLowerCase(), categoryId);
      categoryIdsByName.set(category.slug.trim().toLowerCase(), categoryId);
    });
    const parentIdByCategoryId = new Map(
      categories.map(category => [
        category._id.toString(),
        category.parent?._id?.toString() || null,
      ])
    );

    // Older product records predate the `isActive` field. They are active
    // unless explicitly disabled, so excluding only `false` preserves them.
    // OPTIMIZATION: Use aggregation instead of fetching all products
    const productAggregation = await Product.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $project: {
          name: 1,
          categories: 1,
          category: 1,
          tags: 1,
          brand: 1,
          customAttributes: 1,
          price: 1
        }
      }
    ]);
    const products = productAggregation;
    const fallbackColorNames = ["Black", "White", "Red", "Blue", "Gold", "Purple", "Green", "Silver", "Gray"];

    // Build a map of category ID to filters and counts.
    const categoryFilterMap = new Map();

    // Initialize all categories with empty filters and zero count
    categories.forEach(cat => {
      categoryFilterMap.set(cat._id.toString(), {
        brands: new Map(),
        colors: new Map(),
        minPrice: Infinity,
        maxPrice: 0,
        count: 0
      });
    });

    // Process each product and add to matching categories
    products.forEach(product => {
      const matchedCategoryIds = new Set();
      if (product.category) matchedCategoryIds.add(product.category.toString());
      (product.categories || []).forEach(categoryName => {
        if (typeof categoryName !== 'string') return;
        const categoryId = categoryIdsByName.get(categoryName.trim().toLowerCase());
        if (categoryId) matchedCategoryIds.add(categoryId);
      });

      // A product in a child category must also be available through every
      // ancestor category's filter options.
      [...matchedCategoryIds].forEach(categoryId => {
        let parentId = parentIdByCategoryId.get(categoryId);
        while (parentId) {
          matchedCategoryIds.add(parentId);
          parentId = parentIdByCategoryId.get(parentId);
        }
      });

      matchedCategoryIds.forEach(catId => {
        const filters = categoryFilterMap.get(catId);
        if (filters) {
          filters.count++;
          if (typeof product.brand === 'string' && product.brand.trim()) {
            const brand = product.brand.trim();
            filters.brands.set(brand, (filters.brands.get(brand) || 0) + 1);
          }
          (product.customAttributes || []).forEach(attr => {
            const isColor = attr?.type === 'color' || /^color$/i.test(attr?.name || '');
            if (!isColor || attr.value === undefined || attr.value === null || attr.value === '') return;

            const colorValues = Array.isArray(attr.value) ? attr.value : [attr.value];
            colorValues.forEach(color => {
              if (typeof color === 'string' && color.trim()) {
                const colorName = color.trim();
                filters.colors.set(colorName, (filters.colors.get(colorName) || 0) + 1);
              }
            });
          });
          fallbackColorNames.forEach(color => {
            const colorPattern = new RegExp(`\\b${color}\\b`, 'i');
            const appearsInName = typeof product.name === 'string' && colorPattern.test(product.name);
            const appearsInTags = (product.tags || []).some(tag => typeof tag === 'string' && colorPattern.test(tag));
            if (appearsInName || appearsInTags) {
              filters.colors.set(color, (filters.colors.get(color) || 0) + 1);
            }
          });
          if (product.price < filters.minPrice) filters.minPrice = product.price;
          if (product.price > filters.maxPrice) filters.maxPrice = product.price;
        }
      });
    });

    // Convert Maps to arrays and handle empty price ranges
    const filterMap = new Map();
    categoryFilterMap.forEach((filters, catId) => {
      filterMap.set(catId, {
        brands: filters.brands,
        colors: filters.colors,
        count: filters.count,
        priceRange: {
          min: filters.minPrice === Infinity ? null : filters.minPrice,
          max: filters.maxPrice
        }
      });
    });

    // Add images and filters to categories
    const addImagesAndFilters = (categories) => {
      return categories.map(category => {
        // Get filters for current category by ID
        const categoryFilters = filterMap.get(category._id.toString()) || { 
          brands: new Map(), 
          colors: new Map(), 
          count: 0,
          priceRange: { min: null, max: 0 } 
        };

        // Process children first to get their filters
        const processedChildren = category.children.length > 0 ? addImagesAndFilters(category.children) : [];

        // Parent categories were already populated from their descendants
        // above, so aggregating their children here would double-count items.
        let minPrice = categoryFilters.priceRange.min;
        let maxPrice = categoryFilters.priceRange.max || 0;

        return {
          ...category,
          image: category.image || categoryImages[category.name] || "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png",
          count: categoryFilters.count,
          filters: {
            brands: Array.from(categoryFilters.brands, ([name, count]) => ({ name, count }))
              .sort((a, b) => a.name.localeCompare(b.name)),
            colors: Array.from(categoryFilters.colors, ([name, count]) => ({ name, count }))
              .sort((a, b) => a.name.localeCompare(b.name)),
            priceRange: {
              min: minPrice === null ? 0 : minPrice,
              max: maxPrice
            }
          },
          children: processedChildren
        };
      });
    };

    // Calculate total products and aggregate all filters for "View All Products"
    const totalProducts = products.length;
    const allBrands = new Map();
    const allColors = new Map();
    let globalMinPrice = Infinity;
    let globalMaxPrice = 0;

    products.forEach(product => {
      if (typeof product.brand === 'string' && product.brand.trim()) {
        const brand = product.brand.trim();
        allBrands.set(brand, (allBrands.get(brand) || 0) + 1);
      }
      (product.customAttributes || []).forEach(attr => {
        const isColor = attr?.type === 'color' || /^color$/i.test(attr?.name || '');
        if (!isColor || attr.value === undefined || attr.value === null || attr.value === '') return;

        const colorValues = Array.isArray(attr.value) ? attr.value : [attr.value];
        colorValues.forEach(color => {
          if (typeof color === 'string' && color.trim()) {
            const colorName = color.trim();
            allColors.set(colorName, (allColors.get(colorName) || 0) + 1);
          }
        });
      });
      fallbackColorNames.forEach(color => {
        const colorPattern = new RegExp(`\\b${color}\\b`, 'i');
        const appearsInName = typeof product.name === 'string' && colorPattern.test(product.name);
        const appearsInTags = (product.tags || []).some(tag => typeof tag === 'string' && colorPattern.test(tag));
        if (appearsInName || appearsInTags) {
          allColors.set(color, (allColors.get(color) || 0) + 1);
        }
      });
      if (product.price < globalMinPrice) globalMinPrice = product.price;
      if (product.price > globalMaxPrice) globalMaxPrice = product.price;
    });

    // Add "View All Products" category at the top
    const viewAllProductsCategory = {
      _id: "view-all-products",
      name: "View All Products",
      slug: "view-all-products",
      description: "View all products across all categories",
      parent: null,
      image: "https://electro.madrasthemes.com/wp-content/uploads/2016/03/Ultrabooks-300x300.png",
      icon: null,
      isActive: true,
      displayOrder: 0,
      count: totalProducts,
      filters: {
        brands: Array.from(allBrands, ([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        colors: Array.from(allColors, ([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        priceRange: {
          min: globalMinPrice === Infinity ? 0 : globalMinPrice,
          max: globalMaxPrice
        }
      },
      children: []
    };

    const result = [viewAllProductsCategory, ...addImagesAndFilters(rootCategories)];
    
    // Cache the result
    cachedHierarchicalCategories = result;
    hierarchicalCategoriesCacheTime = now;
    
    return result;
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

const buildCategoryPath = async (category, categoryNames = []) => {
  // If category reference exists, use it
  if (category) {
    const cacheKey = category._id.toString();
    
    // Check cache first
    if (categoryPathCache.has(cacheKey)) {
      return categoryPathCache.get(cacheKey);
    }
    
    const path = [];
    let currentCategory = category;
    
    while (currentCategory) {
      path.unshift({
        _id: currentCategory._id,
        name: currentCategory.name,
        slug: currentCategory.slug
      });
      
      if (currentCategory.parent) {
        currentCategory = await Category.findById(currentCategory.parent).lean();
      } else {
        currentCategory = null;
      }
    }
    
    // Cache the result
    categoryPathCache.set(cacheKey, path);
    return path;
  }
  
  // Fallback: try to find category from category names array
  if (categoryNames && categoryNames.length > 0) {
    // Use the last category name (most specific)
    const categoryName = categoryNames[categoryNames.length - 1];
    const foundCategory = await Category.findOne({ name: categoryName }).lean();
    
    if (foundCategory) {
      return buildCategoryPath(foundCategory);
    }
  }
  
  return [];
};

export const findProduct = async (idOrSlug) => {
  if (!idOrSlug) return null;
  
  try {
    const normalized = idOrSlug.toString().trim();

    let product = null;

    // 1. Try matching by MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      product = await Product.findById(idOrSlug).lean();
      if (product) {
        // Fetch category separately only if needed
        if (product.category) {
          product.category = await Category.findById(product.category).lean();
        }
        product.breadcrumbs = await buildCategoryPath(product.category, product.categories);
        return await addRelatedProducts(product);
      }
    }

    // 2. Try matching by numeric product id or slug
    const numericId = Number(normalized);
    if (!isNaN(numericId)) {
      product = await Product.findOne({ id: numericId }).lean();
      if (product) {
        // Fetch category separately only if needed
        if (product.category) {
          product.category = await Category.findById(product.category).lean();
        }
        product.breadcrumbs = await buildCategoryPath(product.category, product.categories);
        return await addRelatedProducts(product);
      }
    }
    
    // 3. Fallback to slug match
    product = await Product.findOne({ slug: normalized.toLowerCase() }).lean();
    if (product) {
      // Fetch category separately only if needed
      if (product.category) {
        product.category = await Category.findById(product.category).lean();
      }
      product.breadcrumbs = await buildCategoryPath(product.category, product.categories);
      return await addRelatedProducts(product);
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding product ${idOrSlug}:`, error);
    return null;
  }
};

const COMBO_PRODUCT_PROJECTION = {
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
  brand: 1,
  description: 1,
};

const getCategoryId = (item) => {
  if (!item?.category) return null;
  return item.category._id || item.category;
};

const toComboProduct = (item) => ({
  _id: item._id,
  id: item.id,
  name: item.name,
  slug: item.slug,
  price: item.price,
  regularPrice: item.regularPrice,
  salePrice: item.salePrice,
  rating: item.rating,
  reviews: item.reviews,
  stock: item.stock,
  image: item.image,
  categories: item.categories,
  tags: item.tags,
  brand: item.brand,
  description: item.description,
});

const buildRelatedProductFilter = (anchor, excludeIds = []) => {
  const exclude = [anchor._id, ...excludeIds].filter(Boolean);
  const filter = {
    _id: { $nin: exclude },
    isActive: { $ne: false },
  };

  const orConditions = [];
  if (anchor.categories?.length) {
    orConditions.push({ categories: { $in: anchor.categories } });
  }
  if (anchor.brand) {
    orConditions.push({ brand: anchor.brand });
  }

  const categoryId = getCategoryId(anchor);
  if (categoryId) {
    orConditions.push({ category: categoryId });
  }

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  return filter;
};

const fetchRelatedProductsForCombo = async (anchor, excludeIds = [], limit = 2) => {
  const relatedFilter = buildRelatedProductFilter(anchor, excludeIds);

  let results = await Product.aggregate([
    { $match: relatedFilter },
    { $sort: { rating: -1, reviews: -1 } },
    { $limit: limit },
    { $project: COMBO_PRODUCT_PROJECTION },
  ]);

  if (results.length < limit) {
    const fallback = await Product.aggregate([
      {
        $match: {
          _id: { $nin: [anchor._id, ...excludeIds, ...results.map((item) => item._id)] },
          isActive: { $ne: false },
        },
      },
      { $sort: { rating: -1, reviews: -1 } },
      { $limit: limit - results.length },
      { $project: COMBO_PRODUCT_PROJECTION },
    ]);
    results = [...results, ...fallback];
  }

  return results;
};

const buildComboPack = async (anchor, excludeIds = []) => {
  const addons = await fetchRelatedProductsForCombo(anchor, excludeIds, 2);
  return [toComboProduct(anchor), ...addons.map(toComboProduct)];
};

const addRelatedProducts = async (product) => {
  try {
    // ===== COMBO PACK (current product at index 0) =====
    const randomCombo = await buildComboPack(product);

    // ===== RELATED PRODUCTS =====
    const relatedProducts = await Product.aggregate([
      { $match: { _id: { $ne: product._id }, isActive: { $ne: false } } },
      { $sample: { size: 4 } },
      {
        $project: {
          id: 1, name: 1, slug: 1, price: 1, regularPrice: 1, salePrice: 1,
          rating: 1, reviews: 1, stock: 1, image: 1, categories: 1, tags: 1,
          brand: 1, description: 1, specifications: 1
        }
      }
    ]);

    // ===== MORE PRODUCTS =====
    const moreProducts = await Product.aggregate([
      { $match: buildRelatedProductFilter(product) },
      { $sort: { rating: -1, reviews: -1 } },
      { $limit: 8 },
      {
        $project: {
          id: 1, name: 1, slug: 1, price: 1, regularPrice: 1, salePrice: 1,
          rating: 1, reviews: 1, stock: 1, image: 1, categories: 1, tags: 1,
          brand: 1, description: 1, customAttributes: 1
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

    const result = {
      ...product,
      reviews: reviews,
      reviewStats: {
        total: reviews.length,
        ratingDistribution
      },
      randomCombo,
      relatedProducts: relatedProducts,
      moreProducts: moreProducts
    };

    return result;
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
  const perPage = Math.min(Math.max(Number(limit) || 12, 1), 100);

  const filter = { isActive: { $ne: false } };

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\&');

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
        .select("id name slug sku brand categories tags price regularPrice salePrice rating reviews stock image images productUrl description customAttributes metaTitle metaDescription metaKeywords isActive category specifications")
        .sort(sortObj)
        .skip((currentPage - 1) * perPage)
        .limit(perPage)
        .lean()
    ]);

    // Collect all unique category IDs that need to be fetched
    const categoryIds = new Set();
    const categoryNames = new Set();
    
    for (const product of data) {
      if (product.category) {
        categoryIds.add(product.category.toString());
      }
      (product.categories || []).forEach(cat => {
        if (typeof cat === 'string') {
          categoryNames.add(cat);
        }
      });
    }

    // Fetch all categories at once
    const categoriesMap = new Map();
    if (categoryIds.size > 0) {
      const categories = await Category.find({ _id: { $in: Array.from(categoryIds) } }).lean();
      categories.forEach(cat => categoriesMap.set(cat._id.toString(), cat));
    }

    // Add breadcrumbs to each product (optimized - no N+1 queries)
    for (const product of data) {
      const category = product.category ? categoriesMap.get(product.category.toString()) : null;
      product.breadcrumbs = await buildCategoryPath(category, product.categories);
    }

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
        .select("id name slug sku brand categories tags price regularPrice salePrice rating reviews stock image productUrl description customAttributes metaTitle metaDescription metaKeywords isActive")
        .limit(3)
        .lean(),
      getCategories(),
      Product.find({ id: { $in: allProductIds } })
        .select("id name slug sku brand categories tags price regularPrice salePrice rating reviews stock image productUrl description customAttributes metaTitle metaDescription metaKeywords isActive")
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
