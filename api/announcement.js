const express = require("express");
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const router = express.Router();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

const db = new sqlite3.Database(process.env.DATABASE_PATH, (err) => {
    if (err) {
        console.error('Not Connected To Database', err.message);
        return;
    }
    console.log('Announcement Connected To Database');
});
// Fetch all announcements
router.get('/announcements', (req, res) => {
    const query = 'SELECT * FROM announcement';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Create a new announcement
router.post('/announcement', (req, res) => {
    const { author, content } = req.body;
    const dateCreated = new Date().toISOString();

    const insertQuery = `INSERT INTO announcement (author, date_created, content) 
                         VALUES (?, ?, ?)`;

    db.run(insertQuery, [author, dateCreated, content], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Announcement created successfully', announcement_id: this.lastID });
    });
});

module.exports = router;
