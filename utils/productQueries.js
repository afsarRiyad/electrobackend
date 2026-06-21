import { homeV3Sections, products } from "../data/products.js";

const normalize = (value = "") => value.toString().trim().toLowerCase();

const includesText = (value, search) => normalize(value).includes(search);

export const getCategories = () => {
  const categoryMap = new Map();

  products.forEach((product) => {
    product.categories.forEach((category) => {
      const current = categoryMap.get(category) || { name: category, count: 0 };
      categoryMap.set(category, { ...current, count: current.count + 1 });
    });
  });

  return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const getBrands = () => {
  const brandMap = new Map();

  products.forEach((product) => {
    const current = brandMap.get(product.brand) || { name: product.brand, count: 0 };
    brandMap.set(product.brand, { ...current, count: current.count + 1 });
  });

  return Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const findProduct = (idOrSlug) => {
  const value = normalize(idOrSlug);
  return products.find((product) => product.id.toString() === value || product.slug === value);
};

export const queryProducts = (query = {}) => {
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

  let results = [...products];

  if (searchTerm) {
    results = results.filter((product) => {
      return (
        includesText(product.name, searchTerm) ||
        includesText(product.sku, searchTerm) ||
        includesText(product.brand, searchTerm) ||
        product.categories.some((item) => includesText(item, searchTerm)) ||
        product.tags.some((item) => includesText(item, searchTerm))
      );
    });
  }

  if (categoryTerm) {
    results = results.filter((product) =>
      product.categories.some((item) => normalize(item) === categoryTerm),
    );
  }

  if (brandTerm) {
    results = results.filter((product) => normalize(product.brand) === brandTerm);
  }

  if (tagTerm) {
    results = results.filter((product) => product.tags.some((item) => normalize(item) === tagTerm));
  }

  if (!Number.isNaN(min)) {
    results = results.filter((product) => product.price >= min);
  }

  if (!Number.isNaN(max)) {
    results = results.filter((product) => product.price <= max);
  }

  if (onSale === "true") {
    results = results.filter((product) => product.salePrice !== null);
  }

  if (featured === "true") {
    results = results.filter((product) => product.tags.includes("featured"));
  }

  results = sortProducts(results, sort);

  const total = results.length;
  const start = (currentPage - 1) * perPage;
  const data = results.slice(start, start + perPage);

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
};

export const getHomeV3Payload = () => {
  return {
    heroDeals: products.filter((product) => product.tags.includes("top-rated")).slice(0, 3),
    categories: getCategories(),
    sections: homeV3Sections.map((section) => ({
      ...section,
      products: section.productIds.map((id) => findProduct(id)).filter(Boolean),
    })),
  };
};

const sortProducts = (items, sort) => {
  const sorted = [...items];

  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "newest":
      return sorted.sort((a, b) => b.id - a.id);
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted.sort((a, b) => Number(b.tags.includes("featured")) - Number(a.tags.includes("featured")));
  }
};
