const User = require("../models/userSchema");
const crypto = require('crypto');

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}



const userAuth = async (req, res, next) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user);
            if (!user || user.isBlocked) {
                req.session.destroy();
                return res.redirect('/login?blocked=true');  // ✅ Instant kick
            }
            next();
        } catch (err) {
            res.redirect('/login');
        }
    } else {
        res.redirect('/login');
    }
}

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










