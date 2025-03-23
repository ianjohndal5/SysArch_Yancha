require('dotenv').config();
const express = require("express");
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const router = express.Router();
const path = require("path");
const fs = require('fs');
router.use(bodyParser.urlencoded({ extended: true }));

const db = new sqlite3.Database(process.env.DATABASE_PATH, (err) => {
    if (err) {
        console.error('Not Connected To Database', err.message);
        return;
    }
    console.log('Student Connected To Database');
});


router.get('/students', (req, res) => {
    const query = 'SELECT * FROM students';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

router.get('/student/:idno', (req, res) => {
    const idno = req.params.idno;
    const query = 'SELECT * FROM students WHERE idno = ?';
    db.get(query, [idno], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            res.json(row); // Return student data if found
        } else {
            res.status(404).json({ error: 'Student not found' }); // Return 404 if not found
        }
    });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM students WHERE username = ?';

    db.get(query, [username], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'An error occurred while processing your request.' });
        }
        if (row) {
            // Check if password matches
            if (password === row.password) {
                req.session.user = username;
                
                let redirectUrl = '/user/home';
                if (row.authority === 'admin') {
                    redirectUrl = '/admin/home';
                }

                res.json({ message: 'Login successful', redirectUrl: redirectUrl });
            } else {
                res.status(401).json({ message: 'Login failed. Incorrect username or password.' });
            }
        } else {
            res.status(401).json({ message: 'Login failed. Incorrect username or password.' });
        }
    });
});


router.post('/register', (req, res) => {
    const { idno, lastname, firstname, middlename, course, level, email, address, username, password } = req.body;

    console.log('Request Body:', req.body);

    if (!idno || !username || !password) {
        console.log('Missing required fields: ID number, Username, and Password.');
        return res.status(400).json({ error: 'ID number, Username, and Password are required.' });
    }

    if (!req.files || !req.files.profilePic) {
        console.log('Profile picture is missing.');
        return res.status(400).json({ error: 'Profile picture is required.' });
    }

    const profilePic = req.files.profilePic;
    const uploadDir = path.join(__dirname, '..', 'public', 'pfp');
    const uploadPath = path.join(uploadDir, `${idno}${path.extname(profilePic.name)}`);

    // Ensure the directory exists
    fs.mkdirSync(uploadDir, { recursive: true });

    console.log('Profile Picture Upload Path:', uploadPath);

    const checkIdQuery = 'SELECT * FROM students WHERE idno = ? OR username = ? ';
    db.get(checkIdQuery, [idno, username], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'An error occurred while processing your request.' });
        }
        if (row) {
            console.log('ID number or Username already exists.');
            return res.status(400).json({ error: 'ID number or Username already exists. Please use a different ID number.' });
        }

        profilePic.mv(uploadPath, function (err) {
            if (err) {
                console.error('File upload error:', err.message);
                return res.status(500).json({ error: 'An error occurred while processing your request.' });
            }

            const query = "INSERT INTO students(idno, lastname, firstname, middlename, course, level, email, address, username, password, session_value) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30)";
            db.run(query, [idno, lastname, firstname, middlename, course, level, email, address, username, password], function (err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: 'An error occurred while processing your request.' });
                }
                console.log('Registered successfully.');
                res.status(200).json({ message: 'Registered successfully' });
            });
        });
    });
});

router.post('/student', (req, res) => {
    const username = req.body.username;
    console.log('Received username:', username);

    if (!username) {
        return res.status(403).json({ message: 'Not authorized' });
    }

    const query = 'SELECT * FROM students WHERE username = ?';
    db.get(query, [username], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: 'Student not found' });
        }
        console.log('Database result:', row);
        res.json(row);
    });
});

// Logout route
router.post('/logout', (req, res) => {
    const username = req.body.username;
    console.log('Logging out username:', username);
    if (!username) {
        return res.status(403).json({ message: 'Not authorized' });
    }

    const updateSessionQuery = 'UPDATE students SET session_value = session_value - 1 WHERE username = ?';
    db.run(updateSessionQuery, [username], (err) => {
        if (err) {
            console.error('Error updating session_value:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

router.put('/editprofile', (req, res) => {
    const { lastname, firstname, middlename, course, level, email, address, username, password } = req.body;
    const query = "UPDATE students SET lastname = ?, firstname = ?,  middlename = ?, course = ?, level = ?, email = ?, address = ?, username = ?, password = ? WHERE username = ?";
    db.run(query, [lastname, firstname, middlename, course, level, email, address, username, password, username], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json({ message: 'Profile edited successfully', idno: idno });
    });
});
router.put('/updateProfile', (req, res) => {
    const { username, idno, lastname, firstname, middlename, course, level, email, address, password } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required for update.' });
    }

    let profilePicPath = null;

    if (req.files && req.files.profilePic) {
        const profilePic = req.files.profilePic;
        const uploadDir = path.join(__dirname, '..', 'public', 'pfp');
        profilePicPath = path.join(uploadDir, `${idno}${path.extname(profilePic.name)}`);
        
        fs.mkdirSync(uploadDir, { recursive: true });
        
        profilePic.mv(profilePicPath, function (err) {
            if (err) {
                console.error('File upload error:', err.message);
                return res.status(500).json({ success: false, message: 'File upload error.' });
            }
        });
    }

    const updateQuery = `
        UPDATE students 
        SET idno = ?, lastname = ?, firstname = ?, middlename = ?, course = ?, level = ?, email = ?, address = ?, password = ?
        WHERE username = ?
    `;

    db.run(updateQuery, [idno, lastname, firstname, middlename, course, level, email, address, password, username], function (err) {
        if (err) {
            console.error('Error updating profile:', err.message);
            return res.status(500).json({ success: false, message: 'Database error during profile update.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, message: 'Profile updated successfully.' });
    });
});

router.post('/updateProfilePicture', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required for update.' });
    }

    if (!req.files || !req.files.profilePic) {
        return res.status(400).json({ success: false, message: 'Profile picture is required.' });
    }
    const checkIdQuery = 'SELECT idno FROM students WHERE username = ?';
    db.get(checkIdQuery, [username], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error.' });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const idno = row.idno;


    const profilePic = req.files.profilePic;
    const checkIdQuery = 'SELECT idno FROM students WHERE username = ?';
    db.get(checkIdQuery, [username], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error.' });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const idno = row.idno;
        const uploadDir = path.join(__dirname, '..', 'public', 'pfp');
        const uploadPath = path.join(uploadDir, `${idno}${path.extname(profilePic.name)}`);
        
        fs.mkdirSync(uploadDir, { recursive: true });
        
        profilePic.mv(uploadPath, function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'File upload error.' });
            }
            res.json({ success: true, message: 'Profile picture updated successfully.' });
        });
    });
});
});

module.exports = router;