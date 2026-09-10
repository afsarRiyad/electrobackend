import { Cart, Compare, Product, ProductVariant, Wishlist } from "./models.js";

// Transfers a guest session's cart, wishlist, and compare list into the given
// user account. Called on signup/login (and via POST /api/auth/merge-guest-data
// for OAuth flows). Guest records are removed once merged, so repeat calls are
// no-ops. Failures in one part never abort the others.
export const mergeGuestData = async (userId, guestId) => {
  if (!userId || !guestId) {
    return { merged: false, reason: "userId and guestId are required" };
  }

  const results = { cart: null, wishlist: 0, compare: 0 };

  // ── Cart ───────────────────────────────────────────────────────────────────
  const guestCart = await Cart.findOne({ guestId });
  if (guestCart) {
    let userCart = await Cart.findOne({ user: userId });

    if (!userCart) {
      // Adopt the guest cart wholesale when the user has no cart yet.
      guestCart.user = userId;
      guestCart.guestId = null;
      await guestCart.save();
      results.cart = "adopted";
    } else {
      // Merge items into the existing cart, combining matching product+variant.
      for (const guestItem of guestCart.items) {
        const existing = userCart.items.find(
          (item) =>
            item.product.toString() === guestItem.product.toString() &&
            (item.variant?.toString() ?? null) ===
              (guestItem.variant?.toString() ?? null)
        );

        if (existing) {
          existing.quantity += guestItem.quantity;
        } else {
          userCart.items.push({
            product: guestItem.product,
            quantity: guestItem.quantity,
            variant: guestItem.variant ?? null,
          });
        }
      }

      // Clamp quantities to available stock and drop items whose product or
      // variant no longer exists or is out of stock.
      const productIds = userCart.items.map((item) => item.product);
      const variantIds = userCart.items
        .map((item) => item.variant)
        .filter(Boolean);
      const [products, variants] = await Promise.all([
        Product.find({ _id: { $in: productIds } }).select("stock").lean(),
        ProductVariant.find({ _id: { $in: variantIds } })
          .select("stock")
          .lean(),
      ]);
      const productStock = new Map(
        products.map((p) => [p._id.toString(), p.stock])
      );
      const variantStock = new Map(
        variants.map((v) => [v._id.toString(), v.stock])
      );

      userCart.items = userCart.items.filter((item) => {
        const stock = item.variant
          ? variantStock.get(item.variant.toString())
          : productStock.get(item.product.toString());

        if (stock === undefined || stock <= 0) return false;
        item.quantity = Math.min(item.quantity, stock);
        return true;
      });

      await userCart.save();
      await Cart.deleteOne({ _id: guestCart._id });
      results.cart = "merged";
    }
  }

  // ── Wishlist ───────────────────────────────────────────────────────────────
  const guestWishlist = await Wishlist.find({ guestId })
    .select("product")
    .lean();
  if (guestWishlist.length > 0) {
    // Upsert into the user's wishlist; existing entries are left untouched.
    await Wishlist.bulkWrite(
      guestWishlist.map(({ product }) => ({
        updateOne: {
          filter: { user: userId, product },
          update: { $setOnInsert: { user: userId, product } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    await Wishlist.deleteMany({ guestId });
    results.wishlist = guestWishlist.length;
  }

  // ── Compare ────────────────────────────────────────────────────────────────
  const guestCompare = await Compare.find({ guestId })
    .select("product")
    .lean();
  if (guestCompare.length > 0) {
    await Compare.bulkWrite(
      guestCompare.map(({ product }) => ({
        updateOne: {
          filter: { user: userId, product },
          update: { $setOnInsert: { user: userId, product } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    await Compare.deleteMany({ guestId });
    results.compare = guestCompare.length;
  }

  return { merged: true, results };
};