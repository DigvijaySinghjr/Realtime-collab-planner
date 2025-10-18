import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import connect from './config/db_config.js';

import passport from 'passport';
import './config/passport-config.js';

import session from 'express-session';
import 'dotenv/config';

import { can } from './middleware/auth.js';
import NoteMembership from './model/noteMembership.js';
import Role from './model/role.js';

import NoteRepository from './repository/note-repository.js';
import UserRepository from './repository/user-repository.js';

const noteRepository = new NoteRepository();
const userRepository = new UserRepository();

const app = express();
const port = 3000;

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
            password        //we'll do hashing later 
        });
        console.log('User created:', user.email);
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
        const [note] = await noteRepository.model.create([{
            content: req.body.content,
            title: req.body.title // Also handle title if provided
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


// The noteId should be provided as a route parameter, not a literal string.
// So, use :noteId in the route to get it from the URL.
app.patch('/updateNotes/:noteId', isAuthenticated, can('edit_note_content'), async (req, res) => {
    try {
        const updateData = {};
        if (req.body.content) updateData.content = req.body.content;
        if (req.body.title) updateData.title = req.body.title;

        const note = await noteRepository.update(req.params.noteId, {
            ...updateData
        });
        return res.json(note);
    } catch (error) {
        console.log('failed to update the notes', error);
        res.status(500).json({ error: 'failed to update note' });
    }
});

app.get('/getNotes/:noteId', isAuthenticated, can('read_note'), async (req, res) => {
    try {
        const note = await noteRepository.get(req.params.noteId);
        return res.json(note);
    } catch (error) {
        console.error('failed to fetch notes:', error);
        res.status(500).json({error: 'failed to fetch note'});
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
        const note = await noteRepository.model.findByIdAndDelete(noteId, { session });

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