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
    versionNumber: {
        type: Number,
        default:1
    },
    // Note: There are no 'owner' or 'contributors' fields here.
    // All user relationships are managed by the 'NoteMembership' model.
}, {timestamps: true});

// Create a text index on the title and content fields for full-text search.
noteSchema.index({ title: 'text', content: 'text' });

const Note = mongoose.model('Note', noteSchema);
export default Note;