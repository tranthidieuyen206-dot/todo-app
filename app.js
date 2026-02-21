const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Task = require('./models/Task');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Kết nối database todoDB
mongoose.connect('mongodb://127.0.0.1:27017/todo_app')
    .then(() => console.log("✅ MongoDB Connected: todo_app"));

// --- LEVEL 1: API ---

// API Đăng ký & Băm mật khẩu
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, fullName, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashedPassword, fullName, role });
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: "Lỗi đăng ký (có thể trùng username)" });
    }
});
// API Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: "Sai username hoặc password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Sai username hoặc password" });
        }

        res.json({
            message: "Đăng nhập thành công",
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });

    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
});
// API Xuất task của user họ Nguyễn
app.get('/api/tasks/nguyen', async (req, res) => {
    const nguyenUsers = await User.find({ fullName: { $regex: /Nguyễn/i } });
    const tasks = await Task.find({ assignedUsers: { $in: nguyenUsers.map(u => u._id) } }).populate('assignedUsers');
    res.json(tasks);
});

// --- LEVEL 2 & 3: Web UI & Logic ---

app.get('/', async (req, res) => {
    const tasks = await Task.find().populate('assignedUsers');
    const users = await User.find();
    
    // Tính % Progress Bar
    const total = tasks.length;
    const done = tasks.filter(t => t.isDone).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    res.render('index', { tasks, users, progress });
});

// Thêm Task mới (Admin phân quyền)
app.post('/tasks/add', async (req, res) => {
    const { title, assignedUsers } = req.body;
    const assignees = Array.isArray(assignedUsers) ? assignedUsers : (assignedUsers ? [assignedUsers] : []);
    await Task.create({ title, assignedUsers: assignees });
    res.redirect('/');
});

// Hoàn thành task (Ghi nhận thời gian doneAt khi đủ người)
app.post('/tasks/complete/:taskId', async (req, res) => {
    const { userId } = req.body;
    const task = await Task.findById(req.params.taskId);

    if (userId && !task.completedUsers.includes(userId)) {
        task.completedUsers.push(userId);
    }

    // Nếu tất cả người được giao đã xác nhận xong
    if (task.completedUsers.length >= task.assignedUsers.length && task.assignedUsers.length > 0) {
        task.isDone = true;
        task.doneAt = new Date(); // Ghi nhận thời gian hoàn thành
    }
    await task.save();
    res.redirect('/');
});

// Xóa Task
app.post('/tasks/delete/:id', async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.listen(3000, () => console.log('🚀 Server: http://localhost:3000'));