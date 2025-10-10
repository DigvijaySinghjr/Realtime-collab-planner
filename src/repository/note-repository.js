import Note from "../model/note.js";
import User from "../model/user.js";
import CrudRepository from "./crud-repository.js";

class NoteRepository extends  CrudRepository{
    constructor(){
        super(Note);
    }

    async getAllForUser(userId) {
        try {
            // Get user's associateNotes (both owned and contributed notes)
            const user = await User.findById(userId).populate('associateNotes');
            if (!user) {
                throw new Error('User not found');
            }
            return user.associateNotes;
        } catch (error) {
            console.log('Something went wrong in note repo while getting user notes:', error);
            throw error;
        }
    }
 
    async getForUser(noteId, userId) {
        try {
            // Check if user has access to this note (either owner or contributor)
            const note = await this.model.findOne({
                _id: noteId,
                $or: [
                    { owner: userId },
                    { contributors: userId }
                ]
            });
            return note;
        } catch (error) {
            console.log('Something went wrong in note repo while getting user note:', error);
            throw error;
        }
    }
}


export default NoteRepository;
