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

// Helper function to normalize data format (migrate old array format to new sections format)
function normalizeData(data) {
  const parsed = JSON.parse(data);
  return Array.isArray(parsed) ? { 'General': parsed } : parsed;
}

// Initialize exercises file if it doesn't exist
async function initExercisesFile() {
  try {
    await fs.access(EXERCISES_FILE);
    logger.info('Exercises file found', { path: EXERCISES_FILE });

    // Log current exercise count
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const exercisesData = JSON.parse(data);

    // Migrate old format (array) to new format (object with sections)
    if (Array.isArray(exercisesData)) {
      logger.info('Migrating old data format to sections format');
      const migratedData = { 'General': exercisesData };
      await fs.writeFile(EXERCISES_FILE, JSON.stringify(migratedData, null, 2));
      logger.info('Migration complete', { sections: Object.keys(migratedData).length });
    } else {
      const totalExercises = Object.values(exercisesData).reduce((sum, ex) => sum + ex.length, 0);
      logger.info('Loaded exercises from file', { sections: Object.keys(exercisesData).length, totalExercises });
    }
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

    // Initialize with default "General" section
    const initialData = { 'General': [] };
    await fs.writeFile(EXERCISES_FILE, JSON.stringify(initialData, null, 2));
    logger.info('Created new exercises file', { path: EXERCISES_FILE });
  }
}

// Get all exercises organized by sections
app.get('/api/exercises', async (req, res) => {
  try {
    logger.debug('Reading exercises from file', { path: EXERCISES_FILE });
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const exercisesData = JSON.parse(data);

    // Ensure it's in the new format
    const sections = Array.isArray(exercisesData) ? { 'General': exercisesData } : exercisesData;

    const totalExercises = Object.values(sections).reduce((sum, ex) => sum + ex.length, 0);
    logger.info('Retrieved exercises', { sections: Object.keys(sections).length, totalExercises });
    res.json(sections);
  } catch (error) {
    logger.error('Failed to read exercises', error);
    res.status(500).json({ error: 'Failed to read exercises' });
  }
});

// Add a new exercise to a section
app.post('/api/exercises', async (req, res) => {
  try {
    const { name, section } = req.body;
    logger.debug('Add exercise request', { name: name, section: section });

    if (!name || name.trim() === '') {
      logger.warn('Add exercise failed: empty name');
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    if (!section || section.trim() === '') {
      logger.warn('Add exercise failed: empty section');
      return res.status(400).json({ error: 'Section name is required' });
    }

    const trimmedName = name.trim();
    const trimmedSection = section.trim();
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const sections = normalizeData(data);

    // Ensure section exists
    if (!sections[trimmedSection]) {
      logger.warn('Add exercise failed: section not found', { section: trimmedSection });
      return res.status(404).json({ error: 'Section not found' });
    }

    // Check for duplicates within the section
    if (sections[trimmedSection].some(ex => ex.name.toLowerCase() === trimmedName.toLowerCase())) {
      logger.warn('Add exercise failed: duplicate', { name: trimmedName, section: trimmedSection });
      return res.status(400).json({ error: 'Exercise already exists in this section' });
    }

    sections[trimmedSection].push({ name: trimmedName });
    await fs.writeFile(EXERCISES_FILE, JSON.stringify(sections, null, 2));
    logger.info('Exercise added successfully', { name: trimmedName, section: trimmedSection, sectionCount: sections[trimmedSection].length });
    res.json(sections);
  } catch (error) {
    logger.error('Failed to add exercise', error);
    res.status(500).json({ error: 'Failed to add exercise' });
  }
});

// Delete an exercise from a section
app.delete('/api/exercises/:section/:name', async (req, res) => {
  try {
    const { section, name } = req.params;
    const decodedSection = decodeURIComponent(section);
    const decodedName = decodeURIComponent(name);
    logger.debug('Delete exercise request', { section: decodedSection, name: decodedName });

    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const sections = normalizeData(data);

    if (!sections[decodedSection]) {
      logger.warn('Delete exercise failed: section not found', { section: decodedSection });
      return res.status(404).json({ error: 'Section not found' });
    }

    const initialCount = sections[decodedSection].length;
    sections[decodedSection] = sections[decodedSection].filter(ex => ex.name !== decodedName);

    if (sections[decodedSection].length === initialCount) {
      logger.warn('Delete exercise failed: not found', { section: decodedSection, name: decodedName });
      return res.status(404).json({ error: 'Exercise not found' });
    }

    await fs.writeFile(EXERCISES_FILE, JSON.stringify(sections, null, 2));
    logger.info('Exercise deleted successfully', { section: decodedSection, name: decodedName, remainingCount: sections[decodedSection].length });
    res.json(sections);
  } catch (error) {
    logger.error('Failed to delete exercise', error);
    res.status(500).json({ error: 'Failed to delete exercise' });
  }
});

// Get all sections
app.get('/api/sections', async (req, res) => {
  try {
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const sections = normalizeData(data);
    const sectionNames = Object.keys(sections);
    logger.info('Retrieved sections', { count: sectionNames.length });
    res.json(sectionNames);
  } catch (error) {
    logger.error('Failed to read sections', error);
    res.status(500).json({ error: 'Failed to read sections' });
  }
});

// Add a new section
app.post('/api/sections', async (req, res) => {
  try {
    const { name } = req.body;
    logger.debug('Add section request', { name: name });

    if (!name || name.trim() === '') {
      logger.warn('Add section failed: empty name');
      return res.status(400).json({ error: 'Section name is required' });
    }

    const trimmedName = name.trim();
    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const sections = normalizeData(data);

    // Check for duplicates
    if (sections[trimmedName]) {
      logger.warn('Add section failed: duplicate', { name: trimmedName });
      return res.status(400).json({ error: 'Section already exists' });
    }

    sections[trimmedName] = [];
    await fs.writeFile(EXERCISES_FILE, JSON.stringify(sections, null, 2));
    logger.info('Section added successfully', { name: trimmedName, totalSections: Object.keys(sections).length });
    res.json(sections);
  } catch (error) {
    logger.error('Failed to add section', error);
    res.status(500).json({ error: 'Failed to add section' });
  }
});

// Delete a section
app.delete('/api/sections/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);
    logger.debug('Delete section request', { name: decodedName });

    const data = await fs.readFile(EXERCISES_FILE, 'utf8');
    const sections = normalizeData(data);

    if (!sections[decodedName]) {
      logger.warn('Delete section failed: not found', { name: decodedName });
      return res.status(404).json({ error: 'Section not found' });
    }

    if (Object.keys(sections).length === 1) {
      logger.warn('Delete section failed: cannot delete last section', { name: decodedName });
      return res.status(400).json({ error: 'Cannot delete the last section' });
    }

    delete sections[decodedName];
    await fs.writeFile(EXERCISES_FILE, JSON.stringify(sections, null, 2));
    logger.info('Section deleted successfully', { name: decodedName, remainingSections: Object.keys(sections).length });
    res.json(sections);
  } catch (error) {
    logger.error('Failed to delete section', error);
    res.status(500).json({ error: 'Failed to delete section' });
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

