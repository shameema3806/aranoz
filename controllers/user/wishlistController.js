const Wishlist = require('../../models/wishlistSchema');
const Cart = require('../../models/cartSchema');
const Product = require("../../models/productSchema");




// Get user's wishlist
const getWishlist = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;
    if (!userId) return res.redirect('/login');

    let wishlist = await Wishlist.findOne({ userId }).populate('products.productId');
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
      await wishlist.save();
    }

    const wishlistItems = wishlist.products.map(item => ({
      ...item.productId._doc,
      addedOn: item.addedOn,
      _id: item.productId._id  // For template data-product-id
    }));

    res.render('wishlist', {  // Assuming views/user/wishlist.ejs
      user: req.user,
      wishlistItems
    });
  } catch (error) {
    console.error("Error in getWishlist:", error);
    res.redirect('/pageNotFound');
  }
};

// Add product to wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login required' });

    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID required' });

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) wishlist = new Wishlist({ userId });

    // Check if already in wishlist
    const existing = wishlist.products.find(p => p.productId.toString() === productId);
    if (!existing) {
      wishlist.products.push({ productId });
      await wishlist.save();
      return res.json({ success: true, message: 'Added to wishlist' });
    }
    res.json({ success: false, message: 'Already in wishlist' });
  } catch (error) {
    console.error("Error in addToWishlist:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Remove from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID required' });

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) return res.json({ success: true, message: 'Nothing to remove' });

    wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
    await wishlist.save();

    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, message: 'Removed from wishlist' });
    }
    res.redirect('/wishlist');
  } catch (error) {
    console.error("Error in removeFromWishlist:", error);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.redirect('/pageNotFound');
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist
};