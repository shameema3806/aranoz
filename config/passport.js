const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
// const { Profiler } = require("react");
const env = require("dotenv").config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},

    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                // BLOCK CHECK
                if (user.isBlocked) {
                    return done(null, false, { message: "User is blocked by admin" });
                }
                return done(null, user);
            } else {
                user = new User({
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    googleId: profile.id,
                    isBlocked: false
                });
                await user.save();
                return done(null, user);
            }
        } catch (error) {
            console.error("Passport error:", error);
            return done(error, null);
        }
    }));

passport.serializeUser((user, done) => {

    done(null, user.id)
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            if (!user || user.isBlocked) {
                return done(null, false);
            }
            done(null, user)
        })
        .catch(err => {
            done(err, null)
        })
})

module.exports = passport;