import mongoose from "mongoose";

const connect = async () => {
    mongoose.connect('mongodb://localhost/todoapp');
}

export default connect; 