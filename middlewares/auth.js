const User = require("../models/userSchema");

const userAuth = (req,res,next)=>{
if(req.session.user){

    User.findById(req.session.user)
    .then(data =>{
        if(data && !data.isBlocked){
            next();
        }else{
            res.redirect("/login")
        }
    })
    .catch(error =>{
        console.log("Error in user Auth middleware",error);
        res.status(500).send("Internal server error")
    })
}else{
    res.redirect("/login")
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