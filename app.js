const express = require("express");
const app = express();
const port = process.env.PORT || 4321;
const session = require('express-session');
const path = require("path");
const student = require("./api/student");
const announcement = require("./api/announcement");
const sessions = require("./api/session");
const history = require("./api/history");
const fileUpload = require('express-fileupload');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    if (req.url.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
    }
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure correct path for router
app.use("/api", student);
app.use("/api", sessions);
app.use("/api", announcement);
app.use("/api", history);

app.get('/index', function (req, res) {
    try {
        res.render('student');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/register', function (req, res) {
    res.render('register');
});

app.get('/user/home', function (req, res) {
    res.render('user/home');
});

app.get('/user/editprofile', function (req, res) {
    res.render('user/editprofile');
});

app.get('/admin/home', function (req, res) {
    res.render('admin/home');
});

app.get('/admin/editprofile', function (req, res) {
    res.render('admin/editprofile');
});

app.get('/admin/search', function (req, res) {
    res.render('admin/search');
});

app.get('/admin/students', function (req, res) {
    res.render('admin/students');
});

app.get('/admin/viewsitin', function (req, res) {
    res.render('admin/viewsitin');
});

app.get('/admin/viewrecords', function (req, res) {
    res.render('admin/viewrecords');
});

app.get('/admin/viewreports', function (req, res) {
    res.render('admin/viewreports');
});

app.get('/admin/viewfeedbacks', function (req, res) {
    res.render('admin/viewfeedbacks');
});

app.get('/admin/viewstatistics', function (req, res) {
    res.render('admin/viewstatistics');
});

app.get('/user/history', function (req, res) {
    res.render('user/history');
});

app.get("/", (req, res) => {
    res.render("index");
});

app.get('/index', (req, res) => {
    res.render('index');
});

// Ensure POST /logout is handled by the router
app.post('/logout', function (req, res) {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

app.listen(port, () => {
    console.log(`Listening at port ${port}`);
});
