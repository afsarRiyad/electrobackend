import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import AppleStrategy from "passport-apple";
import { User } from "./models.js";
import jwt from "jsonwebtoken";

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// Google OAuth Strategy (only if credentials are configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Google profile"));
          }

          // Check if user exists with this Google ID
          let user = await User.findOne({ "oauthProviders.google.id": profile.id });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with this email
          user = await User.findOne({ email });

          if (user) {
            // Link Google account to existing user
            user.oauthProviders.google = {
              id: profile.id,
              email: email,
            };
            if (!user.firstName) user.firstName = profile.name?.givenName;
            if (!user.lastName) user.lastName = profile.name?.familyName;
            if (!user.avatar) user.avatar = profile.photos?.[0]?.value;
            await user.save();
            return done(null, user);
          }

          // Create new user
          const username = email.split("@")[0];
          const baseUsername = username.substring(0, 20);
          let uniqueUsername = baseUsername;
          let counter = 1;

          while (await User.findOne({ username: uniqueUsername })) {
            uniqueUsername = `${baseUsername}${counter}`;
            counter++;
          }

          user = await User.create({
            username: uniqueUsername,
            email: email,
            firstName: profile.name?.givenName || "",
            lastName: profile.name?.familyName || "",
            avatar: profile.photos?.[0]?.value || null,
            oauthProviders: {
              google: {
                id: profile.id,
                email: email,
              },
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  console.log("✅ Google OAuth configured");
} else {
  console.log("⚠️  Google OAuth not configured (missing credentials)");
}

// Apple OAuth Strategy (only if credentials are configured)
if (
  process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY_PATH
) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
        callbackURL: process.env.APPLE_CALLBACK_URL || "/api/auth/apple/callback",
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, idToken, profile, done) => {
        try {
          const email = profile.email || (req.body && req.body.user ? JSON.parse(req.body.user).email : null);
          
          if (!email) {
            return done(new Error("No email found in Apple profile"));
          }

          const appleId = profile.id || (req.body && req.body.user ? JSON.parse(req.body.user).sub : null);

          if (!appleId) {
            return done(new Error("No Apple ID found"));
          }

          // Check if user exists with this Apple ID
          let user = await User.findOne({ "oauthProviders.apple.id": appleId });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with this email
          user = await User.findOne({ email });

          if (user) {
            // Link Apple account to existing user
            user.oauthProviders.apple = {
              id: appleId,
              email: email,
            };
            await user.save();
            return done(null, user);
          }

          // Create new user
          const username = email.split("@")[0];
          const baseUsername = username.substring(0, 20);
          let uniqueUsername = baseUsername;
          let counter = 1;

          while (await User.findOne({ username: uniqueUsername })) {
            uniqueUsername = `${baseUsername}${counter}`;
            counter++;
          }

          user = await User.create({
            username: uniqueUsername,
            email: email,
            firstName: profile.name?.firstName || "",
            lastName: profile.name?.lastName || "",
            oauthProviders: {
              apple: {
                id: appleId,
                email: email,
              },
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  console.log("✅ Apple OAuth configured");
} else {
  console.log("⚠️  Apple OAuth not configured (missing credentials)");
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export { passport, generateToken };
