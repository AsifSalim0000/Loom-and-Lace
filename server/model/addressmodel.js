const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'userdb',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    locality: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    landmark: String,
    alternateMobile: String,
    addressType: {
        type: String,
        enum: ['home', 'work'], // Possible values are 'home' or 'work'
        required: true
    }
}, { timestamps: true }); // Adds createdAt and updatedAt fields

const Addressdb = mongoose.model('addressdb', addressSchema);

module.exports = Addressdb;
