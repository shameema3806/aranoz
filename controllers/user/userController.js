

const pageNotFound = async (req, res) => {
  try {
    res.status(404).render("page-404"); // no "user/" prefix here
  } catch (error) {
    console.log("Error rendering 404 page:", error);
    res.status(500).send("Internal Server Error");
  }
};



const loadHomepage = async (req,res)=>{
  try{
         return res.render("home");
  }catch (error){
    console.log("Home page not found");
    res.status(500).send("server error");
  }
}

module.exports ={
    loadHomepage,
    pageNotFound,
}