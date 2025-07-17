// const { parse } = require("dotenv");
const Category = require("../../models/categorySchema");

const categoryInfo = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1); // Never less than 1
    const limit = 4;
    const skip = (page - 1) * limit;

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);

    if (page > totalPages && totalCategories > 0) {
      return res.redirect(`/admin/category?page=${totalPages}`);
    }

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

     res.render("category", {
     cat: categoryData,
     currentPage: page,
     totalPages,
     totalCategories,
     itemsPerPage: limit, 
     start: skip + 1,
     end: Math.min(skip + limit, totalCategories)
       });
            

  } catch (error) {
    console.error(error);
    res.redirect("/pagerror");
  }
};


const addCategory = async (req,res) =>{
    console.log("REQ BODY:", req.body);
    const {name,description} = req.body;
    try {
        const existingCategory = await Category.findOne({name});
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"})
        }
        const newCategory = new Category({
            name,
            description,

        })
        await  newCategory.save();
        return res.json({message:"Category added successfully"})
    }
     catch (error) {
         console.error(error);
        return res.status(500).json({error:"Internal Server Error"})
    }
}
  

   const getListCategory = async(req,res)=>{
    try {
        let id= req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category");
    } catch (error) {
        res.redirect("/pagerror");
    }
   }

      const getUnListCategory = async(req,res)=>{
    try {
        let id= req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect("/admin/category");
    } catch (error) {
        res.redirect("/pagerror");
    }
   }


    const getEditCategory = async(req,res)=>{
    try {
        let id= req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("edit-category",{category:category});
         
    } catch (error) {
        res.redirect("/pagerror");
    }
   }

       const editCategory = async(req,res)=>{
       try {
        let id= req.params.id;
        const {categoryName,description} = req.body;
        const existingCategory = await Category.findOne({name:categoryName});
        
        if(existingCategory){
            return  res.status(400).json({error:"Category exists, please choose another name "})
        }


        const updateCategory = await Category.findByIdAndUpdate(id,{
            name:categoryName,
            description:description,

        },{new:true});
        
        if(updateCategory){
            res.redirect("/admin/category");

        }else{
            res.status(404).json({error:"Category not found"})
        }




    } catch (error) {
        res.status(500).json({error:"Internal server error"})
    }
   }


module.exports = {
    categoryInfo,
    addCategory,
    
    getListCategory,
    getUnListCategory,
    getEditCategory,
    editCategory

}