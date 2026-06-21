# TechMart Backend

Electro-style products API for the TechMart portfolio project.

## Run

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default.

## Routes

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:idOrSlug`
- `GET /api/products/featured`
- `GET /api/categories`
- `GET /api/brands`
- `GET /api/home-v3`

## Product Query Examples

```bash
GET /api/products?search=smartphone
GET /api/products?category=Headphones
GET /api/products?brand=EliteBook
GET /api/products?onSale=true
GET /api/products?minPrice=100&maxPrice=800
GET /api/products?sort=price-asc&page=1&limit=8
```

Supported sort values:

- `featured`
- `price-asc`
- `price-desc`
- `rating`
- `newest`
- `name`
