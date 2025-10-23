const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");


const productDetail = async (req, res) => {
  try {
    const productId = req.query.id;

    const product = await Product.findById(productId).lean();
    if (!product || product.isBlocked) return res.redirect('/shop');

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isBlocked: false,
      quantity: { $gt: 0 }
    })
    .limit(4)
    .sort({ productName: 1 }) // sort A→Z
    .lean();

    res.render('product-details', { product, relatedProducts });
  } catch (error) {
    console.log(error);
    res.redirect('/shop');
  }
};

module.exports = {
   productDetail
   };

// const productDetail = async (req, res) => {
//   try {
//     const productId = req.query.id;

//     // Fetch product and ensure it's not blocked
//     const product = await Product.findById(productId).lean();
//     if (!product || product.isBlocked) {
//       return res.redirect('/shop'); // redirect if blocked/unavailable
//     }

//     // Fetch related products (same category, not blocked, not the same product)
//     const relatedProducts = await Product.find({
//       category: product.category,
//       _id: { $ne: product._id },
//       isBlocked: false,
//       quantity: { $gt: 0 }
//     })
//       .limit(4)
//       .lean();

//     res.render('product-details', { product, relatedProducts });
//   } catch (error) {
//     console.log(error);
//     res.redirect('/shop'); // fallback
//   }
// };

// module.exports = {
//   productDetail
// };
