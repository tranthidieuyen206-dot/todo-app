const session = require('express-session');const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Task = require('./models/Task');
const User = require('./models/User');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'todo-secret-key',
    resave: false,
    saveUninitialized: false
}));

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
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.send("Sai username hoặc password");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.send("Sai username hoặc password");
        }

        // Lưu session
        req.session.user = {
            id: user._id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        };

        res.redirect('/');
    } catch (err) {
        res.send("Lỗi server");
    }
});
app.get('/login', (req, res) => {
    res.render('login');
});

function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

function isAdmin(req, res, next) {
    if (req.session.user.role !== 'admin') {
        return res.send("Bạn không có quyền truy cập");
    }
    next();
}
// API Lấy tất cả task
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find().populate('assignedUsers');
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
});
app.get('/api/tasks/user/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // 1️⃣ Tìm user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User không tồn tại" });
        }

        // 2️⃣ Lấy task của user đó
        const tasks = await Task.find({
            assignedUsers: user._id
        }).populate('assignedUsers');

        res.json(tasks);

    } catch (err) {
        console.error("ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/tasks/today', async (req, res) => {
    try {
        const start = new Date();
        start.setHours(0, 0, 0, 0); // 00:00:00 hôm nay

        const end = new Date();
        end.setHours(23, 59, 59, 999); // 23:59:59 hôm nay

        const tasks = await Task.find({
            createdAt: {
                $gte: start,
                $lte: end
            }
        });

        console.log("TASK TODAY:", tasks);

        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
});

app.get('/api/tasks/undone', async (req, res) => {
    try {
        const tasks = await Task.find({ isDone: false });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
});
// API Xuất task của user họ Nguyễn
app.get('/api/tasks/lastname/nguyen', async (req, res) => {
    try {
        // 1️⃣ Tìm user họ Nguyễn (không phân biệt hoa thường)
        const users = await User.find({
            username: { $regex: /^nguyen/i }
        });

        if (users.length === 0) {
            return res.json([]);
        }

        // 2️⃣ Lấy danh sách _id
        const userIds = users.map(user => user._id);

        // 3️⃣ Tìm task có assignedUsers thuộc các user đó
        const tasks = await Task.find({
            assignedUsers: { $in: userIds }
        }).populate('assignedUsers');

        res.json(tasks);

    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const { title, assignedUsernames } = req.body;

        if (!title) {
            return res.status(400).json({ error: "Thiếu title" });
        }

        // 1️⃣ Tìm user theo username
        const users = await User.find({
            username: { $in: assignedUsernames }
        });

        const userIds = users.map(user => user._id);

        // 2️⃣ Tạo task
        const newTask = await Task.create({
            title,
            assignedUsers: userIds
        });

        res.status(201).json(newTask);

    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
});
app.patch('/api/tasks/:taskId/complete', async (req, res) => {
    try {
        const { taskId } = req.params;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: "Task không tồn tại" });
        }

        task.isDone = true;
        task.doneAt = new Date();

        await task.save();

        res.json(task);

    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
});
// --- LEVEL 2 & 3: Web UI & Logic ---

app.get('/', isAuthenticated, async (req, res) => {
    const tasks = await Task.find().populate('assignedUsers');
    const users = await User.find();
    
    const total = tasks.length;
    const done = tasks.filter(t => t.isDone).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    res.render('index', { 
        tasks, 
        users, 
        progress,
        currentUser: req.session.user
    });
});

// Thêm Task mới (Admin phân quyền)
app.post('/tasks/add', isAuthenticated, isAdmin, async (req, res) => {
    const { title, assignedUsers } = req.body;
    const assignees = Array.isArray(assignedUsers) ? assignedUsers : (assignedUsers ? [assignedUsers] : []);
    await Task.create({ title, assignedUsers: assignees });
    res.redirect('/');
});

// Hoàn thành task (Ghi nhận thời gian doneAt khi đủ người)

app.post('/tasks/complete/:taskId', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const task = await Task.findById(req.params.taskId);

    if (!task) {
        return res.send("Task không tồn tại");
    }

    // Normal chỉ được hoàn thành nếu được giao task
    if (
        userRole === 'normal' &&
        !task.assignedUsers.some(id => id.toString() === userId)
    ) {
        return res.send("Bạn không được giao task này");
    }

    // Không cho bấm 2 lần
    if (task.completedUsers.some(id => id.toString() === userId)) {
        return res.send("Bạn đã hoàn thành rồi");
    }

    // Thêm chính user hiện tại vào danh sách hoàn thành
    task.completedUsers.push(userId);

    // Nếu tất cả đã hoàn thành
    if (
        task.completedUsers.length === task.assignedUsers.length &&
        task.assignedUsers.length > 0
    ) {
        task.isDone = true;
        task.doneAt = new Date();
    }

    await task.save();
    res.redirect('/');
});
// Xóa Task
app.post('/tasks/delete/:id', async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
    res.redirect('/');
});
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.listen(3000, () => console.log('🚀 Server: http://localhost:3000'));