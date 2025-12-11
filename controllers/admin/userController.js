const User = require("../../models/userSchema");

const userInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const query = {
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    };

    const users = await User.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(query);

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        users,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      });
    }

    res.render("users", {
      data: users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      search,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/pagerror");
  }
};

// Block user
const userBlocked = async (req, res) => {
  try {
    const userId = req.query.id;
    console.log("Blocking user ID:", userId); 
    await User.findByIdAndUpdate(userId, { isBlocked: true });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

// Unblock user
const userunBlocked = async (req, res) => {
  try {
    const userId = req.query.id;
    await User.findByIdAndUpdate(userId, { isBlocked: false });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

  module.exports = {
            userInfo,
            userBlocked,
            userunBlocked,
        }
