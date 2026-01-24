const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const userController = require("../controllers/admin/userController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const upload = require('../helpers/multer');
const ordersController = require("../controllers/admin/ordersController");
const couponController = require("../controllers/admin/couponController");
const referralController = require("../controllers/admin/referralController");
// const adminReferralController = require("../controllers/admin/referralController");
const {userAuth,adminAuth} = require("../middlewares/auth");


router.get("/pageerror",adminController.pageerror);

// login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/logout",adminController.logout);
router.get("/",adminAuth,adminController.loadDashboard);
router.get("/sales-report",adminAuth,adminController.getSalesReport);
router.get('/sales-report/download', adminAuth, adminController.downloadSalesReport);



// user Management
router.get("/users",adminAuth,userController.userInfo)
router.get("/blockUser",adminAuth,userController.userBlocked);
router.get("/unblockUser",adminAuth,userController.userunBlocked);

//category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.get("/ListCategory",adminAuth,categoryController.getListCategory);
router.get("/unListCategory",adminAuth,categoryController.getUnListCategory);
router.post('/addCategoryOffer/:id', adminAuth,categoryController.addCategoryOffer);
router.delete('/removeCategoryOffer/:id',adminAuth,categoryController.removeCategoryOffer);
// router.get("/editCategory",adminAuth,categoryController.getEditCategory);
// router.post("/editCategory/:id",adminAuth,categoryController.editCategory);

//product Management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post('/addProducts', adminAuth, upload.array('productImages', 4), productController.addProducts);
router.get('/products',adminAuth, productController.getAllProducts);
router.post('/addProductOffer/:id', adminAuth, productController.addProductOffer);
router.delete('/removeProductOffer/:id', adminAuth, productController.removeProductOffer);
router.get('/blockProduct', adminAuth, productController.blockProduct);
router.get('/unblockProduct', adminAuth, productController.unblockProduct);
router.get('/editProduct', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth,upload.array('productImages', 4), productController.updateProduct);
router.post("/products/delete/:id", adminAuth, productController.deleteProduct);

//order Management
router.get('/order',adminAuth,ordersController.getAllOrders);
router.post('/order/:id/status', adminAuth,ordersController.updateOrderStatus);

// Coupon Management 
router.get('/coupon', adminAuth, couponController.getcoupon);
router.post('/coupon', adminAuth, couponController.createCoupon);
router.put('/coupon/:id', adminAuth, couponController.updateCoupon);
router.delete('/coupon/:id', adminAuth, couponController.deleteCoupon);

//referal offer
// GET /admin/referral - View all referrals (main page)
router.get('/referral', adminAuth,referralController.getReferrals);
// GET /admin/referral/:id - Get referral details
router.get('/referral/:id', adminAuth, referralController.getReferralDetails);
// POST /admin/referral/config - Save configuration
router.post('/referral/config', adminAuth, referralController.saveConfig);
// POST /admin/referral/:id/issue-reward - Manually issue reward
router.post('/referral/:id/issue-reward', adminAuth, referralController.issueReward);


//inventory
router.get("/inventory",adminAuth,ordersController.inventory);
router.get("/products/:id",adminAuth,productController.adminViewProduct);


module.exports = router;