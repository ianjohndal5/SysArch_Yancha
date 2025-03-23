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
    console.log('Session Connected To Database');
});

// Fetch all student_sessions
router.get('/student_sessions', (req, res) => {
    const query = 'SELECT * FROM student_sessions';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

router.get('/student_session', (req, res) => {
    const query = 'SELECT purpose, labroom, COUNT(*) as count FROM student_sessions GROUP BY purpose, labroom';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});


router.get('/session_records', (req, res) => {
    const query = 'SELECT * FROM session_records';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

router.get('/report', (req, res) => {
    const query = 'SELECT * FROM report';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Search student by idno
router.get('/student/:idno', (req, res) => {
    const idno = req.params.idno;
    console.log('Received idno:', idno);

    const query = 'SELECT * FROM students WHERE idno = ?';
    db.get(query, [idno], (err, row) => {
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

router.delete('/delete/:idno', (req, res) => {
    const idno = parseInt(req.params.idno); // Ensure idno is an integer

    const selectQuery = 'SELECT * FROM student_sessions WHERE idno = ? AND status = "Active"';
    db.get(selectQuery, [idno], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'An error occurred while processing your request.' });
        }
        if (row) {
            // Check if ID number matches
            if (idno === row.idno) {
                const now = new Date();
                const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); // Example: "10:00 PM"
                const formattedDate = now.toISOString().split('T')[0]; // Example: "2025-02-03"

                const labroom = row.labroom; // Capture the labroom for the history table
                const studentQuery = 'SELECT * FROM students WHERE idno = ?';

                db.get(studentQuery, [idno], (err, student) => {
                    if (err) {
                        console.error('Database error:', err.message);
                        return res.status(500).json({ error: err.message });
                    }
                    if (!student) {
                        return res.status(404).json({ message: 'Student not found' });
                    }

                    // Update logout_time in session_records table
                    const updateSessionRecordsQuery = 'UPDATE session_records SET logout_time = ? WHERE sit_id = ?';
                    db.run(updateSessionRecordsQuery, [`${formattedTime}`, row.sit_id], (err) => {
                        if (err) {
                            console.error('Database error:', err.message);
                            return res.status(500).json({ error: 'An error occurred while updating session records.' });
                        }

                        // Insert into history table
                        const historyInsertQuery = `INSERT INTO history (idno, name, sitpurpose, lab, login_time, logout_time, date) 
                                                    VALUES (?, ?, ?, ?, ?, ?, ?)`;
                        db.run(historyInsertQuery, [idno, student.firstname + ' ' + student.lastname, row.purpose, labroom, row.login_time, `${formattedTime}`, formattedDate], (err) => {
                            if (err) {
                                console.error('Database error:', err.message);
                                return res.status(500).json({ error: 'An error occurred while inserting into history table.' });
                            }

                            // Update logout_time and status in student_sessions
                            const updateSessionQuery = 'UPDATE student_sessions SET logout_time = ?, status = "Inactive" WHERE idno = ? AND status = "Active"';
                            db.run(updateSessionQuery, [`${formattedDate} ${formattedTime}`, idno], (err) => {
                                if (err) {
                                    console.error('Database error:', err.message);
                                    return res.status(500).json({ error: 'An error occurred while updating the session.' });
                                }

                                // Decrease the student's session value by 1
                                const sessionValue = student.session_value - 1;
                                const updateStudentSessionQuery = 'UPDATE students SET session_value = ? WHERE idno = ?';

                                db.run(updateStudentSessionQuery, [sessionValue, idno], (err) => {
                                    if (err) {
                                        console.error('Database error:', err.message);
                                        return res.status(500).json({ error: 'An error occurred while updating the student\'s session value.' });
                                    }

                                    // Delete the inactive session
                                    const removeQuery = 'DELETE FROM student_sessions WHERE idno = ? AND status = "Inactive"';
                                    db.run(removeQuery, [idno], (err) => {
                                        if (err) {
                                            console.error('Database error:', err.message);
                                            return res.status(500).json({ error: 'An error occurred while deleting the session.' });
                                        }
                                        res.json({ message: `Session deleted successfully. Remaining sessions: ${sessionValue}` });
                                    });
                                });
                            });
                        });
                    });
                });
            } else {
                res.status(401).json({ message: 'Delete failed: ID number mismatch.' });
            }
        } else {
            res.status(404).json({ message: 'Delete failed: Session not found.' });
        }
    });
});

router.post('/settle', (req, res) => {
    const { idno, purpose, labroom } = req.body;
    console.log('Received session details:', { idno, purpose, labroom });

    const studentQuery = 'SELECT * FROM students WHERE idno = ?';
    db.get(studentQuery, [idno], (err, student) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Check if the student has sessions left
        if (student.session_value <= 0) {
            return res.status(400).json({ success: false, message: 'Student has no remaining sessions and cannot settle.' });
        }

        // Check if the student already has an active session
        const checkSessionQuery = 'SELECT * FROM student_sessions WHERE idno = ? AND status = "Active"';
        db.get(checkSessionQuery, [idno], (err, row) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ success: false, error: err.message });
            }
            if (row) {
                return res.status(400).json({ success: false, message: 'Student already has an active session and cannot settle another sit-in.' });
            } else {
                // If no active session, proceed with inserting a new session
                const name = `${student.firstname} ${student.lastname}`;
                const now = new Date();
                const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                const formattedDate = now.toISOString().split('T')[0];

                const insertQuery = `INSERT INTO student_sessions (idno, name, purpose, labroom, session, status, login_time, day) 
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                db.run(insertQuery, [idno, name, purpose, labroom, student.session_value, 'Active', formattedTime, formattedDate], function(err) {
                    if (err) {
                        console.error('Database error:', err.message);
                        return res.status(500).json({ success: false, error: err.message });
                    }
                    const insertSessionRecordQuery = `INSERT INTO session_records (sit_id, idno, name, purpose, labroom, login_time, logout_time, date_inserted) 
                                                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                    db.run(insertSessionRecordQuery, [this.lastID, idno, name, purpose, labroom, formattedTime, 'Active', formattedDate], (err) => {
                        if (err) {
                            console.error('Database error:', err.message);
                            return res.status(500).json({ success: false, error: err.message });
                        }
                        res.json({ success: true, message: 'Student settled successfully', sessionValue: student.session_value });
                    });
                });
            }
        });
    });
});



router.get('/statistics', (req, res) => {
    const studentCountQuery = 'SELECT COUNT(*) AS count FROM students';
    const sitInCountQuery = 'SELECT COUNT(*) AS count FROM student_sessions WHERE status = "Active"';
    const totalSitInsQuery = 'SELECT COUNT(*) AS count FROM session_records';

    db.get(studentCountQuery, [], (err, studentCountRow) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        db.get(sitInCountQuery, [], (err, sitInCountRow) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: err.message });
            }
            db.get(totalSitInsQuery, [], (err, totalSitInsRow) => {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({
                    studentCount: studentCountRow.count,
                    sitInCount: sitInCountRow.count,
                    totalSitIns: totalSitInsRow.count
                });
            });
        });
    });
});

router.post('/reset-sessions', (req, res) => {
    const resetQuery = 'UPDATE students SET session_value = 30';
    db.run(resetQuery, function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to reset sessions.' });
        }
        res.json({ success: true, message: 'All students\' sessions have been reset to 30.' });
    });
});


module.exports = router;
