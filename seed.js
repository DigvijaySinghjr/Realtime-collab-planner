import mongoose from 'mongoose';

import Permission from './src/model/permission.js';
import Role from './src/model/role.js';
import connect from './src/config/db_config.js';

const seedDatabase = async () => {
    await connect();

    try {
        // Clear existing data
        await Permission.deleteMany({});
        await Role.deleteMany({});
        console.log('Cleared existing permissions and roles.');

        // --- Define Permissions ---
        const permissions = [
            { name: 'read_note', description: 'Allows viewing a note' },
            { name: 'edit_note_content', description: 'Allows editing the content and title of a note' },
            { name: 'delete_note', description: 'Allows deleting a note' },
            { name: 'manage_contributors', description: 'Allows adding, removing, and changing roles of contributors' },
        ];
        const createdPermissions = await Permission.insertMany(permissions);
        console.log('Permissions seeded.');

        
//The reduce() creates a lookup object: { read_note: ObjectId(...) } so when you write permissions: [permissionMap.read_note], you're storing the ObjectId reference to that permission document.
        const permissionMap = createdPermissions.reduce((map, perm) => {
            map[perm.name] = perm._id;
            return map;
        }, {});

        // --- Define Roles ---
        const roles = [
            {
                name: 'Viewer',
                description: 'Can only view the note.',
                permissions: [permissionMap.read_note],
            },
            {
                name: 'Editor',
                description: 'Can view and edit the note content.',
                permissions: [permissionMap.read_note, permissionMap.edit_note_content],
            },
            {
                name: 'Manager',
                description: 'Can view, edit, and manage contributors.',
                permissions: [permissionMap.read_note, permissionMap.edit_note_content, permissionMap.manage_contributors],
            },
            {
                name: 'Owner',
                description: 'Has all permissions for the note.',
                permissions: [
                    permissionMap.read_note,
                    permissionMap.edit_note_content,
                    permissionMap.delete_note,
                    permissionMap.manage_contributors,
                ],
            },
        ];

        await Role.insertMany(roles);
        console.log('Roles seeded.');

        console.log('Database seeding completed successfully!');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
};

seedDatabase();