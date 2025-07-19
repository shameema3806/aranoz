const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
// const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");



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
                    const originalImagePath = req.files[i].path;

                    const resizedImagePath = path.join("public","uploads","product-images",req.files[i].filename);
                    await sharp(originalImagePath).resize({width:440,height:440}).toFile(resizedImagePath);
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

    const productListing = async (req, res) => {
    try {
        const products = await Product.find()
            .populate('category')
            .sort({ createdOn: -1 }); // optional: show latest first

        res.render("productlisting", { products }); // Make sure this view exists
    } catch (error) {
        console.error("Error fetching product list:", error);
        res.status(500).redirect("/admin/pagerror");
    }
};

// const getAllProducts = async(req,res)=>{
//     try {
//         const search = req.query.search || "";
//         const page = req.query.page || 1;
//         const limit = 4;

//         const productData = await Product.find({
//             $or:[
//                 {productName:{$regex:new RegExp(".*" + search +".*","i")}},
//                 // {brand:{$regex:new RegExp(".*" + search+".*","i")}}
//             ],
//         })
//         .limit(limit*1)
//         .skip((page-1)*limit)
//         .populate("category")
//         .exec();

//         const count = await Product.find({
//             $or:[
//                 {productName:{$regex:new RegExp(".*" + search +".*","i")}},
//                   // {brand:{$regex:new RegExp(".*" + search+".*","i")}}

//             ], 

//         }).countDocuments();

//         const category = await Category.find({isListed:true});
//         // const brand = await Brand.find({isBlocked:false});

//         // if(category && brand){
//         if(category){
//             res.render("products",{
//                 data:productData,
//                 currentPage:page,
//                 totalPages:Math.ceil(count/limit),
//                 cat:category,
//                 // brand:brand,
            
//             })
//         }else{
//             res.render("page-404");
//         }

//     } catch (error) {
//          console.error("Error in getAllProducts:", error);
//         res.redirect("/pagerror"); 
//     }
// }

const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const query = {
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }
                // { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ]
        };

        const [productData, count, category] = await Promise.all([
            Product.find(query)
                .limit(limit)
                .skip((page - 1) * limit)
                .populate("category")
                .exec(),
            Product.countDocuments(query),
            Category.find({ isListed: true })
        ]);

        if (category) {
            res.render("products", {
                products: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                // brand: brand
            });
        } else {
            res.render("page-404");
        }

    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.redirect("/pagerror"); // Corrected: removed leading slash issue
    }
};



module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    
};