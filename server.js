const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const EXERCISES_FILE = process.env.EXERCISES_FILE || path.join(__dirname, 'exercises.json');

// Logging utility
const logger = {
  formatTimestamp: () => new Date().toISOString(),

  info: (message, data = {}) => {
    console.log(`[${logger.formatTimestamp()}] [INFO] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data) : '');
  },

  error: (message, error = null) => {
    const errorDetails = error ? {
      message: error.message,
      stack: error.stack
    } : {};
    console.error(`[${logger.formatTimestamp()}] [ERROR] ${message}`, error ? JSON.stringify(errorDetails) : '');
  },

  warn: (message, data = {}) => {
    console.warn(`[${logger.formatTimestamp()}] [WARN] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data) : '');
  },

  debug: (message, data = {}) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[${logger.formatTimestamp()}] [DEBUG] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data) : '');
    }
  }
};

app.use(bodyParser.json());
app.use(express.static(__dirname));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress
    });
  });
  next();
});

// Initialize exercises file if it doesn't exist
async function initExercisesFile() {
  try {
    await fs.access(EXERCISES_FILE);
    logger.info('Exercises file found', { path: EXERCISES_FILE });

    // Log current exercise count
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const exercises = JSON.parse(data);
    logger.info('Loaded exercises from file', { count: exercises.length });
  } catch {
    logger.info('Exercises file not found, creating new file', { path: EXERCISES_FILE });

    // Ensure directory exists
    const dir = path.dirname(EXERCISES_FILE);
    try {
      await fs.mkdir(dir, { recursive: true });
      logger.debug('Created directory', { path: dir });
    } catch (error) {
      // Directory might already exist, ignore error
      logger.debug('Directory already exists or creation failed', { path: dir, error: error.message });
    }

    await fs.writeFile(EXERCISES_FILE, JSON.stringify([], null, 2));
    logger.info('Created new exercises file', { path: EXERCISES_FILE });
  }
}

// Get all exercises
app.get('/api/exercises', async (req, res) => {
  try {
    logger.debug('Reading exercises from file', { path: EXERCISES_FILE });
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const exercises = JSON.parse(data);
    logger.info('Retrieved exercises', { count: exercises.length });
    res.json(exercises);
  } catch (error) {
    logger.error('Failed to read exercises', error);
    res.status(500).json({ error: 'Failed to read exercises' });
  }
});

// Add a new exercise
app.post('/api/exercises', async (req, res) => {
  try {
    const { name } = req.body;
    logger.debug('Add exercise request', { name: name });

    if (!name || name.trim() === '') {
      logger.warn('Add exercise failed: empty name');
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    const trimmedName = name.trim();
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const exercises = JSON.parse(data);

    // Check for duplicates
    if (exercises.some(ex => ex.name.toLowerCase() === trimmedName.toLowerCase())) {
      logger.warn('Add exercise failed: duplicate', { name: trimmedName });
      return res.status(400).json({ error: 'Exercise already exists' });
    }

    exercises.push({ name: trimmedName });
    await fs.writeFile(EXERCISES_FILE, JSON.stringify(exercises, null, 2));
    logger.info('Exercise added successfully', { name: trimmedName, totalCount: exercises.length });
    res.json(exercises);
  } catch (error) {
    logger.error('Failed to add exercise', error);
    res.status(500).json({ error: 'Failed to add exercise' });
  }
});

// Delete an exercise
app.delete('/api/exercises/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);
    logger.debug('Delete exercise request', { name: decodedName });

    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const exercises = JSON.parse(data);
    const initialCount = exercises.length;

    const filtered = exercises.filter(ex => ex.name !== decodedName);

    if (filtered.length === initialCount) {
      logger.warn('Delete exercise failed: not found', { name: decodedName });
      return res.status(404).json({ error: 'Exercise not found' });
    }

    await fs.writeFile(EXERCISES_FILE, JSON.stringify(filtered, null, 2));
    logger.info('Exercise deleted successfully', { name: decodedName, remainingCount: filtered.length });
    res.json(filtered);
  } catch (error) {
    logger.error('Failed to delete exercise', error);
    res.status(500).json({ error: 'Failed to delete exercise' });
  }
});

// Start server
initExercisesFile().then(() => {
  app.listen(PORT, () => {
    logger.info('Exercise tracker server started', {
      port: PORT,
      exercisesFile: EXERCISES_FILE,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    });
    logger.info(`Server listening at http://0.0.0.0:${PORT}`);
  });
}).catch((error) => {
  logger.error('Failed to initialize server', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

