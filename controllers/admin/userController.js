const User = require("../../models/userSchema");


const userInfo = async (req,res) =>{
    try {
        let search="";
        if(req.query.search){
            search = req.query.search;
        }
        let page=1;
        if(req.query.page){
            page = req.query.page;

        }
           const limit = 3
           const userData = await User.find({
            isAdmin:false,
            $or: [
                {name: {$regex : ".*" + search + ".*"}},
                {email:{$regex : ".*" + search + ".*"}},
            ],


           })
           .limit(limit*1)
           .skip((page-1)*limit)
           .exec();

           const count = await User.find({
               isAdmin:false,
            $or: [
                {name: {$regex : ".*" + search + ".*"}},
                {email:{$regex : ".*" + search + ".*"}},
            ],

           }).countDocuments();

          res.render("users", {
          data: userData,
          totalPages: Math.ceil(count / limit),
          currentPage: page
        });


    } catch (error) {
      res.redirect("/pagerror");
    }
}

   const userBlocked = async (req,res) =>{
    try {
        let id= req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/users");
    } catch (error) {
         res.redirect("/pagerror");
    }
   };

   const userunBlocked = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/users");

        
    } catch (error) {
          res.redirect("/pagerror");
    }
   }

  module.exports = {
            userInfo,
            userBlocked,
            userunBlocked,
        }