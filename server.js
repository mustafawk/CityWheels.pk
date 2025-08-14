require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// SUPPORT REQUEST ENDPOINTS
// =============================================

app.post('/api/support', async (req, res) => {
  try {
    const { S_ID, SubmittedBy, IssueType, IssueDesc, IssueStatus, D_ID, P_ID } = req.body;

    // Validate required fields
    if (!S_ID || !SubmittedBy || !IssueType || !IssueDesc || !IssueStatus) {
      return res.status(400).json({ error: 'All fields except D_ID and P_ID are required' });
    }

    // Validate numeric fields
    if (isNaN(S_ID)) return res.status(400).json({ error: 'Support ID must be a number' });
    if (D_ID && isNaN(D_ID)) return res.status(400).json({ error: 'Driver ID must be a number if provided' });
    if (P_ID && isNaN(P_ID)) return res.status(400).json({ error: 'Passenger ID must be a number if provided' });

    // Check if support ID exists
    const [existing] = await pool.execute('SELECT S_ID FROM SupportReq WHERE S_ID = ?', [S_ID]);
    if (existing.length > 0) return res.status(409).json({ error: 'Support ID exists' });

    // Check if driver exists if provided
    if (D_ID) {
      const [driver] = await pool.execute('SELECT D_ID FROM Driver WHERE D_ID = ?', [D_ID]);
      if (driver.length === 0) return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if passenger exists if provided
    if (P_ID) {
      const [passenger] = await pool.execute('SELECT P_ID FROM Passenger WHERE P_ID = ?', [P_ID]);
      if (passenger.length === 0) return res.status(404).json({ error: 'Passenger not found' });
    }

    // Insert new support request
    await pool.execute(
      `INSERT INTO SupportReq (S_ID, SubmittedBy, IssueType, IssueDesc, IssueStatus, D_ID, P_ID) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [S_ID, SubmittedBy, IssueType, IssueDesc, IssueStatus, D_ID || null, P_ID || null]
    );

    res.status(201).json({ 
      message: 'Support request submitted successfully',
      supportId: S_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/support', async (req, res) => {
  try {
    const [requests] = await pool.query(`
      SELECT s.*, 
             d.dname as DriverName,
             p.pname as PassengerName
      FROM SupportReq s
      LEFT JOIN Driver d ON s.D_ID = d.D_ID
      LEFT JOIN Passenger p ON s.P_ID = p.P_ID
      ORDER BY s.S_ID DESC
    `);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching support requests:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/support/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [request] = await pool.execute(`
      SELECT s.*, 
             d.dname as DriverName,
             p.pname as PassengerName
      FROM SupportReq s
      LEFT JOIN Driver d ON s.D_ID = d.D_ID
      LEFT JOIN Passenger p ON s.P_ID = p.P_ID
      WHERE s.S_ID = ?
    `, [id]);

    if (request.length === 0) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    res.json(request[0]);
  } catch (error) {
    console.error('Error fetching support request:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// MAINTENANCE ENDPOINTS
// =============================================

app.post('/api/maintenance', async (req, res) => {
  try {
    const { M_ID, V_ID, Description, DatePerformed, Cost, Statuss } = req.body;

    // Validate required fields
    if (!M_ID || !V_ID || !Description || !DatePerformed || Cost === undefined || !Statuss) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate numeric fields
    if (isNaN(M_ID)) return res.status(400).json({ error: 'Maintenance ID must be a number' });
    if (isNaN(V_ID)) return res.status(400).json({ error: 'Vehicle ID must be a number' });
    if (isNaN(Cost) || Cost < 0) return res.status(400).json({ error: 'Cost must be a positive number' });

    // Check if maintenance ID exists
    const [existing] = await pool.execute('SELECT M_ID FROM Maintenance WHERE M_ID = ?', [M_ID]);
    if (existing.length > 0) return res.status(409).json({ error: 'Maintenance ID exists' });

    // Check if vehicle exists
    const [vehicle] = await pool.execute('SELECT V_ID FROM Vehicle WHERE V_ID = ?', [V_ID]);
    if (vehicle.length === 0) return res.status(404).json({ error: 'Vehicle not found' });

    // Insert new maintenance record
    await pool.execute(
      `INSERT INTO Maintenance (M_ID, V_ID, Description, DatePerformed, Cost, Statuss) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [M_ID, V_ID, Description, DatePerformed, Cost, Statuss]
    );

    res.status(201).json({ 
      message: 'Maintenance record created successfully',
      maintenanceId: M_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/maintenance', async (req, res) => {
  try {
    const [maintenance] = await pool.query(`
      SELECT m.*, v.vtype as VehicleType, v.LicencePlate
      FROM Maintenance m
      LEFT JOIN Vehicle v ON m.V_ID = v.V_ID
      ORDER BY m.DatePerformed DESC
    `);
    res.json(maintenance);
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [record] = await pool.execute(`
      SELECT m.*, v.vtype as VehicleType, v.LicencePlate
      FROM Maintenance m
      LEFT JOIN Vehicle v ON m.V_ID = v.V_ID
      WHERE m.M_ID = ?
    `, [id]);

    if (record.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    res.json(record[0]);
  } catch (error) {
    console.error('Error fetching maintenance record:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// SCHEDULE ENDPOINTS
// =============================================

app.post('/api/schedules', async (req, res) => {
  try {
    const { Sch_ID, D_ID, V_ID, StartTime, EndTime, Statuss } = req.body;

    // Validate required fields
    if (!Sch_ID || !D_ID || !V_ID || !StartTime || !EndTime || !Statuss) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate numeric fields
    if (isNaN(Sch_ID)) return res.status(400).json({ error: 'Schedule ID must be a number' });
    if (isNaN(D_ID)) return res.status(400).json({ error: 'Driver ID must be a number' });
    if (isNaN(V_ID)) return res.status(400).json({ error: 'Vehicle ID must be a number' });

    // Check if schedule ID exists
    const [existing] = await pool.execute('SELECT Sch_ID FROM Schedule WHERE Sch_ID = ?', [Sch_ID]);
    if (existing.length > 0) return res.status(409).json({ error: 'Schedule ID exists' });

    // Check if driver exists
    const [driver] = await pool.execute('SELECT D_ID FROM Driver WHERE D_ID = ?', [D_ID]);
    if (driver.length === 0) return res.status(404).json({ error: 'Driver not found' });

    // Check if vehicle exists
    const [vehicle] = await pool.execute('SELECT V_ID FROM Vehicle WHERE V_ID = ?', [V_ID]);
    if (vehicle.length === 0) return res.status(404).json({ error: 'Vehicle not found' });

    // Validate time range
    if (new Date(StartTime) >= new Date(EndTime)) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Insert new schedule
    await pool.execute(
      `INSERT INTO Schedule (Sch_ID, D_ID, V_ID, StartTime, EndTime, Statuss) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Sch_ID, D_ID, V_ID, StartTime, EndTime, Statuss]
    );

    res.status(201).json({ 
      message: 'Schedule created successfully',
      scheduleId: Sch_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/schedules', async (req, res) => {
  try {
    const [schedules] = await pool.query(`
      SELECT s.*, 
             d.dname as DriverName,
             v.vtype as VehicleType, v.LicencePlate
      FROM Schedule s
      LEFT JOIN Driver d ON s.D_ID = d.D_ID
      LEFT JOIN Vehicle v ON s.V_ID = v.V_ID
      ORDER BY s.StartTime DESC
    `);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [schedule] = await pool.execute(`
      SELECT s.*, 
             d.dname as DriverName,
             v.vtype as VehicleType, v.LicencePlate
      FROM Schedule s
      LEFT JOIN Driver d ON s.D_ID = d.D_ID
      LEFT JOIN Vehicle v ON s.V_ID = v.V_ID
      WHERE s.Sch_ID = ?
    `, [id]);

    if (schedule.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(schedule[0]);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// DRIVER ENDPOINTS
// =============================================

app.post('/api/drivers', async (req, res) => {
  try {
    const { D_ID, dname, contactnum, insuranceDoc, PaymentMethod, Statuss, LicenceNumber } = req.body;

    if (!D_ID || !dname || !contactnum || !insuranceDoc || !PaymentMethod || Statuss === undefined || !LicenceNumber) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (isNaN(D_ID)) return res.status(400).json({ error: 'Driver ID must be a number' });
    if (isNaN(contactnum)) return res.status(400).json({ error: 'Contact number must be a number' });
    if (isNaN(Statuss)) return res.status(400).json({ error: 'Status must be a number (0 or 1)' });
    if (isNaN(LicenceNumber)) return res.status(400).json({ error: 'Licence number must be a number' });

    const [existing] = await pool.execute('SELECT D_ID FROM Driver WHERE D_ID = ?', [D_ID]);
    if (existing.length > 0) return res.status(409).json({ error: 'Driver ID exists' });

    await pool.execute(
      `INSERT INTO Driver (D_ID, dname, contactnum, insuranceDoc, PaymentMethod, Statuss, LicenceNumber) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [D_ID, dname, contactnum, insuranceDoc, PaymentMethod, Statuss, LicenceNumber]
    );

    res.status(201).json({ message: 'Driver registered', driverId: D_ID });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

app.get('/api/drivers', async (req, res) => {
  try {
    const [drivers] = await pool.query('SELECT * FROM Driver');
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [driver] = await pool.execute('SELECT * FROM Driver WHERE D_ID = ?', [id]);

    if (driver.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(driver[0]);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// PASSENGER ENDPOINTS
// =============================================

app.post('/api/passengers', async (req, res) => {
  try {
    const { P_ID, pname, contactnum, CreditCardInfo } = req.body;

    if (!P_ID || !pname || !contactnum || !CreditCardInfo) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (isNaN(P_ID)) return res.status(400).json({ error: 'Passenger ID must be a number' });
    if (isNaN(contactnum)) return res.status(400).json({ error: 'Contact number must be a number' });

    const [existing] = await pool.execute('SELECT P_ID FROM Passenger WHERE P_ID = ?', [P_ID]);
    if (existing.length > 0) return res.status(409).json({ error: 'Passenger ID exists' });

    await pool.execute(
      `INSERT INTO Passenger (P_ID, pname, contactnum, CreditCardInfo) 
       VALUES (?, ?, ?, ?)`,
      [P_ID, pname, contactnum, CreditCardInfo]
    );

    res.status(201).json({ 
      message: 'Passenger registered successfully',
      passengerId: P_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/passengers', async (req, res) => {
  try {
    const [passengers] = await pool.query('SELECT * FROM Passenger');
    res.json(passengers);
  } catch (error) {
    console.error('Error fetching passengers:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/passengers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [passenger] = await pool.execute('SELECT * FROM Passenger WHERE P_ID = ?', [id]);

    if (passenger.length === 0) {
      return res.status(404).json({ error: 'Passenger not found' });
    }

    res.json(passenger[0]);
  } catch (error) {
    console.error('Error fetching passenger:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// VEHICLE ENDPOINTS
// =============================================

app.post('/api/vehicles', async (req, res) => {
  try {
    const { V_ID, vtype, LicencePlate, MaintenanceStat, ChildSeat } = req.body;

    if (!V_ID || !vtype || !LicencePlate || !MaintenanceStat || ChildSeat === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (isNaN(V_ID)) return res.status(400).json({ error: 'Vehicle ID must be a number' });
    if (isNaN(ChildSeat)) return res.status(400).json({ error: 'Child seat must be a number' });

    const [existing] = await pool.execute('SELECT V_ID FROM Vehicle WHERE V_ID = ?', [V_ID]);
    if (existing.length > 0) return res.status(409).json({ error: 'Vehicle ID exists' });

    await pool.execute(
      `INSERT INTO Vehicle (V_ID, vtype, LicencePlate, MaintenanceStat, ChildSeat) 
       VALUES (?, ?, ?, ?, ?)`,
      [V_ID, vtype, LicencePlate, MaintenanceStat, ChildSeat]
    );

    res.status(201).json({ 
      message: 'Vehicle registered successfully',
      vehicleId: V_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/vehicles', async (req, res) => {
  try {
    const [vehicles] = await pool.query('SELECT * FROM Vehicle');
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [vehicle] = await pool.execute('SELECT * FROM Vehicle WHERE V_ID = ?', [id]);

    if (vehicle.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(vehicle[0]);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// FEEDBACK ENDPOINTS
// =============================================

app.post('/api/feedback', async (req, res) => {
  try {
    const { F_ID, Rating, Comment, SubmittedTo, SubmittedBy, P_ID, D_ID } = req.body;

    // Validate required fields
    if (!F_ID || Rating === undefined || !SubmittedTo || !SubmittedBy || !P_ID || !D_ID) {
      return res.status(400).json({ error: 'All fields except Comment are required' });
    }

    // Validate numeric fields
    if (isNaN(F_ID)) return res.status(400).json({ error: 'Feedback ID must be a number' });
    if (isNaN(Rating) || Rating < 1 || Rating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }
    if (isNaN(P_ID)) return res.status(400).json({ error: 'Passenger ID must be a number' });
    if (isNaN(D_ID)) return res.status(400).json({ error: 'Driver ID must be a number' });

    // Check if feedback ID exists
    const [existingFeedback] = await pool.execute('SELECT F_ID FROM Feedback WHERE F_ID = ?', [F_ID]);
    if (existingFeedback.length > 0) return res.status(409).json({ error: 'Feedback ID exists' });

    // Check if passenger exists
    const [existingPassenger] = await pool.execute('SELECT P_ID FROM Passenger WHERE P_ID = ?', [P_ID]);
    if (existingPassenger.length === 0) return res.status(404).json({ error: 'Passenger not found' });

    // Check if driver exists
    const [existingDriver] = await pool.execute('SELECT D_ID FROM Driver WHERE D_ID = ?', [D_ID]);
    if (existingDriver.length === 0) return res.status(404).json({ error: 'Driver not found' });

    // Insert new feedback
    await pool.execute(
      `INSERT INTO Feedback (F_ID, Rating, Comment, SubmittedTo, SubmittedBy, P_ID, D_ID) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [F_ID, Rating, Comment || null, SubmittedTo, SubmittedBy, P_ID, D_ID]
    );

    res.status(201).json({ 
      message: 'Feedback submitted successfully',
      feedbackId: F_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/feedback', async (req, res) => {
  try {
    const [feedback] = await pool.query(`
      SELECT f.*, p.pname as PassengerName, d.dname as DriverName 
      FROM Feedback f
      LEFT JOIN Passenger p ON f.P_ID = p.P_ID
      LEFT JOIN Driver d ON f.D_ID = d.D_ID
    `);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [feedback] = await pool.execute(`
      SELECT f.*, p.pname as PassengerName, d.dname as DriverName 
      FROM Feedback f
      LEFT JOIN Passenger p ON f.P_ID = p.P_ID
      LEFT JOIN Driver d ON f.D_ID = d.D_ID
      WHERE f.F_ID = ?
    `, [id]);

    if (feedback.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json(feedback[0]);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// RIDE ENDPOINTS
// =============================================

app.post('/api/rides', async (req, res) => {
  try {
    const { Ride_ID, PickupLocation, Dropoff, TimeStamp, Statuss, V_ID, D_ID, P_ID, F_ID } = req.body;

    // Validate required fields
    if (!Ride_ID || !PickupLocation || !Dropoff || !TimeStamp || Statuss === undefined || !V_ID || !D_ID || !P_ID) {
      return res.status(400).json({ error: 'All fields except F_ID are required' });
    }

    // Validate numeric fields
    if (isNaN(Ride_ID)) return res.status(400).json({ error: 'Ride ID must be a number' });
    if (isNaN(Statuss)) return res.status(400).json({ error: 'Status must be a number' });
    if (isNaN(V_ID)) return res.status(400).json({ error: 'Vehicle ID must be a number' });
    if (isNaN(D_ID)) return res.status(400).json({ error: 'Driver ID must be a number' });
    if (isNaN(P_ID)) return res.status(400).json({ error: 'Passenger ID must be a number' });
    if (F_ID && isNaN(F_ID)) return res.status(400).json({ error: 'Feedback ID must be a number if provided' });

    // Check if ride ID exists
    const [existingRide] = await pool.execute('SELECT Ride_ID FROM Ride WHERE Ride_ID = ?', [Ride_ID]);
    if (existingRide.length > 0) return res.status(409).json({ error: 'Ride ID exists' });

    // Check if vehicle exists
    const [existingVehicle] = await pool.execute('SELECT V_ID FROM Vehicle WHERE V_ID = ?', [V_ID]);
    if (existingVehicle.length === 0) return res.status(404).json({ error: 'Vehicle not found' });

    // Check if driver exists
    const [existingDriver] = await pool.execute('SELECT D_ID FROM Driver WHERE D_ID = ?', [D_ID]);
    if (existingDriver.length === 0) return res.status(404).json({ error: 'Driver not found' });

    // Check if passenger exists
    const [existingPassenger] = await pool.execute('SELECT P_ID FROM Passenger WHERE P_ID = ?', [P_ID]);
    if (existingPassenger.length === 0) return res.status(404).json({ error: 'Passenger not found' });

    // Check if feedback exists if provided
    if (F_ID) {
      const [existingFeedback] = await pool.execute('SELECT F_ID FROM Feedback WHERE F_ID = ?', [F_ID]);
      if (existingFeedback.length === 0) return res.status(404).json({ error: 'Feedback not found' });
    }

    // Insert new ride
    await pool.execute(
      `INSERT INTO Ride (Ride_ID, PickupLocation, Dropoff, TimeStamp, Statuss, V_ID, D_ID, P_ID, F_ID) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Ride_ID, PickupLocation, Dropoff, TimeStamp, Statuss, V_ID, D_ID, P_ID, F_ID || null]
    );

    res.status(201).json({ 
      message: 'Ride created successfully',
      rideId: Ride_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/rides', async (req, res) => {
  try {
    const [rides] = await pool.query(`
      SELECT r.*, 
             v.vtype as VehicleType, v.LicencePlate,
             d.dname as DriverName,
             p.pname as PassengerName,
             f.Rating as FeedbackRating
      FROM Ride r
      LEFT JOIN Vehicle v ON r.V_ID = v.V_ID
      LEFT JOIN Driver d ON r.D_ID = d.D_ID
      LEFT JOIN Passenger p ON r.P_ID = p.P_ID
      LEFT JOIN Feedback f ON r.F_ID = f.F_ID
      ORDER BY r.TimeStamp DESC
    `);
    res.json(rides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/rides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [ride] = await pool.execute(`
      SELECT r.*, 
             v.vtype as VehicleType, v.LicencePlate,
             d.dname as DriverName,
             p.pname as PassengerName,
             f.Rating as FeedbackRating
      FROM Ride r
      LEFT JOIN Vehicle v ON r.V_ID = v.V_ID
      LEFT JOIN Driver d ON r.D_ID = d.D_ID
      LEFT JOIN Passenger p ON r.P_ID = p.P_ID
      LEFT JOIN Feedback f ON r.F_ID = f.F_ID
      WHERE r.Ride_ID = ?
    `, [id]);

    if (ride.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json(ride[0]);
  } catch (error) {
    console.error('Error fetching ride:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// PROMOTION ENDPOINTS
// =============================================

app.post('/api/promotions', async (req, res) => {
  try {
    const { P_Code, PDescription, Percentage, Startt, Endd, Statuss } = req.body;
    if (!P_Code || !PDescription || Percentage === undefined || !Startt || !Endd || Statuss === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const [existing] = await pool.execute('SELECT P_Code FROM Promotion WHERE P_Code = ?', [P_Code]);
    if (existing.length > 0) return res.status(409).json({ error: 'Promotion code exists' });

    await pool.execute(
      `INSERT INTO Promotion (P_Code, PDescription, Percentage, Startt, Endd, Statuss) VALUES (?, ?, ?, ?, ?, ?)`,
      [P_Code, PDescription, Percentage, Startt, Endd, Statuss]
    );

    res.status(201).json({ message: 'Promotion created', promotionCode: P_Code });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/promotions', async (req, res) => {
  try {
    const [promotions] = await pool.query('SELECT * FROM Promotion ORDER BY Startt DESC');
    res.json(promotions);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/promotions/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const [promotion] = await pool.execute('SELECT * FROM Promotion WHERE P_Code = ?', [code]);

    if (promotion.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json(promotion[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// PAYMENT ENDPOINTS
// =============================================

app.post('/api/payments', async (req, res) => {
  try {
    const { Payment_ID, Amount, PaymentMethod, Statuss, TimeStamp, PromoUsed, P_ID, Ride_ID } = req.body;

    // Validate required fields
    if (!Payment_ID || Amount === undefined || !PaymentMethod || Statuss === undefined || !TimeStamp || !P_ID || !Ride_ID) {
      return res.status(400).json({ error: 'All fields except PromoUsed are required' });
    }

    // Validate numeric fields
    if (isNaN(Payment_ID)) return res.status(400).json({ error: 'Payment ID must be a number' });
    if (isNaN(Amount) || Amount <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    if (isNaN(Statuss)) return res.status(400).json({ error: 'Status must be a number' });
    if (isNaN(P_ID)) return res.status(400).json({ error: 'Passenger ID must be a number' });
    if (isNaN(Ride_ID)) return res.status(400).json({ error: 'Ride ID must be a number' });

    // Check if payment exists
    const [existing] = await pool.execute('SELECT Payment_ID FROM Payment WHERE Payment_ID = ?', [Payment_ID]);
    if (existing.length > 0) return res.status(409).json({ error: 'Payment ID exists' });

    // Check if passenger exists
    const [passenger] = await pool.execute('SELECT P_ID FROM Passenger WHERE P_ID = ?', [P_ID]);
    if (passenger.length === 0) return res.status(404).json({ error: 'Passenger not found' });

    // Check if ride exists
    const [ride] = await pool.execute('SELECT Ride_ID FROM Ride WHERE Ride_ID = ?', [Ride_ID]);
    if (ride.length === 0) return res.status(404).json({ error: 'Ride not found' });

    // Check if promotion exists if provided
    if (PromoUsed) {
      const [promo] = await pool.execute('SELECT P_Code FROM Promotion WHERE P_Code = ?', [PromoUsed]);
      if (promo.length === 0) return res.status(404).json({ error: 'Promotion code not found' });
    }

    // Insert new payment
    await pool.execute(
      `INSERT INTO Payment (Payment_ID, Amount, PaymentMethod, Statuss, TimeStamp, PromoUsed, P_ID, Ride_ID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [Payment_ID, Amount, PaymentMethod, Statuss, TimeStamp, PromoUsed || null, P_ID, Ride_ID]
    );

    res.status(201).json({ 
      message: 'Payment processed successfully',
      paymentId: Payment_ID 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message 
    });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT p.*, ps.pname as PassengerName, r.PickupLocation, r.Dropoff
      FROM Payment p
      LEFT JOIN Passenger ps ON p.P_ID = ps.P_ID
      LEFT JOIN Ride r ON p.Ride_ID = r.Ride_ID
      ORDER BY p.TimeStamp DESC
    `);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [payment] = await pool.execute(`
      SELECT p.*, ps.pname as PassengerName, r.PickupLocation, r.Dropoff
      FROM Payment p
      LEFT JOIN Passenger ps ON p.P_ID = ps.P_ID
      LEFT JOIN Ride r ON p.Ride_ID = r.Ride_ID
      WHERE p.Payment_ID = ?
    `, [id]);

    if (payment.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment[0]);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =============================================
// HTML ROUTES
// =============================================

// Serve index.html at root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve all other HTML files
const htmlRoutes = [
  'support', 'maintenance', 'schedule', 'passenger', 
  'driver', 'vehicle', 'feedback', 'ride', 
  'promotion', 'payment'
];

htmlRoutes.forEach(route => {
  app.get(`/${route}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${route}.html`));
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

