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
const { adminAuth } = require("../middlewares/auth");


router.get("/pageerror", adminController.pageerror);

// login Management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);
router.use(adminAuth);

//dashboard
router.get("/", adminController.loadDashboard);
router.get('/sales-report/download', adminController.downloadSalesReport);


// user Management
router.get("/users", userController.userInfo)
router.get("/blockUser", userController.userBlocked);
router.get("/unblockUser", userController.userunBlocked);

//category Management
router.get("/category", categoryController.categoryInfo);
router.post("/addCategory", categoryController.addCategory);
router.get("/ListCategory", categoryController.getListCategory);
router.get("/unListCategory", categoryController.getUnListCategory);
router.post('/addCategoryOffer/:id', categoryController.addCategoryOffer);
router.delete('/removeCategoryOffer/:id', categoryController.removeCategoryOffer);

//product Management
router.get("/addProducts", productController.getProductAddPage);
router.post('/addProducts', upload.array('productImages', 4), productController.addProducts);
router.get('/products', productController.getAllProducts);
router.post('/addProductOffer/:id', productController.addProductOffer);
router.delete('/removeProductOffer/:id', productController.removeProductOffer);
router.patch('/blockProduct', productController.blockProduct);
router.patch('/unblockProduct', productController.unblockProduct);
router.get('/editProduct', productController.getEditProduct);
router.post('/editProduct/:id', upload.array('productImages', 4), productController.updateProduct);
router.post("/products/delete/:id", productController.deleteProduct);

//order Management
router.get('/order', ordersController.getAllOrders);
router.post('/order/:id/status', ordersController.updateOrderStatus);

// Coupon Management 
router.get('/coupon', couponController.getcoupon);
router.post('/coupon', couponController.createCoupon);
router.put('/coupon/:id', couponController.updateCoupon);
router.delete('/coupon/:id', couponController.deleteCoupon);

//referal offer
router.get('/referral', referralController.getReferrals);
router.get('/referral/:id', referralController.getReferralDetails);
router.post('/referral/config', referralController.saveConfig);
router.post('/referral/:id/issue-reward', referralController.issueReward);


//inventory
router.get("/inventory", ordersController.inventory);
router.get("/products/:id", productController.adminViewProduct);


module.exports = router;