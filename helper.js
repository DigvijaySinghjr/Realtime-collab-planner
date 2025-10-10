import NoteRepository from './src/repository/note-repository.js';
import UserRepository from './src/repository/user-repository.js';

const noteRepository = new NoteRepository();
const userRepository = new UserRepository();


export async function addAssociateNotes(userId, noteId) {
        const user = await userRepository.get(userId);

        if (!user) {                         //if user not foud
            console.error('no user found');
            return;
        }
        

        // if not present
        if (!user.associateNotes.includes(noteId)) {
            user.associateNotes.push(noteId);

            await userRepository.update(userId, { associateNotes: user.associateNotes });
        } else {
            console.log('this noteId is already present in associateNote field or this user');
        }
        return user.associateNotes;
}

export async function removeAssociateNotes(userId, noteId) {
    const user = await userRepository.get(userId);

    if (!user) { // if user not found
        console.error('no user found');
        return;
    }

    if (user.associateNotes.includes(noteId)) {
        const indexToRemove = user.associateNotes.indexOf(noteId);
        if (indexToRemove !== -1) {
            user.associateNotes.splice(indexToRemove, 1);
            await userRepository.update(userId, { associateNotes: user.associateNotes });
        }
    } else {
        console.log('this noteId is not present in associateNote field or this user');
    }
    return user.associateNotes;
}



