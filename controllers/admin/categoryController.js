const Category = require("../../models/categorySchema");


const categoryInfo = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 5;
    const skip = (page - 1) * limit;

    const searchQuery = req.query.search ? req.query.search.trim() : "";

    // Build filter for search
    const filter = {};
    if (searchQuery) {
      filter.name = { $regex: new RegExp(searchQuery, "i") }; // case-insensitive
    }

    // Count total categories (for pagination)
    const totalCategories = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalCategories / limit);

    if (page > totalPages && totalCategories > 0) {
      return res.redirect(`/admin/category?page=${totalPages}`);
    }

    // Fetch categories (latest first)
    const categoryData = await Category.find(filter)
      .sort({ createdAt: -1 }) // descending order
      .skip(skip)
      .limit(limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages,
      totalCategories,
      itemsPerPage: limit,
      searchQuery,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/pagerror");
  }
};




const addCategory = async (req, res) => {
    console.log("REQ BODY:", req.body);
    const { name, description } = req.body;

    try {
        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }

        const trimmedName = name.trim();
        const trimmedDesc = description.trim();

        if (!trimmedName) {
            return res.status(400).json({ error: "Name cannot be empty" });
        }

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, "i") }
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({
            name: trimmedName,
            description: trimmedDesc,
        });

        await newCategory.save();

        return res.json({
            message: "Category added successfully",
            category: newCategory
        });

    } catch (error) {
        console.error("Error adding category:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};



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




// GET – show the old edit page (keep it, it’s a fallback)
const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findById(id);
    if (!category) return res.redirect("/pagerror");
    res.render("edit-category", { category });
  } catch (error) {
    res.redirect("/pagerror");
  }
};

// const editCategory = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const { categoryName, description } = req.body;

//     const name = (categoryName || "").trim();
//     const desc = (description || "").trim();

//     if (!name) return res.status(400).json({ error: "Category name is required" });
//     if (!desc) return res.status(400).json({ error: "Description is required" });

//     const existing = await Category.findOne({
//       name: name,
//       _id: { $ne: id }              
//     });
//     if (existing) {
//       return res.status(400).json({ error: "Category with this name already exists" });
//     }

//     const updated = await Category.findByIdAndUpdate(
//       id,
//       { name, description: desc },
//       { new: true }
//     );

//     if (!updated) return res.status(404).json({ error: "Category not found" });

//     res.json({ success: true, category: updated });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };




module.exports = {
    categoryInfo,
    addCategory, 
    getListCategory,
    getUnListCategory,
    getEditCategory,
    // editCategory

}