//associateNotes: An array that will hold references to all the notes a user has created or contributes to

import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    associateNotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
    //    required: true,
    }],
    googleId: {
        type: String,
        sparse: true,  // Allows multiple null values
        unique: true,
    //    validate: { validator(v) { return this.provider !== 'google' || !!v; } }
      },
      provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
      },
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true                         //normalize
      },
      role:{
        type: String,
        default: 'user',
        enum: ['user', 'admin', 'editor', 'viewer',]  //roles can be added as per requirement,
      }
}, {timestamps: true});

const User = mongoose.model('User', userSchema);
export default User;