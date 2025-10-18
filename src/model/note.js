import mongoose from "mongoose";
const { Schema } = mongoose;

const noteSchema = new mongoose.Schema({
    title: {
        type: String,
        trim: true,
        default: 'Untitled Note'
    },
    content: {
        type: String,
        required: true
    },
    // Note: There are no 'owner' or 'contributors' fields here.
    // All user relationships are managed by the 'NoteMembership' model.
}, {timestamps: true});

const Note = mongoose.model('Note', noteSchema);
export default Note;