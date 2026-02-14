
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require('../../models/cartSchema');
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { render } = require("ejs");
const { processReferralOnRegister } = require('../user/refferralController');
const crypto = require("crypto");
const Coupon = require("../../models/couponSchema");



const loadShopping = async (req, res) => {
  try {

    const categories = await Category.find({ isListed: true }).lean();

    let selectedCategory = null;
    if (req.query.category) {
      const category = await Category.findById(req.query.category).lean();
      if (!category || !category.isListed) {
        return res.redirect('/shop');
      }
      selectedCategory = req.query.category;
    }

    const filter = {
      isBlocked: false,
      quantity: { $gt: 0 },
      category: { $in: categories.map(cat => cat._id) },
    };

    if (selectedCategory) {
      filter.category = selectedCategory;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.priceRange) {
      switch (req.query.priceRange) {
        case 'under5000':
          filter.salePrice = { $lt: 5000 };
          break;
        case '5000to10000':
          filter.salePrice = { $gte: 5000, $lte: 10000 };
          break;
        case 'above10000':
          filter.salePrice = { $gt: 10000 };
          break;
        case "above20000":
          filter.salePrice = { $gt: 20000 };
      }
    }

    if (req.query.search && req.query.search.trim()) {
      filter.productName = {
        $regex: req.query.search.trim(),
        $options: 'i',
      };
    }


    let sort = { createdAt: -1 };
    switch (req.query.sort) {
      case 'priceLow':
        sort = { salePrice: 1 };
        break;
      case 'priceHigh':
        sort = { salePrice: -1 };
        break;
      case 'az':
        sort = { productName: 1 };
        break;
      case 'za':
        sort = { productName: -1 };
        break;
      case 'new':
        sort = { createdAt: -1 };
        break;
    }


    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('category')
      .collation({ locale: 'en', strength: 2 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();


    const processedProducts = products.map(product => {
      const now = new Date();  // NEW: Current date for expiry checks
      const productOffer = (product.offer && (!product.offerExpiry || product.offerExpiry > now)) ? product.offer : 0;  // NEW: Product-level offer with expiry
      const categoryOffer = product.category && product.category.offer && (!product.category.offerExpiry || product.category.offerExpiry > now)
        ? product.category.offer
        : 0;  // NEW: Category-level offer with expiry (requires populate)
      const effectiveOffer = Math.max(productOffer, categoryOffer);  // NEW: Max of both
      const effectiveOfferPrice = effectiveOffer > 0
        ? Math.round(product.salePrice * (1 - effectiveOffer / 100))  // NEW: Computed price if offer valid
        : null;

      product.effectiveOffer = effectiveOffer > 0 ? effectiveOffer : null;  // NEW: Set only if >0
      product.effectiveOfferPrice = effectiveOfferPrice;  // NEW: Attach computed price

      return product;
    });
    const totalPages = Math.ceil(totalProducts / limit);

    const buildUrl = (newParams = {}) => {
      const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
      for (const [k, v] of url.searchParams.entries()) {
        if (!newParams[k]) newParams[k] = v;
      }
      Object.entries(newParams).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
        else url.searchParams.delete(k);
      });
      return url.pathname + url.search;
    };

    let cartCount = 0;
    if (req.user) {
      const cart = await Cart.findOne({ userId: req.user._id });
      cartCount = cart ? cart.items.length : 0;
    }

    res.render('shop', {
      categories,
      products: processedProducts,
      // selectedCategory: req.query.category || null,
      selectedCategory,
      selectedPriceRange: req.query.priceRange || null,
      searchQuery: req.query.search || '',
      sort: req.query.sort || '',
      user: req.session.user ? await User.findById(req.session.user).lean() : null,
      page,
      totalPages,
      totalProducts,
      buildUrl,
      cartCount
    });
  } catch (error) {
    console.error('loadShopping error:', error);
    res.status(500).send('Server Error');
  }
};


const pageNotFound = async (req, res) => {
  try {
    res.status(404).render("page-404");
  } catch (error) {
    console.log("Error rendering 404 page:", error);
    res.status(500).send("Internal Server Error");
  }
};


module.exports = {
  loadShopping,
};