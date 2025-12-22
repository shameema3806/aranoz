const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");


const productDetail = async (req, res) => {
  try {
      const userId = req.session.user; 
      const productId = req.query.id;

    if (!productId) {
      return res.redirect('/shop');
    }

    const product = await Product.findById(productId).populate('category').lean();
    if (!product || product.isBlocked) return res.redirect('/shop');

    // const now = new Date();  //  expiry if needed
    const productOffer = (product.offer && (!product.offerExpiry || product.offerExpiry > now)) ? product.offer : 0;
    const categoryOffer = product.category && product.category.offer && (!product.category.offerExpiry || product.category.offerExpiry > now) 
      ? product.category.offer 
      : 0;
    const effectiveOffer = Math.max(productOffer, categoryOffer);
    const effectiveOfferPrice = effectiveOffer > 0 
      ? (product.salePrice * (1 - effectiveOffer / 100)).toFixed(2) 
      : null;

    product.effectiveOffer = effectiveOffer > 0 ? effectiveOffer : null;
    product.effectiveOfferPrice = effectiveOfferPrice;

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isBlocked: false,
      quantity: { $gt: 0 }
    })
    .limit(4)
    .sort({ productName: 1 }) 
    .lean();

    let user = null;
    if (userId) {
      user = await User.findById(userId).lean();
    }

    res.render('product-details', { product, relatedProducts, user: user });
  } catch (error) {
    console.log(error);
    res.redirect('/shop');
  }
};


module.exports = {
   productDetail
   };
