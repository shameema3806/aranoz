const loadContact = async (req, res) => {
    try {
        return res.render("contact", {
            user: req.session.user || null
        });
    } catch (error) {
        console.error("loadContact error:", error);
        res.status(500).send("Server Error");
    }
};

module.exports = { loadContact };