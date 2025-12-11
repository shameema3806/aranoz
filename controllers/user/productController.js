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


    const product = await Product.findById(productId).lean();
    if (!product || product.isBlocked) return res.redirect('/shop');

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
