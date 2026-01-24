const User = require("../models/userSchema");
const crypto = require('crypto');

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}


const userAuth = (req, res, next) => {
  if (req.session && req.session.user) {  
    User.findById(req.session.user)  
      .then(data => {
        if (data && !data.isBlocked) {
          req.user = data;  
          next();
        } else {
          console.log("User blocked or not found - redirecting");
          req.session.destroy();  
          res.redirect("/login?blocked=true");
        }
      })
      .catch(error => {
        console.log("Error in user Auth middleware:", error);
        res.status(500).send("Internal server error");
      });
  } else {
    console.log("No session.user - redirecting to login");
    res.redirect("/login");
  }
};

const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(date =>{
        if(date){
            next();
        }else{
            res.redirect("/admin/login")
        }
    }) 
    .catch(error=>{
    console.log("Error in adminauth middleware ",error)
     res.status(500).send("Internal server error")
       
})

}

module.exports = {
    userAuth,
    adminAuth
}