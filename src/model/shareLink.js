import mongoose from 'mongoose';

const shareLinkSchema = new mongoose.Schema({
    noteId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Note',                         
        required: true,

    },
    token: {
        type: String,
        required: true,
        unique: true,
        select: false // Prevents token from being returned in queries by default
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',                         
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,       // for security
        expires: '1w',        // TTL index for 1 week
    },
    scope: {
        type: String,
        enum: ['read-only', 'comment-only'],
        default: 'read-only',
    }
}, {timestamps: true});

const ShareLink = mongoose.model('ShareLink', shareLinkSchema);

export default ShareLink;