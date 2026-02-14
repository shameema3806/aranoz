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

    let cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    const initialItemsCount = cart.items.length;
    cart.items = cart.items.filter(item => {
      const prod = item.productId;
      return prod && !prod.isBlocked; 
    });

    if (cart.items.length < initialItemsCount) {
      await cart.save(); 
    }

    const now = new Date();  
    const cartItems = cart.items.map(item => {
      const prod = item.productId;  
      if (!prod) return null; 

      const productOffer = (prod.offer && (!prod.offerExpiry || prod.offerExpiry > now)) ? prod.offer : 0;
      const categoryOffer = prod.category && prod.category.offer && (!prod.category.offerExpiry || prod.category.offerExpiry > now) 
        ? prod.category.offer : 0;
      const effectiveOffer = Math.max(productOffer, categoryOffer);
      const effectiveOfferPrice = effectiveOffer > 0 ? Math.round(prod.salePrice * (1 - effectiveOffer / 100)) : null;

      const currentPrice = effectiveOfferPrice || (item.price || prod.salePrice);
    //   const currentTotal = currentPrice * item.quantity;

    //   const mappedItem = {
    //     _id: prod._id?.toString() || '',
    //     ...(prod._doc || {}),  
    //     price: currentPrice,  
    //     quantity: item.quantity || 1,
    //     total: currentTotal, 
    //     stock: prod.quantity || 100,
    //     effectiveOffer: effectiveOffer > 0 ? effectiveOffer : null,
    //     effectiveOfferPrice: effectiveOfferPrice,
    //   };
    //   return mappedItem;
    // }).filter(Boolean);  
    return {
        _id: prod._id.toString(),
        productName: prod.productName,
        productImage: prod.productImage,
        salePrice: prod.salePrice,
        price: currentPrice,  
        quantity: item.quantity,
        total: currentPrice * item.quantity,
        stock: prod.quantity, // Actual stock
        isListed: prod.isListed, // Pass this to UI if you want to show a "No longer listed" badge
        hasStock: prod.quantity >= item.quantity, // Validation for checkout
        effectiveOffer: effectiveOffer > 0 ? effectiveOffer : null,
      };
    }).filter(Boolean);

    const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);

    const canCheckout = cartItems.every(item => item.hasStock);
     
    res.render('cart', {
      user: req.user,
      cartItems,
      subtotal,
      canCheckout
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

    const product = await Product.findById(productId).populate('category');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.isBlocked) {
    return res.status(400).json({ success: false, message: 'This product is currently unavailable (blocked by admin)' });
    }

    const now = new Date();
    const productOffer = (product.offer && (!product.offerExpiry || product.offerExpiry > now)) ? product.offer : 0;
    const categoryOffer = product.category && product.category.offer && (!product.category.offerExpiry || product.category.offerExpiry > now) 
      ? product.category.offer : 0;
    const effectiveOffer = Math.max(productOffer, categoryOffer);
    const effectiveOfferPrice = effectiveOffer > 0 ? Math.round(product.salePrice * (1 - effectiveOffer / 100)) : null;

    const cartPrice = effectiveOfferPrice || product.salePrice;

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

      if (newTotalQty > 5) {  
        return res.status(400).json({ success: false, message: `Cannot add. Maximum 5 items per product allowed (current: ${existingItem.quantity})` });
      }
      if (newTotalQty > product.quantity) { 
        return res.status(400).json({ success: false, message: `Cannot add. Total would exceed stock (${product.quantity} available)` });
      }
      existingItem.quantity = newTotalQty;
      existingItem.price = cartPrice;
      existingItem.totalPrice = existingItem.quantity * cartPrice;
      existingItem.effectiveOffer = effectiveOffer > 0 ? effectiveOffer : null;
      existingItem.effectiveOfferPrice = effectiveOfferPrice;

      console.log(`Updated existing item qty to ${existingItem.quantity} for product ${stringProductId}`);
    } else {
      cart.items.push({
        productId,
        quantity: qty,
        price: cartPrice,
        totalPrice: qty * cartPrice,
        effectiveOffer: effectiveOffer > 0 ? effectiveOffer : null,
        effectiveOfferPrice: effectiveOfferPrice,
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
      console.error("Error removing from wishlist:", wishlistError);  
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
    
    console.log('updateCart', quantity);
    
    if (!productId || quantity === undefined) {
      console.log("Validation failed in updateCart: Missing fields", req.body);
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ success: false, message: 'Missing productId or quantity' });
      }
      res.redirect('/cart');
      return;
    }

    const product = await Product.findById(productId).populate('category');
    if (!product) {
      console.log(' Product not found:', productId);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    //  Blocked products are removed immediately. 
    // Unlisted products
    if (product.isBlocked) {
      const cart = await Cart.findOne({ userId });
      if (cart) {
        const stringProductId = productId.toString();
        cart.items = cart.items.filter(i => i.productId.toString() !== stringProductId); 
        await cart.save();
        console.log(`Blocked item removed from cart for user: ${userId}, product: ${stringProductId}`);
      }
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ 
          success: false, 
          message: 'This product is currently unavailable (blocked by admin). Item removed from cart.',
          subtotal: cart ? cart.items.reduce((sum, i) => sum + i.totalPrice, 0) : 0
        });
      }
      res.redirect('/cart');
      return;
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });
    if (!cart) {
      console.log("No cart found in updateCart");
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
      res.redirect("/cart");
      return;
    }

    const stringProductId = productId.toString();
    const item = cart.items.find(item => item.productId._id.toString() === stringProductId);
    
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
      cart.items = cart.items.filter(i => i.productId._id.toString() !== stringProductId);
      await cart.save();
      console.log(" Item removed from cart via update for user:", userId);
      const now = new Date();
      const remainingItems = cart.items.map(cartItem => {
        const prod = cartItem.productId;
        if (!prod) return null;
        if (typeof prod.salePrice !== 'number' || isNaN(prod.salePrice)) {
          const currentPrice = cartItem.price || 0;
          return { total: currentPrice * cartItem.quantity };
        }
        const productOffer = (prod.offer && (!prod.offerExpiry || prod.offerExpiry > now)) ? prod.offer : 0;
        const categoryOffer = prod.category && prod.category.offer && (!prod.category.offerExpiry || prod.category.offerExpiry > now) 
          ? prod.category.offer : 0;
        const effectiveOffer = Math.max(productOffer, categoryOffer);
        const effectiveOfferPrice = effectiveOffer > 0 ? Math.round(prod.salePrice * (1 - effectiveOffer / 100)) : null;
        const currentPrice = effectiveOfferPrice || (cartItem.price || prod.salePrice);
        return { total: currentPrice * cartItem.quantity };
      }).filter(Boolean);
      const updatedSubtotal = remainingItems.reduce((sum, i) => sum + i.total, 0);
      
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({ 
          success: true, 
          message: 'Item removed',
          subtotal: updatedSubtotal
        });
      }
      res.redirect('/cart');
      return;
    }

    if (newQty > 5) {  
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

    // STOCK VALIDATION: This ensures that even unlisted products cannot exceed available inventory
    if (newQty > product.quantity) {  
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
    await cart.save();
    
    console.log(`Cart updated`);
    
    const updatedCart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });
    let updatedSubtotal = 0;
    let updatedItem = null;
    if (updatedCart) {
      const now = new Date();
      const fullCartItems = updatedCart.items.map((cartItem, index) => {
        try {  
          const prod = cartItem.productId;
          if (!prod) return null;
          if (typeof prod.salePrice !== 'number' || isNaN(prod.salePrice)) {
            const currentPrice = cartItem.price || 0;
            const currentTotal = currentPrice * cartItem.quantity;
            return {
              _id: cartItem.productId?._id?.toString() || stringProductId, 
              totalPrice: currentTotal
            };
          }
          const productOffer = (prod.offer && (!prod.offerExpiry || prod.offerExpiry > now)) ? prod.offer : 0;
          const categoryOffer = prod.category && prod.category.offer && (!prod.category.offerExpiry || prod.category.offerExpiry > now) 
            ? prod.category.offer : 0;
          const effectiveOffer = Math.max(productOffer, categoryOffer);
          const effectiveOfferPrice = effectiveOffer > 0 ? Math.round(prod.salePrice * (1 - effectiveOffer / 100)) : null;
          const currentPrice = effectiveOfferPrice || (cartItem.price || prod.salePrice);
          const currentTotal = currentPrice * cartItem.quantity;
          return {
            _id: prod?._id?.toString() || stringProductId,  
            totalPrice: currentTotal,
          };
        } catch (mapError) {
          console.error(`Map error for item ${index}:`, mapError);  
          return {
            _id: cartItem.productId?._id?.toString() || stringProductId,
            totalPrice: (cartItem.totalPrice || 0)
          };
        }
      }).filter(Boolean);
      
      updatedSubtotal = fullCartItems.reduce((sum, i) => sum + i.totalPrice, 0);
      updatedItem = fullCartItems.find(i => i._id === stringProductId);
    } else {
      updatedSubtotal = 0;
    }
    
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ 
        success: true, 
        updatedItem: { totalPrice: updatedItem?.totalPrice || 0 },
        subtotal: updatedSubtotal
      });
    }
    
    res.redirect('/cart');
  } catch (error) {
    console.log("Error in updateCart:", error); 
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ success: false, message: 'Server error: ' + error.message }); 
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