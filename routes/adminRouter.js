const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const userController = require("../controllers/admin/userController");
const categoryController = require("../controllers/admin/categoryController");

const {userAuth,adminAuth} = require("../middlewares/auth");


router.get("/pageerror",adminController.pageerror);

// login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);

// user Management
router.get("/users",adminAuth,userController.userInfo)
router.get("/blockUser",adminAuth,userController.userBlocked);
router.get("/unblockUser",adminAuth,userController.userunBlocked);

//category Management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);


module.exports = router;