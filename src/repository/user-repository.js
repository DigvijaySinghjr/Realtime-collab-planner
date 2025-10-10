import CrudRepository from "./crud-repository.js";

import User from "../model/user.js";

class UserRepository extends CrudRepository{
    constructor(){
        super(User);
    }
}    

      
export default  UserRepository;