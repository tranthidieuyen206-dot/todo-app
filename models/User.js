const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ['admin', 'normal'], default: 'normal' }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);