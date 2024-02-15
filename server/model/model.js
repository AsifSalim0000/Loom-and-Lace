const mongoose =require('mongoose');

var schema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true,
        unique: true
    },
    password:{
        type: String
    },
    gender: String,
    status: {
        type: String,
        default: 'active' // Set the default status to 'active'
    },
    createdAt: {
        type: Date,
        default: () => new Date().toISOString().split('T')[0]// Automatically set the creation timestamp
    },
    verified: Boolean
})

const Userdb = mongoose.model('userdb',schema);

module.exports = Userdb;