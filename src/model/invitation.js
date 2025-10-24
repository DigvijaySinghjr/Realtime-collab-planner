import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema({
    // The email address of the person being invited.
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    // The note the user is being invited to.
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        required: true,
    },
    // The user who sent the invitation.
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // The role the invited user will have.
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true,
    },
    // The unique token for the invitation link.
    token: {
        type: String,
        required: true,
        unique: true,
        select: false // Prevents token from being returned in queries by default
    },
    // The date when the invitation expires.
    expiresAt: {
        type: Date,
        required: true,
        // Documents will be automatically deleted after this time.
        expires: '1m',    // 1 minute for testing purposes
    }
}, { timestamps: true });

// Create a compound index to ensure an email can only be invited to a specific note once.
// this prevents duplicate invitations.
invitationSchema.index({ noteId: 1, email: 1 }, { unique: true });

const Invitation = mongoose.model('Invitation', invitationSchema);

export default Invitation;