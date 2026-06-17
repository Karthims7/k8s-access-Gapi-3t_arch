const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database configuration from environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'tasks_db',
});

// Helper function to query with automatic schema initialization retry
let dbReady = false;
async function initDb() {
  let retries = 5;
  while (retries > 0) {
    try {
      console.log('Attempting to connect to database...');
      // Test the connection
      await pool.query('SELECT 1');
      
      // Initialize schema
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          completed BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Database successfully connected and schema initialized.');
      dbReady = true;
      break;
    } catch (err) {
      console.error(`Database connection failed. Retries left: ${retries - 1}. Error:`, err.message);
      retries -= 1;
      // Wait 3 seconds before retrying
      await new Promise(res => setTimeout(res, 3000));
    }
  }
}

initDb();

// Health Check Endpoint
app.get('/health', (req, res) => {
  if (dbReady) {
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } else {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query error' });
  }
});

// POST a new task
app.post('/api/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insertion error' });
  }
});

// DELETE a task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully', task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database deletion error' });
  }
});

// PUT (update) a task
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, completed } = req.body;
  
  if (title === undefined && completed === undefined) {
    return res.status(400).json({ error: 'At least one field (title or completed) is required to update' });
  }

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(title);
    }
    if (completed !== undefined) {
      fields.push(`completed = $${idx++}`);
      values.push(completed);
    }

    values.push(id);
    const queryText = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    
    const result = await pool.query(queryText, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update error' });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
