const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    isDone: { type: Boolean, default: false },
    doneAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    completedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.models.Task || mongoose.model('Task', TaskSchema);