import mongoose from 'mongoose';

const noteVersionSchema = new mongoose.Schema({
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        required: true,
    },
    versionNumber:{
        type: Number,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true // leading/trailing whitespace removed
    }
}, { timestamps: true });

// This compound index ensures that for any given note, each version number is unique.
// It also optimizes queries for fetching a note's history, sorted from newest to oldest.
noteVersionSchema.index({ noteId: 1, versionNumber: -1 }, { unique: true });

const NoteVersion = mongoose.model('NoteVersion', noteVersionSchema);

export default NoteVersion;