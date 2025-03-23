require('dotenv').config();
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
    console.log('History Connected To Database');
});

router.post('/student/report', (req, res) => {
    const { idno, lab, date, message } = req.body;

    const reportQuery = `INSERT INTO report (idno, lab, date_created, message) 
                         VALUES (?, ?, ?, ?)`;
    const now = new Date();
    const dateCreated = now.toISOString().split('T')[0]; // Ensure `date_created` format is `YYYY-MM-DD`

    db.run(reportQuery, [idno, lab, dateCreated, message], (err) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to insert feedback into report table.' });
        }
        res.json({ message: 'Feedback submitted successfully!' });
    });
});
router.get('/student/history/username/:username', (req, res) => {
    const username = req.params.username;

    // Fetch the student's ID number based on the username
    const studentQuery = 'SELECT idno FROM students WHERE username = ?';
    db.get(studentQuery, [username], (err, student) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch student information.' });
        }
        if (!student) {
            return res.status(404).json({ error: 'No student found with the provided username.' });
        }

        // Fetch the history for the student's ID number
        const historyQuery = 'SELECT * FROM history WHERE idno = ?';
        db.all(historyQuery, [student.idno], (err, rows) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Failed to fetch history.' });
            }
            if (rows.length === 0) {
                return res.status(404).json({ error: 'No history found for the student.' });
            }
            res.json({ history: rows });
        });
    });
});


module.exports = router;
