//content,
//contributor : 'all user id'

import mongoose from "mongoose";
const { Schema } = mongoose;

const noteSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true

    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    contributors: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',              
        //required: true
        }]
}, {timestamps: true});

const Note = mongoose.model('Note', noteSchema);
export default Note;