import express from 'express';
import bodyParser from 'body-parser';
import connect from './config/db_config.js';

import 'dotenv/config'



import { addAssociateNotes, removeAssociateNotes } from '../helper.js';

import NoteRepository from './repository/note-repository.js';
import UserRepository from './repository/user-repository.js';

const noteRepository = new NoteRepository();
const userRepository = new UserRepository();

const app = express();
const port = 3000;

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }));


app.post('/createUser', async (req, res) =>{                  //create user
    console.log('req reqched for creating');
    console.log(req.body);
    const user = await userRepository.create({
        name: req.body.name,
        associateNotes: req.body.associateNotes
    });
    console.log('user created');
    res.json(user);
})



app.post('/addNotes', async (req, res) => {       // creating notes
    const note = await noteRepository.create({
        content: req.body.content,
        //contributors: req.body.contributors
        owner: req.body.userId                   
    });

    // Add the note to the user's associateNotes list
    addAssociateNotes(req.body.userId, note.id);                 //id of note is genrated just above

    console.log('no response was send');
    res.json(note);
})


// The noteId should be provided as a route parameter, not a literal string.
// So, use :noteId in the route to get it from the URL.
app.patch('/updateNotes/:noteId', async (req, res) => {
    try {
        const note = await noteRepository.update(req.params.noteId, {
            content: req.body.content
        });
        return res.json(note)
    } catch (error) {
        console.log('failed to update the notes', error);
        res.status(500).json({ error: 'failed to update note' });
    }
})

app.get('/getNotes/:noteId', async (req, res) => {          
    try {
        const userId = req.query.userId;               // fetch userId from query parameter
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        const note = await noteRepository.getForUser(req.params.noteId, userId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found or no access' });
        }
        return res.json(note)
    } catch (error) {
        console.error('failed to fetch notes:', error);
        res.status(500).json({error: 'failed to fetch note'});
    }
})

app.get('/getAllNotes', async (req, res) => {          
    try {                                                  // fetch userId from query parameter
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        const notes = await noteRepository.getAllForUser(userId);
        return res.json(notes)
    } catch (error) {
        console.error('failed to fetch notes:', error);
        res.status(500).json({error: 'failed to fetch notes'});
    }
})

app.delete('/deleteNotes/:noteId', async (req, res) => {
    try {
        const notes = await noteRepository.destroy(req.params.noteId)
        return res.json(notes)
    } catch (error) {
        console.error('failed to delete the note:', error);
        res.status(500).json({error: 'failed to delete note'});
    }
})

app.patch('/removeContributor', async (req, res) => {
    try {
        const note = await noteRepository.get(req.body.noteId);
        const idx = note.contributors.indexOf(req.body.userId);
        if (idx !== -1) {
            note.contributors.splice(idx, 1);
            await noteRepository.update(req.body.noteId, { contributors: note.contributors });
            removeAssociateNotes(req.body.userId, req.body.noteId);
        }
        res.json({ contributors: note.contributors });
    } catch (error) {
        console.error('failed to remove contributor:', error);
        res.status(500).json({ error: 'failed to remove contributor' });
    }
});


app.patch('/addContributor', async (req, res) => {      // we'll get user's id from frontend
    try {
        // Fetch the note by its id
        const note = await noteRepository.get(req.body.noteId);
        console.log(req.body.noteId);

        // Check if userId is already a contributor
        if (!note.contributors.includes(req.body.userId)) {
            note.contributors.push(req.body.userId);

            // Update the note's contributors array in the database
            await noteRepository.update(req.body.noteId, { contributors: note.contributors });

            // Add the note to the user's associateNotes list
            addAssociateNotes(req.body.userId, req.body.noteId);

        } else {
            console.log('this user is already present as contributor');
        }
 
        console.log(note.contributors);

        res.json({ contributors: note.contributors });
    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({ error: 'Failed to fetch note' });
    }
})

app.patch('/addAssociateNotes', async(req, res) => {   
    try {
        const associateNotes = await addAssociateNotes(req.body.userId, req.body.noteId)     //calling helper func
        res.json( {associateNotes} );
    } catch (error) {
        console.error('Failed to add Associate note:', error);
        res.status(500).json({ error: 'Failed to add Associate note' });
    }
})

app.patch('/removeAssociateNotes', async(req, res) => {
    try {
        const associateNotes = await removeAssociateNotes(req.body.userId, req.body.noteId)        //calling helper fun
        res.json( { associateNotes });
    } catch (error) {
        console.error('Failed to remove Associate note: ', error);
        res.status(500).json({ error: 'Failed to remove Associate note' });
    }
})


app.listen(port, async () => {
    console.log(`listening on http://localhost:${port}`);
    await connect();
    console.log('mongo Db connected');
});