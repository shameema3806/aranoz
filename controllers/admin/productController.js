const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { default: mongoose } = require("mongoose");



const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("product-add", {
      cat: category,
    })

  } catch (error) {

    res.redirect("/pagerror")
  }

}

const addProducts = async (req, res) => {
  try {
    console.log(req.files)
    const products = req.body;
    const productExists = await Product.findOne({
      productName: products.productName,

    });

    if (!productExists) {
      const images = [];

      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          images.push(req.files[i].filename);

        }
      }

      const categoryId = await Category.findOne({ name: products.category });

      if (!categoryId) {
        return res.status(400).json("Invalid category name")
      }


      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        category: categoryId._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        createdOn: new Date(),
        quantity: products.quantity,
        size: products.size,
        color: products.color,
        productImage: images,
        status: "Available",

      });

      await newProduct.save();
      return res.status(200).json({ message: "product successfully added", success: true });
    } else {

      return res.status(400).json({ message: "Product already exits,please try with another name", success: false });

    }
  } catch (error) {
    console.error("Error saving product", error);
    return res.status(404).json(error)
  }
}



const getAllProducts = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const query = search
      ? {
        $or: [
          { productName: { $regex: search, $options: "i" } },
        ]
      }
      : {};

    const [productData, count, categories] = await Promise.all([
      Product.find(query)
        .populate("category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(query),

      Category.find({ isListed: true }).lean()
    ]);

    productData.forEach(product => {
      const productOffer = product.offer || 0;
      const categoryOffer = product.category ? (product.category.offer || 0) : 0;
      const effectiveOffer = Math.max(productOffer, categoryOffer);
      product.effectiveOffer = effectiveOffer > 0 ? effectiveOffer : null;
      product.effectiveOfferPrice = effectiveOffer > 0
        ? (product.salePrice * (1 - effectiveOffer / 100)).toFixed(2)
        : null;
    });

    const totalPages = Math.ceil(count / limit);

    res.render("products", {
      products: productData,
      currentPage: page,
      totalPages,
      itemsPerPage: limit,
      searchQuery: search,
      cat: categories,
    });

  } catch (error) {
    console.error("Error in getAllProducts:", error);
    res.redirect("/pagerror");
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { offerPercent } = req.body;

    if (!offerPercent || isNaN(offerPercent) || offerPercent < 0 || offerPercent > 100) {
      return res.status(400).json({ error: "Invalid offer percent" });
    }

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const productDiscountedPrice = product.salePrice - (product.salePrice * offerPercent / 100);

    product.offer = offerPercent;
    product.offerPrice = productDiscountedPrice;
    await product.save();

    const updatedProduct = await Product.findById(id).populate('category');
    const productOffer = updatedProduct.offer || 0;
    const categoryOffer = updatedProduct.category ? (updatedProduct.category.offer || 0) : 0;
    const effectiveOffer = Math.max(productOffer, categoryOffer);
    const effectiveDiscountedPrice = effectiveOffer > 0
      ? (updatedProduct.salePrice * (1 - effectiveOffer / 100)).toFixed(2)
      : null;

    return res.status(200).json({
      message: "Offer applied",
      offerPercent,
      effectiveOffer,
      effectiveDiscountedPrice
    });
  } catch (error) {
    console.error("Error adding offer:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    product.offer = undefined;
    product.offerPrice = undefined;
    await product.save();

    const updatedProduct = await Product.findById(id).populate('category');
    const productOffer = updatedProduct.offer || 0;
    const categoryOffer = updatedProduct.category ? (updatedProduct.category.offer || 0) : 0;
    const effectiveOffer = Math.max(productOffer, categoryOffer);
    const effectiveDiscountedPrice = effectiveOffer > 0
      ? (updatedProduct.salePrice * (1 - effectiveOffer / 100)).toFixed(2)
      : null;

    return res.status(200).json({
      success: true, message: "Offer removed", effectiveOffer,
      effectiveDiscountedPrice
    });
  } catch (error) {
    console.error("Error removing offer:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// BLOCK PRODUCT
const blockProduct = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "ID required" });

    await Product.findByIdAndUpdate(id, { isBlocked: true });

    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(200).json({ success: true, message: "Product blocked" });
    } else {
      return res.redirect('/admin/products');
    }
  } catch (error) {
    console.error("Error blocking product:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// UNBLOCK PRODUCT
const unblockProduct = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "ID required" });

    await Product.findByIdAndUpdate(id, { isBlocked: false });

    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(200).json({ success: true, message: "Product unblocked" });
    } else {
      return res.redirect('/admin/products');
    }
  } catch (error) {
    console.error("Error unblocking product:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id }).populate("category");
    const categories = await Category.find({});

    if (!product) {
      return res.status(404).render('error', { message: 'Product not found' });
    }
    const imagesForFrontend = product.productImage.map(filename => ({
      filename: filename,
      url: `/public/product-images/${filename}`
    }));


    res.render("edit-product", {
      product: product,
      cat: categories,
      existingImagesJSON: JSON.stringify(imagesForFrontend)
    });

  } catch (error) {
    console.error("Edit product error:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

const updateProduct = async (req, res) => {
  try {
    console.log(req.body, "payload for updated product");


    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).send("Invalid product ID");
    }

    const updatedData = {
      productName: req.body.productName,
      description: req.body.description,
      regularPrice: req.body.regularPrice,
      salePrice: req.body.salePrice,
      category: req.body.category,
      color: req.body.color,
      quantity: req.body.quantity
    };


    if (req.files && req.files.length > 0) {
      const imagePaths = req.files.map(file => `/uploads/product-images/${file.filename}`);

      product?.images?.forEach(image => {
        const oldImagePath = path.join(__dirname, "../../uploads", image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      });

      updatedData.images = imagePaths;
    }

    await Product.findByIdAndUpdate(productId, updatedData, { new: true });
    res.status(200).json({ success: true, message: "Product updated!" });

  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });

  }
};

const adminViewProduct = async (req, res) => {
  const id = req.params.id;
  const product = await Product.findById(id).populate("category");
  res.render("productDetails", { product });
}

const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;

    const product = await Product.findById(id);
    if (!product) {
      req.flash("error", "Product not found!");
      return res.redirect("/admin/inventory");
    }

    if (product.productImage && product.productImage.length > 0) {
      product.productImage.forEach(img => {
        const imgPath = path.join(__dirname, "../../public/product-images/", img);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });
    }
    await Product.findByIdAndDelete(id);

    req.flash("success", "Product deleted successfully!");
    res.redirect("/admin/inventory");

  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong!");
    res.redirect("/admin/inventory");
  }
};



module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  updateProduct,
  adminViewProduct,
  deleteProduct
};