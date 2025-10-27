// Load environment variables from .env file at the very beginning
import 'dotenv/config';

import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import crypto from 'crypto';
import connect from './config/db_config.js';

import passport from 'passport';
import './config/passport-config.js';

import jwt from 'jsonwebtoken';
import session from 'express-session';

import { can } from './middleware/auth.js';
import NoteMembership from './model/noteMembership.js';
import Role from './model/role.js';
import ShareLink from './model/shareLink.js';

import UserRepository from './repository/user-repository.js'; // NoteRepository is unused in this file

// Import the configured email transporter
import transporter from './config/email_config.js';

import './config/jwt_config.js';
import Invitation from './model/invitation.js';
import User from './model/user.js';
import Note from './model/note.js'; // Import Note model for updates
import NoteVersion from './model/NoteVersion.js';
const userRepository = new UserRepository();

const app = express();
const port = process.env.PORT || 3000; // Provide a default port

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({ 
  secret: process.env.SESSION_SECRET || 'keyboard cat', // Use environment variable for secret
  resave: false, // More efficient setting
  saveUninitialized: false // More efficient setting
  // For production, add: store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));
app.use(passport.initialize());
app.use(passport.session());

// Simple middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Authentication required. Please log in.' });
};


// GET route to show login form
app.get('/login', (req, res) => {
  const errorMessage = req.query.error ? '<p style="color: red;">Login failed. Please try again.</p>' : '';
  res.send(`
    <h2>Login</h2>
    ${errorMessage}
    <form action="/login" method="post">
      <input type="email" name="email" placeholder="Email" required><br><br>
      <input type="password" name="password" placeholder="Password" required><br><br>
      <button type="submit">Login</button>
    </form>
    <p><a href="/createUser">Create Account</a></p>
  `);
});

// GET route to show user creation form
app.get('/createUser', (req, res) => {
  res.send(`
    <h2>Create Account</h2>
    <form action="/createUser" method="post">
      <input type="text" name="name" placeholder="Name" required><br><br>
      <input type="email" name="email" placeholder="Email" required><br><br>
      <input type="password" name="password" placeholder="Password" required><br><br>
      <button type="submit">Create Account</button>
    </form>
    <p><a href="/login">Back to Login</a></p>
  `);
});

//POST route to handle login, show user data if successful
app.post('/login', 
    passport.authenticate('local', { failureRedirect: '/login?error=1' }), 
    function(req, res) {
      console.log('Login successful, user:', req.user);
      res.json({ message: 'Login successful!', user: req.user });
    });


app.post('/createUser', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const user = await userRepository.create({
            name,
            email: email.trim(),
            password // The pre-save hook in the User model will hash this automatically
        });
        console.log('User created:', user.email);

        // Send a welcome email if the transporter is configured
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: `"Realtime Planner" <${process.env.SENDER_EMAIL}>`, // Sender address
                    to: user.email, // Recipient: the new user's email
                    subject: "Welcome to Realtime Collab Planner! ✔", // Subject line
                    text: `Hello ${user.name},\n\nWelcome to the Realtime Collab Planner. We're excited to have you on board!`, // Plain text body
                    html: `<b>Hello ${user.name},</b><br><br>Welcome to the Realtime Collab Planner. We're excited to have you on board!`, // HTML body
                });
                console.log('Welcome email sent to:', user.email);
            } catch (emailError) {
                console.error('Failed to send welcome email:', emailError);
            }
        }

        // Exclude password from the response
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error creating user:', error);
        // Handle duplicate email error
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Email already exists.' });
        }
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

/**
 * Serves a basic HTML form to test sending invitations.
 * Must be logged in to access.
 */
app.get('/invite', (req, res) => {
  if (req.isAuthenticated()) {
    // If user is logged in, show the invitation form
    res.send(`
      <h2>Invite a Collaborator</h2>
      <p>You are logged in as: ${req.user.email}</p>
      <form action="/inviteUser" method="post">
        <label for="noteId">Note ID:</label><br>
        <input type="text" id="noteId" name="noteId" required style="width: 300px;"><br><br>
        <label for="email">Email to invite:</label><br>
        <input type="email" id="email" name="email" required style="width: 300px;"><br><br>
        <label for="roleName">Role (e.g., Editor, Viewer):</label><br>
        <input type="text" id="roleName" name="roleName" value="Editor" required style="width: 300px;"><br><br>
        <button type="submit">Send Invitation</button>
      </form>
    `);
  } else {
    // If user is not logged in, show the login form
    const errorMessage = req.query.error ? '<p style="color: red;">Login failed. Please try again.</p>' : '';
    res.send(`
      <h2>Login to Invite Collaborators</h2>
      ${errorMessage}
      <form action="/login" method="post">
        <input type="email" name="email" placeholder="Email" required><br><br>
        <input type="password" name="password" placeholder="Password" required><br><br>
        <button type="submit">Login</button>
      </form>
      <p><a href="/createUser">Create Account</a></p>
    `);
  }
});


app.post('/inviteUser', isAuthenticated, async (req, res) => {
    try {
        const { noteId, email, roleName } = req.body;
        const sentBy = req.user.id;

        // 1. Find the role by its name
        const role = await Role.findOne({ name: roleName }).lean();
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // 2. Check if the user is already a collaborator on this note
        const existingUser = await User.findOne({ email: email }).lean();
        if (existingUser) {
            const existingMembership = await NoteMembership.findOne({ noteId: noteId, userId: existingUser._id });
            if (existingMembership) {
                return res.status(409).json({ error: 'This user is already a collaborator on this note.' });
            }
        }

        // 3. Generate a JWT for the invitation.
        const invitationPayload = {
            email: email,
            noteId: noteId,
            roleId: role._id,
        };
        const invitationToken = jwt.sign(
            invitationPayload,
            'your-super-secret-invitation-key', // Hardcoded secret as requested
            { expiresIn: '24h' }
        );

        // 4. Create the invitation record in the database
        await Invitation.create({
            sentBy: sentBy,
            noteId: noteId,
            email: email,
            roleId: role._id,
            token: invitationToken,
            expiresAt: new Date(Date.now() + 60 * 1000), // Expires in 1 minute
        });

        // 5. Send the invitation email with a link to accept
        if (transporter) {
            try {
                const invitationLink = `http://localhost:3000/accept-invitation?token=${invitationToken}`;

                await transporter.sendMail({
                    from: `"Realtime Planner" <${process.env.SENDER_EMAIL}>`, // Use environment variable for sender email
                    to: email,
                    subject: "You're invited to collaborate on a Note! ✔",
                    text: `You have been invited to collaborate. Click this link to accept: ${invitationLink}`,
                    html: `<b>You have been invited to collaborate.</b><br><a href="${invitationLink}">Click here to accept the invitation.</a>`
                });
                console.log('Invitation email sent to:', email);
            } catch (emailError) {
                console.error('Failed to send invitation email:', emailError);
                return res.status(500).json({ error: 'Failed to send invitation email.' });
            }
        }

        res.status(200).json({ message: 'Invitation sent successfully.' });

    } catch (error) {
        if (error.code === 11000) { // Handles the unique index violation from the Invitation model
            return res.status(409).json({ error: 'An active invitation for this user on this note already exists.' });
        }
        console.error('Failed to invite user:', error);
        res.status(500).json({ error: 'Failed to invite user.' });
    }
})



app.post('/accept-invitation', isAuthenticated, async(req, res) => {
    try {
        const { token } = req.query;
        const decodeToken = jwt.verify(token,  'your-super-secret-invitation-key', ); // hardcoded secret for now
        const { email, noteId, roleId } = decodeToken;

        const ifInvited = await Invitation.findOne({  token: token });  //since token is unique, and  it contains all info we need
        if (!ifInvited) {
            return res.status(400).json({ error: 'Invalid or expired invitation token'});
        }
        // create the noteMembership
        await NoteMembership.create({
            userId : req.user.id,
            noteId: noteId,
            roleId: roleId
        });

        //delete the invitation after accepting
        await Invitation.deleteOne({ token: token});

        console.log(`User ${req.user.id} accepted invitation to note ${noteId}`);
        return res.status(200).json({ message: 'Invitation accepted successfully'});

    } catch (error) {
        console.error('Failed to accept invitation:', error);
        return res.status(500).json({ error: 'Failed to accept invitation'})
    }
})



/**
 * Creates a new public, shareable link for a note.
 * The user must be authenticated. Authorization (e.g., can('share_note')) can be added later.
 */
app.post('/shareNotes', isAuthenticated, async (req, res) => {
    try {
        // 1. Get noteId and optional scope from the request body.
        const { noteId, scope } = req.body;
        const createdBy = req.user.id;

        // 2. Generate a secure, random token. This is NOT a JWT.
        // It's a simple, unique key to look up the ShareLink document.
        const shareToken = crypto.randomBytes(32).toString('hex');

        // 3. Create the ShareLink document in the database.
        await ShareLink.create({
            noteId: noteId,
            token: shareToken,
            createdBy: createdBy,
            scope: scope || 'read-only', // Will use the schema's default ('read-only') if not provided
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        // 4. Respond with the generated shareable link.
        const sharableLink = `http://localhost:3000/view/${shareToken}`;
        console.log(`Shareable link created for note ${noteId}: ${sharableLink}`);
        return res.status(201).json({ sharableLink: sharableLink });
    } catch (error) {
        console.error('failed to share notes:', error);
        return  res.status(500).json({error: 'failed to share notes'});
    }
})

/**
 * Serves a basic HTML form to test creating a shareable link.
 */
app.get('/share-test', isAuthenticated, (req, res) => {
  res.send(`
    <h2>Create a Shareable Link</h2>
    <p>You are logged in as: ${req.user.email}</p>
    <p>Enter the ID of a note you want to share publicly.</p>
    <form action="/shareNotes" method="post">
      <label for="noteId">Note ID to Share:</label><br>
      <input type="text" id="noteId" name="noteId" required style="width: 300px;"><br><br>
      <p>After submitting, you will get a JSON response with a 'sharableLink'. Copy that link and open it in a new browser tab (or an incognito window) to test the public view.</p>
      <button type="submit">Generate Share Link</button>
    </form>
  `);
});


app.get('/view/:token', async (req, res) => {   //for viewing shared notes, no authentication needed
    try {
        const { token } = req.params;

        //find the share link by token
        const shareLink = await ShareLink.findOne({ token: token})

        if(!shareLink){
             return res.status(404).json({ error: 'share Link not found or expired'});
        }
        //fetch the note associated with the shared link
        const note = await Note.findById(shareLink.noteId);
        if(!note){
                   return res.status(404).json({ error: 'note not found'});
        }
               //since everything is valid, return the note content
        return res.status(200).json({ note: note, scope: shareLink.scope});
        
    } catch (error) {
        console.log('failed to access shared note:', error);
        return res.status(500).json({error: 'failed to access shared note'});
    }
})


app.post('/addNotes', isAuthenticated, async (req, res) => { 
    const session = await mongoose.startSession(); 
    try {
        session.startTransaction();

        // 1. Find the 'Owner' role ID
        const ownerRole = await Role.findOne({ name: 'Owner' }).lean();
        if (!ownerRole) {
            return res.status(500).json({ error: '"Owner" role not found. Please seed the database.' });
        }

        // 2. Create the note within the transaction
        const [note] = await Note.create([{
            content: req.body.content,
            title: req.body.title, // Also handle title if provided
            // versionNumber default: 1
        }], { session });

        // 3. Create a membership linking the user, note, and role
        await NoteMembership.create([{
            userId: req.user.id,
            noteId: note._id,
            roleId: ownerRole._id,
        }], { session });

        await session.commitTransaction();

        console.log(`Note created and ownership assigned to user ${req.user.id}`);
        res.status(201).json(note);
    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Failed to create note' });
    } finally {
        session.endSession();
    }
});


app.patch('/updateNotes/:noteId', isAuthenticated, can('edit_note_content'), async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const noteId = req.params.noteId;
        const userId = req.user.id;

        // 1. Find the original note to create a version snapshot from it.
        const originalNote = await Note.findById(noteId).session(session);
        if (!originalNote) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Note not found' });
        }

        // 2. Create a new version document based on the *current* state of the note.
        await NoteVersion.create([{
            noteId: originalNote._id,
            versionNumber: originalNote.versionNumber,
            title: originalNote.title,
            content: originalNote.content,
            changedBy: userId
        }], { session });

        // 3. Prepare the update data and increment the version number on the main note.
        const updateData = {};
        if (req.body.content) updateData.content = req.body.content;
        if (req.body.title) updateData.title = req.body.title;

        const updatedNote = await Note.findByIdAndUpdate(noteId, { ...updateData, $inc: { versionNumber: 1 } }, { new: true, session: session });

       await session.commitTransaction();

        return res.json(updatedNote);
    } catch (error) {
        await session.abortTransaction();
        console.log('failed to update the notes', error);
        res.status(500).json({ error: 'failed to update note' });
    }
});


/**
 * Reverts a note to a specific previous version.
 */
app.post('/notes/:noteId/revert', isAuthenticated, can('edit_note_content'), async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const noteId = req.params.noteId;

        const versionNumber = req.body.versionNumber;  // to which we want to revert
        if(!versionNumber){
            await session.abortTransaction();
            return res.status(400).json({ error: 'versionNumber is required in the request body'});
        } 
        // 1. Find the target version to revert to.
        const targetVersion = await NoteVersion.findOne({ noteId: noteId, versionNumber: versionNumber }).session(session);
        if(!targetVersion){
            await session.abortTransaction();
            return res.status(404).json({ error: 'target version not faound'});
        }
        // 2. Update the main note with the content from the target version.
        const updateNote = await Note.findByIdAndUpdate(noteId, {
            content: targetVersion.content,
            title: targetVersion.title,
            $inc: { versionNumber: 1 } // Increment version number on revert
        }, { new: true, session: session });

        await session.commitTransaction();
        return res.status(200).json({ 
            message: `Note reverted to version ${versionNumber} successfully`, 
            note: updateNote
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error reverting note to previous version:', error);
        res.status(500).json({ error: 'Failed to revert note to previous version' });
    }

   });


/**
 * Retrieves the version history for a specific note.
 */
app.get('/notes/:noteId/history', isAuthenticated, can('read_note'), async (req, res) => {
    try {
        const { noteId } = req.params;

        // Find all versions for the given noteId and sort them from newest to oldest.
        // The index on the NoteVersion model makes this query very efficient.
        const history = await NoteVersion.find({ noteId: noteId })
            .sort({ versionNumber: -1 })
            .lean(); 

        return res.status(200).json(history);

    } catch (error) {
        console.error('Failed to retrieve note history:', error);
        res.status(500).json({ error: 'Failed to retrieve note history.' });
    }
});

/**
 * Endpoint to change a collaborator's role on a note.
 * Only one owner can be present at a time according to this logic.
 * Only the current owner of a note can perform this action.
 */
// app.put('/notes/:noteId/collaborators/:targetUserId', isAuthenticated, async (req, res) => {
//     const { noteId, targetUserId } = req.params;
//     const { roleName } = req.body; // e.g., "Owner", "Manager", "Editor"
//     const currentUserId = req.user.id;

//     if (!roleName) {
//         return res.status(400).json({ error: 'roleName is required in the request body.' });
//     }

//     const session = await mongoose.startSession();

//     try {
//         session.startTransaction();

//         // 1. Verify the current user is the owner of the note.
//         const ownerRole = await Role.findOne({ name: 'Owner' }).session(session).lean();
//         if (!ownerRole) return res.status(500).json({ error: '"Owner" role not found.' });

//         const currentUserMembership = await NoteMembership.findOne({
//             noteId: noteId,
//             userId: currentUserId,
//             roleId: ownerRole._id
//         }).session(session);

//         if (!currentUserMembership) {
//             return res.status(403).json({ error: 'Forbidden: Only the note owner can change roles.' });
//         }

//         // 2. Find the target role.
//         const targetRole = await Role.findOne({ name: roleName }).session(session).lean();
//         if (!targetRole) return res.status(400).json({ error: `Role "${roleName}" not found.` });

//         // --- SPECIAL OWNERSHIP TRANSFER LOGIC ---
//         if (targetRole.name === 'Owner') {
//             if (currentUserId === targetUserId) {
//                 return res.status(400).json({ error: 'You are already the owner.' });
//             }

//             // Find the 'Manager' role to demote the current owner to.
//             const managerRole = await Role.findOne({ name: 'Manager' }).session(session).lean();
//             if (!managerRole) return res.status(500).json({ error: '"Manager" role not found for ownership transfer.' });

//             // a) Demote current owner to Manager.
//             currentUserMembership.roleId = managerRole._id;
//             await currentUserMembership.save({ session });

//             // b) Promote target user to Owner.
//             // Use findOneAndUpdate with upsert to handle cases where the target user is not yet a collaborator.
//             await NoteMembership.findOneAndUpdate(
//                 { noteId: noteId, userId: targetUserId },
//                 { $set: { roleId: targetRole._id } },
//                 { upsert: true, new: true, session: session }
//             );

//             await session.commitTransaction();
//             return res.status(200).json({ message: 'Ownership successfully transferred.' });
//         }

//         // --- STANDARD ROLE CHANGE LOGIC ---
//         // For any role other than 'Owner', simply update or create the membership.
//         const updatedMembership = await NoteMembership.findOneAndUpdate(
//             { noteId: noteId, userId: targetUserId },
//             { $set: { roleId: targetRole._id } },
//             { upsert: true, new: true, session: session }
//         );

//         await session.commitTransaction();
//         res.status(200).json({ message: `User role updated to ${roleName}.`, membership: updatedMembership });

//     } catch (error) {
//         await session.abortTransaction();
//         console.error('Error changing collaborator role:', error);
//         res.status(500).json({ error: 'Failed to change collaborator role.' });
//     } finally {
//         session.endSession();
//     }
// });

app.post('/changeRoles', async(req, res) => {               //authorization not set up here for now
    const { noteId, targetUserId, currentUserId, targetRole } = req.body;
    
    const session = await mongoose.startSession();

    try {
        // Verify current user is owner of the note (Authorization)
        const currentUserNoteMembership = await NoteMembership.findOne({
            noteId: noteId,
            userId: currentUserId
        });
        
        if(!currentUserNoteMembership){
            return res.status(400).json({error: 'current user is not a collaborator of the note'});
        }

       currentUserRole = await Role.findById(currentUserNoteMembership.roleId);
       if(currentUserRole.name !== 'Owner'){
            return res.status(403).json({error: 'only owner can change collaborator roles'});
       }

        const userRole = await Role.findOne({name: 'Owner'})  
       
        session.startTransaction();

        // Fetch note membership (remove roleId from query since we're changing it)
        const noteMembership = await NoteMembership.findOne({
            noteId: noteId, 
            userId: targetUserId
        }).session(session);
        
        if(!noteMembership){
            await session.abortTransaction();
            return res.status(400).json({error: 'note membership not found'});
        }

        // Find target role's id
        const targetRoleDoc = await Role.findOne({name: targetRole}).session(session).lean();
        if(!targetRoleDoc){
            await session.abortTransaction();
            return res.status(400).json({error: 'role not found'});
        }

        // Update role
        noteMembership.roleId = targetRoleDoc._id;
        await noteMembership.save({session});

        await session.commitTransaction();
        return res.status(200).json({message: 'role changed successfully'});
        
    } catch (error) {
        await session.abortTransaction();
        console.error('error occurred while changing the role:', error);
        return res.status(500).json({error: 'failed to change collaborator role'});
    } finally {
        session.endSession();
    }
});


app.delete('/revokeAccess/:noteId/:targetId', isAuthenticated, async (req, res) => {
    try {
        // 1. Owner cannot revoke their own access check (Good check!)
        if (req.user.id === req.params.targetId) {
            return res.status(400).json({ error: 'owners cannot revoke their own access' });
        }

        // 2. Verify if current user is owner
        const currentUserNoteMembership = await NoteMembership.findOne({
            noteId: req.params.noteId,
            userId: req.user.id,
        });

        if (!currentUserNoteMembership) {
            return res.status(400).json({ error: 'current user is not a collaborator of the note' });
        }
        
        // Use consistent variable naming (e.g., currentUSerRole -> currentUserRole)
        const currentUserRole = await Role.findById(currentUserNoteMembership.roleId);
        
        // 3. Authorization check
        if (currentUserRole.name !== 'Owner') {
            return res.status(403).json({ error: 'only owner can revoke access' });
        }
        
        // 4. Proceed to revoke access
        const result = await NoteMembership.findOneAndDelete({
            noteId: req.params.noteId,
            userId: req.params.targetId,
        });

        if (!result) {
            return res.status(404).json({ error: 'note membership not found' });
        }
        
        return res.status(200).json({ message: 'access revoked successfully' });
    } catch (error) {
        console.error('failed to revoke access:', error);
        // Best practice to avoid leaking database details in production
        res.status(500).json({ error: 'An unexpected error occurred' }); 
    }
});



app.get('/getAllNotes', isAuthenticated, async (req, res) => {
    try {
        // This aggregation is more efficient. It finds all memberships for the user,
        // then joins them with the corresponding note and role in a single database query.
        const notes = await NoteMembership.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
            {
                $lookup: {
                    from: 'notes', // The collection name for the Note model
                    localField: 'noteId',
                    foreignField: '_id',
                    as: 'noteDetails'
                }
            },
            { $unwind: '$noteDetails' }, // Deconstruct the noteDetails array
            {
                $project: { // Reshape the output to be clean
                    _id: '$noteDetails._id',
                    title: '$noteDetails.title',
                    content: '$noteDetails.content',
                    createdAt: '$noteDetails.createdAt',
                    updatedAt: '$noteDetails.updatedAt'
                }
            }
        ]);
        return res.json(notes);
    } catch (error) {
        console.error('failed to fetch notes:', error);
        res.status(500).json({error: 'failed to fetch notes'});
    }
});

app.delete('/deleteNotes/:noteId', isAuthenticated, can('delete_note'), async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const noteId = req.params.noteId;
        const note = await Note.findByIdAndDelete(noteId, { session });

        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        // Also clean up all memberships associated with the deleted note
        await NoteMembership.deleteMany({ noteId: noteId }, { session });

        await session.commitTransaction();
        return res.json({ message: 'Note and all associated memberships deleted successfully', note });
    } catch (error) {
        await session.abortTransaction();
        console.error('failed to delete the note:', error);
        res.status(500).json({error: 'failed to delete note'});
    } finally {
        session.endSession();
    }
});


app.listen(port, async () => {
    console.log(`listening on http://localhost:${port}`);
    await connect();
    console.log('mongo Db connected');
});