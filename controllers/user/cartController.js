

const Cart = require('../../models/cartSchema');
const Product = require("../../models/productSchema");
const Wishlist = require('../../models/wishlistSchema');

const getCart = async (req, res) => {
  console.log("REQ USER:", req.user);
  console.log("REQ SESSION:", req.session);
  try {
    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      console.log("No user found in getCart - redirecting to login");
      return res.redirect("/login");
    }

    let cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    const cartItems = cart.items.map(item => {
      const prodId = item.productId?._id || item.productId;
      return {
        _id: prodId?.toString() || '',
        ...(item.productId?._doc || {}),
        price: item.price || 0,
        quantity: item.quantity || 1,
        total: item.totalPrice || 0,
        stock: item.productId?.quantity || 100 ,
      };
    });

    const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);

    res.render('cart', {
      user: req.user,
      cartItems,
      subtotal
    });
  } catch (error) {
    console.log("Error in getCart:", error);
    res.redirect("/pageNotFound");
  }
};



const addToCart = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;
    if (!userId) return res.status(401).json({ message: 'Login required' });

    const { productId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ message: 'Product ID is required' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const qty = parseInt(quantity);
    if (qty <= 0 || qty > 5) {  
      return res.status(400).json({ success: false, message: `Maximum 5 items per product allowed. Requested: ${qty}` });
    }
    if (qty > product.quantity) {  
      return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${product.quantity}` });
    }
    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId });

    const stringProductId = productId.toString();
    const existingItem = cart.items.find(item => item.productId.toString() === stringProductId);

    if (existingItem) {
      const newTotalQty = existingItem.quantity + qty;
      if (newTotalQty > 5) {  // NEW: Enforce total max 5
        return res.status(400).json({ success: false, message: `Cannot add. Maximum 5 items per product allowed (current: ${existingItem.quantity})` });
      }
      if (newTotalQty > product.quantity) {  // CHANGED: Use product.quantity
        return res.status(400).json({ success: false, message: `Cannot add. Total would exceed stock (${product.quantity} available)` });
      }
      existingItem.quantity = newTotalQty;
      existingItem.totalPrice = existingItem.quantity * product.salePrice;
      existingItem.price = product.salePrice;
      console.log(`Updated existing item qty to ${existingItem.quantity} for product ${stringProductId}`);
    } else {
      cart.items.push({
        productId,
        quantity: qty,
        price: product.salePrice,
        totalPrice: qty * product.salePrice,
      });
      console.log(`Added new item qty ${qty} for product ${stringProductId}`);
    }

    await cart.save();

    try {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist && wishlist.products.length > 0) {
        const initialLength = wishlist.products.length;
        wishlist.products = wishlist.products.filter(p => p.productId.toString() !== stringProductId);
        if (wishlist.products.length < initialLength) {
          await wishlist.save();
          console.log(`Removed product ${stringProductId} from wishlist after adding to cart`);
        }
      }
    } catch (wishlistError) {
      console.error("Error removing from wishlist:", wishlistError);  // Log but don't fail cart add
    }

    res.json({ success: true, message: 'Added to cart' });
  } catch (error) {
    console.error("Error in addToCart:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCart = async (req, res) => {
  try {
    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      console.log("No user found in updateCart");
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      return res.redirect("/login");
    }

    const { productId, quantity } = req.body;
    
    console.log(' updateCart', quantity);
    
    if (!productId || quantity === undefined) {
      console.log("Validation failed in updateCart: Missing fields", req.body);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ success: false, message: 'Missing productId or quantity' });
      }
      res.redirect('/cart');
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      console.log(' Product not found:', productId);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      console.log("No cart found in updateCart");
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
      res.redirect("/cart");
      return;
    }

    const stringProductId = productId.toString();
    const item = cart.items.find(item => item.productId.toString() === stringProductId);
    
    if (!item) {
      console.log(" Item not found in cart for productId:", stringProductId);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }
      res.redirect('/cart');
      return;
    }

    const newQty = parseInt(quantity);
    
    if (newQty <= 0) {
      cart.items = cart.items.filter(i => i.productId.toString() !== stringProductId);
      await cart.save();
      console.log(" Item removed from cart via update for user:", userId);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({ 
          success: true, 
          message: 'Item removed',
          subtotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0)
        });
      }
      res.redirect('/cart');
      return;
    }

 if (newQty > 5) {  // NEW: Max 5 per product policy
      console.log(`Max quantity exceeded: Requested ${newQty}`);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ 
          success: false, 
          message: `Maximum 5 items per product allowed` 
        });
      }
      res.redirect('/cart');
      return;
    }

    if (newQty > product.quantity) {  // CHANGED: Use product.quantity for stock
      console.log(`Stock exceeded: Requested ${newQty}, Available ${product.quantity}`);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot update. Stock available: ${product.quantity}` 
        });
      }
      res.redirect('/cart');
      return;
    }

    item.quantity = newQty;
    item.totalPrice = item.quantity * item.price;
    await cart.save();
    
    console.log(`Cart updated`);
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ 
        success: true, 
        updatedItem: { totalPrice: item.totalPrice },
        subtotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0)
      });
    }
    res.redirect('/cart');
  } catch (error) {
    console.log("Error in updateCart:", error);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.redirect("/pageNotFound");
  }
};

const removeFromCart = async (req, res) => {
  try {
    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      console.log("No user found in removeFromCart");
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      return res.redirect("/login");
    }

    const { productId } = req.body;
    if (!productId) {
      console.log("Validation failed in removeFromCart: Missing productId", req.body);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ success: false, message: 'Missing productId' });
      }
      res.redirect('/cart');
      return;
    }

    const stringProductId = productId.toString();
    const cart = await Cart.findOne({ userId });
    
    if (!cart) {
      console.log("No cart found in removeFromCart");
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
      res.redirect("/cart");
      return;
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item.productId.toString() !== stringProductId);
    
    if (cart.items.length < initialLength) {
      await cart.save();
      console.log("Item removed - User:", userId, "Product:", stringProductId);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({ 
          success: true, 
          message: 'Item removed successfully',
          subtotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0)
        });
      }
      res.redirect('/cart');
    } else {
      console.log("Item not found in cart for productId:", stringProductId);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }
      res.redirect('/cart');
    }
  } catch (error) {
    console.log("Error in removeFromCart:", error);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCart,
  removeFromCart
};