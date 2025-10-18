import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import User from "../model/user.js";


passport.use(new LocalStrategy(
  { usernameField: 'email' },             // specify that we are using 'email' instead of default 'username'
  async function(email, password, done) {
    try {
      console.log('Login attempt:', { email, password });
      // We need to explicitly select the password field as it's likely hidden by default in the schema for security.
      // Also, trimming the email to handle any accidental whitespace.
      const user = await User.findOne({ email: email.trim() }).select('+password');      //since we have set select:false in user schema for password field
      console.log('User found:', user ? 'Yes' : 'No');         
      
      if (!user) { 
        console.log('No user found with email:', email);
        return done(null, false); 
      }
      
      console.log('Stored password:', user.password);
      console.log('Provided password:', password);
      
      if (!user.verifyPassword(password)) { 
        console.log('Password verification failed');
        return done(null, false); 
      }
      
      console.log('Login successful for user:', user.email);
      return done(null, user);
    } catch (err) {
      console.log('Login error:', err);
      return done(err);
    }
  }
));


passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
