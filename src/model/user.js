import mongoose from 'mongoose';
const { Schema } = mongoose;

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

// Add verifyPassword method
userSchema.methods.verifyPassword = function(password) {
  return this.password === password;
};

const User = mongoose.model('User', userSchema);
export default User;
