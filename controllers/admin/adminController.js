const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");


const pageerror = async(req,res)=>{
  res.render("pagerror")
}

const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.render("admin-login", { message: "Invalid email or admin account not found" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("admin-login", { message: "Incorrect password" });
    }

   
    req.session.admin = true;
    return res.redirect("/admin");
  } catch (error) {
    console.error("Login error:", error);
    return res.redirect("/pagerror");
  }
};


const loadDashboard = async (req,res)=>{
     if(req.session.admin){
        try{
           const data = {
            isAdmin: true,
           };
            res.render("dashboard",data);
            

        }catch(error){
            res.redirect("/pagerror")
        }
     }
}


const logout = async (req,res)=>{
     
        // try{
        //     req.session.destroy(err =>{
        //         if(err){
        //          console.log("Error destroying sessioin",err);
        //          return res.redirect("/pagerror")
        //         }
        //         res.redirect("/admin/login")
        //     })
           
        try{
          req.session.admin = null;
           res.redirect("/admin/login")
        

        }catch(error){
           console.log("Error destroying error during logout",error);
           res.redirect("/pagerror")
        }
     }




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}