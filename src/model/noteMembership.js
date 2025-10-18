import mongoose from 'mongoose';

const noteMembershipSchema = new mongoose.Schema({
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true,
    }
}, { timestamps: true });

// This compound index is crucial for performance. It ensures that queries
// to find a user's role on a specific note are extremely fast.
noteMembershipSchema.index({ noteId: 1, userId: 1 }, { unique: true });

const NoteMembership = mongoose.model('NoteMembership', noteMembershipSchema);

export default NoteMembership;
