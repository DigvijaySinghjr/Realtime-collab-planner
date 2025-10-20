import mongoose from 'mongoose';
const { Schema } = mongoose;
import bcrypt from 'bcrypt';

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true                         //normalize
      },
      password: {
        type: String,
        required: true,
        minlength: 5,
        select: false // do not return password by default (hide it)
      }
}, {timestamps: true});

// Hash the password before saving the user
userSchema.pre('save', function(next) {
  bcrypt.hash(this.password, 10, (err, hash) => {
    if (err) {
      return next(err);
    }
    this.password = hash;
    next();
  });
});

userSchema.methods.verifyPassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
