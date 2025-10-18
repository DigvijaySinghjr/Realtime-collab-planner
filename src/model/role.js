import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        required: false,
        trim: true,
    },
    permissions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission'
    }]
}, { timestamps: true });

const Role = mongoose.model('Role', roleSchema);

export default Role;