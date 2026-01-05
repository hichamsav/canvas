const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// قاعدة بيانات بسيطة
const database = {
    users: {
        admin: { password: "admin123", role: "admin", name: "Superviseur Principal" }
    },
    employees: [],
    zones: [],
    reports: []
};

// إضافة 11 موظف افتراضي
for (let i = 1; i <= 11; i++) {
    database.users[`user${i}`] = {
        password: "pass123",
        role: "employee",
        name: `Employé ${i}`,
        assignedAreas: []
    };
}

// تحميل قاعدة البيانات من ملف
if (fs.existsSync('database.json')) {
    const data = fs.readFileSync('database.json', 'utf8');
    Object.assign(database, JSON.parse(data));
}

// حفظ قاعدة البيانات
function saveDatabase() {
    fs.writeFileSync('database.json', JSON.stringify(database, null, 2));
}

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = database.users[username];
    if (user && user.password === password) {
        res.json({
            success: true,
            user: {
                username,
                name: user.name,
                role: user.role,
                assignedAreas: user.assignedAreas || []
            }
        });
    } else {
        res.json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
    }
});

// الحصول على جميع المستخدمين
app.get('/api/users', (req, res) => {
    const users = Object.entries(database.users)
        .filter(([_, user]) => user.role === 'employee')
        .map(([username, user]) => ({
            username,
            name: user.name,
            assignedAreas: user.assignedAreas || []
        }));
    res.json(users);
});

// إضافة موظف جديد
app.post('/api/users', (req, res) => {
    const { username, password, name } = req.body;
    
    if (database.users[username]) {
        return res.json({ success: false, message: "Le nom d'utilisateur existe déjà" });
    }
    
    database.users[username] = {
        password,
        role: "employee",
        name,
        assignedAreas: []
    };
    
    saveDatabase();
    io.emit('userAdded', { username, name });
    
    res.json({ success: true, message: "Employé ajouté avec succès" });
});

// الحصول على جميع المناطق
app.get('/api/zones', (req, res) => {
    res.json(database.zones);
});

// إضافة منطقة جديدة
app.post('/api/zones', (req, res) => {
    const { employeeUsername, name, code } = req.body;
    
    if (database.zones.some(zone => zone.code === code)) {
        return res.json({ success: false, message: "Ce code de zone existe déjà" });
    }
    
    const zone = {
        id: Date.now(),
        employee: employeeUsername,
        name,
        code,
        date: new Date().toISOString(),
        isActive: true
    };
    
    database.zones.push(zone);
    
    if (database.users[employeeUsername]) {
        if (!database.users[employeeUsername].assignedAreas) {
            database.users[employeeUsername].assignedAreas = [];
        }
        database.users[employeeUsername].assignedAreas.push(zone);
    }
    
    saveDatabase();
    io.emit('zoneAdded', zone);
    
    res.json({ success: true, message: "Zone attribuée avec succès", zone });
});

// الحصول على جميع التقارير
app.get('/api/reports', (req, res) => {
    res.json(database.reports);
});

// إرسال تقرير جديد
app.post('/api/reports', (req, res) => {
    const report = {
        id: Date.now(),
        ...req.body,
        date: new Date().toISOString(),
        status: req.body.afterPhotos ? 'complete' : 'before_only'
    };
    
    database.reports.push(report);
    saveDatabase();
    
    io.emit('newReport', report);
    
    res.json({ success: true, message: "Rapport envoyé avec succès", report });
});

// WebSocket
io.on('connection', (socket) => {
    console.log('Nouvel utilisateur connecté:', socket.id);
    
    socket.on('adminConnected', (data) => {
        socket.broadcast.emit('adminOnline', data);
    });
    
    socket.on('employeeConnected', (data) => {
        socket.broadcast.emit('employeeOnline', data);
    });
    
    socket.on('logout', (data) => {
        socket.broadcast.emit('userOffline', data);
    });
    
    socket.on('cameraActivated', (data) => {
        socket.broadcast.emit('cameraStatus', data);
    });
    
    socket.on('photoCaptured', (data) => {
        socket.broadcast.emit('photoActivity', data);
    });
    
    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté:', socket.id);
    });
});

// خدمة الملفات الثابتة
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez à: http://localhost:${PORT}`);
});
