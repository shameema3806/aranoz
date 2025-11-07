const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
// const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { default: mongoose } = require("mongoose");



const getProductAddPage = async (req,res)=>{
    try {
        const category = await Category.find({isListed:true});
        // const brand = await Brand.find({isBlocked:false});
        res.render("product-add",{
            cat:category,
            // brand:brand
        })
        
    } catch (error) {
        
        res.redirect("/pagerror")
    }

} 

const addProducts = async (req,res)=>{
    try {
        console.log(req.files)
        const products = req.body;
        const productExists = await Product.findOne({
            productName:products.productName,

        });

        if(!productExists){
            const images = [];

            if(req.files && req.files.length>0){
                for(let i=0;i<req.files.length;i++){
                    // const originalImagePath = req.files[i].path;

                    // const resizedImagePath = path.join("uploads","product-images",req.files[i].filename);
                    // await sharp(originalImagePath).resize({width:440,height:440}).toFile(resizedImagePath);
                    images.push(req.files[i].filename);

                }
            }
           
    const categoryId = await Category.findOne({name:products.category} );

            if(!categoryId) {
                return res.status(400).json("Invalid category name")
            }

   const newProduct = new Product({
                productName:products.productName,
                description:products.description,
                // brand:products.brand,
                category:categoryId._id,
                regularPrice:products.regularPrice,
                salePrice:products.salePrice,
                createdOn:new Date(),
                quantity:products.quantity,
                size:products.size,
                color:products.color,
                productImage:images,
                status:"Available",

            });
            
            await newProduct.save();
            return res.status(200).json({message:"product successfully added",success:true});
            console.log(req.body);
             }else{
              
                return res.status(400).json({message:"Product already exits,please try with another name",success:false });

             }
    } catch (error) {
       console.error("Error saving product",error);
       return res.status(404).json(error) 
    }
  }

    // const productListing = async (req, res) => {
    // try {
    //     const products = await Product.find()
    //         .populate('category')
    //         .sort({ createdOn: -1 }); // optional: show latest first

    //     res.render("productlisting", { products }); // Make sure this view exists
    //     } catch (error) {
    //     console.error("Error fetching product list:", error);
    //     res.status(500).redirect("/admin/pagerror");
    //     }
    //    };





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
            // { brand: { $regex: search, $options: "i" } }
            ] }
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


//   const getAllProducts = async (req, res) => {
//     try {
//         const search = req.query.search || "";
//         const page = parseInt(req.query.page) || 1;
//         const limit = 4;

//         const query = {
//             $or: [
//                 { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }
//                 // { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
//             ]
//         };

//         const [productData, count, category] = await Promise.all([
//             Product.find(query)
//                 .limit(limit)
//                 .skip((page - 1) * limit)
//                 .populate("category")
//                 .exec(),
//             Product.countDocuments(query),
//             Category.find({ isListed: true })
//         ]);

//         if (category) {
//             res.render("products", {
//                 products: productData,
//                 currentPage: page,
//                 totalPages: Math.ceil(count / limit),
//                 cat: category,
//                 // brand: brand
//             });
//         } else {
//             res.render("page-404");
//         }

//     } catch (error) {
//         console.error("Error in getAllProducts:", error);
//         res.redirect("/pagerror"); 
//        }
//      };
 
    //  const addProductOffer = async(req,res)=>{
    //     try {
    //         const {productId,percentage} = req.body;
    //         const findProduct = await Product.findOne({_id:productId});
    //         const findCategory = await Category.findOne({_id:findProduct.category});
    //         if(findCategory.categoryOffer>percentage){
    //             return res.json({status:false,message:"This products category already has a category offer"})
    //         }
           
    //         findProduct.salePrice = findProduct.salePrice-Math.floor(findProduct.regularPrice*(percentage/100) );
    //         findProduct.productOffer = parseInt(percentage);
    //         await findProduct.save();
    //         findCategory.categoryOffer=0;
    //         await findCategory.save();
    //         res.json({status:true});


    //     } catch (error) {
    //         res.redirect("/pagerror");
    //         res.status(500).json({ status:false, message:"Internal Server Error"});
    //     }
    //  }

    //  const removeProductOffer = async (req,res)=>{
    //     try {
    //         const {productId} = req.body
    //         const findProduct = await Product.findOne({_id:productId});
    //         const percentage = findProduct.productOffer;
    //         findProduct.salePrice = findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100));
    //         findProduct.productOffer = 0;
    //         await findProduct.save();
    //         res.json({status:true})

    //     } catch (error) {
    //       res.redirect("/pagerror")
    //     }
    //  }








//     // Add offer to product
// const addProductOffer = async (req, res) => {
//   try {
//     const { id } = req.params;
//     // You can choose how to calculate offer, here we just assign 10% offer for example
//     await Product.findByIdAndUpdate(id, {
//       offer: 10, // or hasOffer: true
//     });
//     res.redirect("/admin/products");
//   } catch (error) {
//     console.error("Error adding offer:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };

// // Remove offer from product
// const removeProductOffer = async (req, res) => {
//   try {
//     const { id } = req.params;
//     await Product.findByIdAndUpdate(id, {
//       offer: null, // or hasOffer: false
//     });
//     res.redirect("/admin/products");
//   } catch (error) {
//     console.error("Error removing offer:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };








     // Add offer to product
//   const addProductOffer = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { offerPrice } = req.body;

//     if (!offerPrice || isNaN(offerPrice)) {
//       return res.status(400).send("Invalid offer price");
//     }

//     const product = await Product.findById(id);

//     if (!product) return res.status(404).send("Product not found");

//     // Optional: Validate that offerPrice is less than original price
//     if (offerPrice >= product.salePrice) {
//       return res.status(400).send("Offer price must be less than sale price");
//     }

//     await Product.findByIdAndUpdate(id, {
//       offerPrice: offerPrice,
//       offer: Math.round(((product.salePrice - offerPrice) / product.salePrice) * 100), // % discount
//     });

//     res.status(200).send("Offer added");
//   } catch (error) {
//     console.error("Error adding offer:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };


// const removeProductOffer = async (req, res) => {
//   try {
//     const { id } = req.params;
//     await Product.findByIdAndUpdate(id, {
//       offerPrice: null,
//       offer: null,
//     });
//     res.status(200).send("Offer removed");
//   } catch (error) {
//     console.error("Error removing offer:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };




//      const blockProduct = async (req,res) =>{
//         try {
//             let id = req.query.id;
//             await Product.updateOne({_id:id},{$set:{isBlocked:true}});
//             res.redirect("/admin/products");

//         } catch (error) {
//             res.redirect("/pagerror")
            
//         }
//      }
//      const unblockProduct = async(req,res)=>{
//         try {
//             let id = req.query.id;
//             await Product.updateOne({_id:id},{$set:{isBlocked:false}});
//             res.redirect("/admin/products");

//         } catch (error) {
//             res.redirect("/pagerror")
//         }
//      }

// ==== ADD OFFER – returns JSON ====
// ==== ADD PRODUCT OFFER ====
const addProductOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { offerPercent } = req.body;

    if (!offerPercent || isNaN(offerPercent) || offerPercent < 0 || offerPercent > 100) {
      return res.status(400).json({ error: "Invalid offer percent" });
    }

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Calculate discounted price
    const discountedPrice = product.salePrice - (product.salePrice * offerPercent / 100);

    product.offer = offerPercent;
    product.offerPrice = discountedPrice;
    await product.save();

    return res.status(200).json({
      message: "Offer applied",
      offerPercent,
      discountedPrice
    });
  } catch (error) {
    console.error("Error adding offer:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ==== REMOVE PRODUCT OFFER ====
const removeProductOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    product.offer = undefined;
    product.offerPrice = undefined;
    await product.save();

    return res.status(200).json({ success: true, message: "Offer removed" });
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

    // If AJAX request → return JSON, else redirect back
    if (req.xhr) {
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

    if (req.xhr) {
      return res.status(200).json({ success: true, message: "Product unblocked" });
    } else {
      return res.redirect('/admin/products');
    }
  } catch (error) {
    console.error("Error unblocking product:", error);
    return res.status(500).json({ error: "Server error" });
  }
};


      // const getEditProduct = async(req,res)=>{
      //   try {
      //       const id= req.query.id;
      //       const product = await Product.findOne({_id:id});
      //       const category = await Category.find({});
      //       // const brand = await Brand.find()
      //       res.render("edit-product",{
      //           product:product,
      //           cat:category,
      //           existingImagesJSON: JSON.stringify(imagesForFrontend)
      //           // brand:brand,
      //       });
      //   } catch (error) {
      //   console.error("Edit product error:", error);

      //   // Only send JSON — do NOT redirect
      //   res.status(500).json({
      //       status: false,
      //       message: "Internal Server Error"
      //   });
      //  }
      // }

      const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id }).populate("category");
        const categories = await Category.find({}); // renamed for clarity

        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Correctly map productImage array (array of strings: filenames)
        // const imagesForFrontend = product.productImage.map(filename => ({
        //     filename: filename,
        //     url: `/uploads/product-images/${filename}` // Match your static folder
        // }));
        const imagesForFrontend = product.productImage.map(filename => ({
    filename: filename,
    url: `/public/product-images/${filename}` // use /public/ prefix
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
           console.log(req.body,"payload for updated product");


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


        // Handle uploaded images (if any)
        if (req.files && req.files.length > 0) {
            const imagePaths = req.files.map(file => `/uploads/product-images/${file.filename}`);
            
            // Optional: Delete old images if needed
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

};