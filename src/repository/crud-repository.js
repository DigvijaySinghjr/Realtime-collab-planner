

class CrudRepository {
    constructor(model) {
        this.model = model;
    }

    async create(data) {
        try {
            const result = await this.model.create(data);
            return result;
        } catch (error) {
            console.log('Something went wrong in the crud repo while creating:', error);
            throw error;
        }
    }

    async destroy(id) {
        try {
            const result = await this.model.findByIdAndDelete(id);
            return result;
        } catch (error) {
            console.log('Something went wrong in the crud repo while destroying:', error);
            throw error;
        }
    }

    async get(id) {
        try {
            const result = await this.model.findById(id);
            return result;
        } catch (error) {
            console.log('Something went wrong in the crud repo while getting:', error);
            throw error;
        }
    }

    async getAll(filter = {}) {
        try {
            const result = await this.model.find(filter);
            return result;
        } catch (error) {
            console.log('Something went wrong in the crud repo while getting all:', error);
            throw error;
        }
    }

    async update(id, data) {
        try {
            const result =  await this.model.updateOne({_id: id}, data, {new: true});     // new true returns post update value
            return result;
        } catch (error) {
            console.log('Something went wrong in the crud repo while updating:', error);
            throw error;
        }
    }

}

export default CrudRepository;