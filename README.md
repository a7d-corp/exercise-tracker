# Exercise Tracker

A single-page web app for tracking exercises during workouts.

## Features

- Click exercises to highlight them during your workout
- Add and remove exercises
- Exercises stored in a flat JSON file
- Selection state resets on page refresh (not persisted)

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:3000`

## Running with Docker

### Using Docker Compose (Recommended)

1. Build and run:
   ```bash
   docker-compose up -d
   ```

2. Access at `http://localhost:3000`

3. Your exercises will be stored in `./data/exercises.json`

### Using Docker directly

1. Build the image:
   ```bash
   docker build -t exercise-tracker .
   ```

2. Run the container with a volume mount:
   ```bash
   docker run -d \
     -p 3000:3000 \
     -v $(pwd)/data:/data \
     -e EXERCISES_FILE=/data/exercises.json \
     --name exercise-tracker \
     exercise-tracker
   ```

### Custom Exercise File Location

You can specify a custom location for the exercises.json file using the `EXERCISES_FILE` environment variable:

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/your/data:/custom/data \
  -e EXERCISES_FILE=/custom/data/exercises.json \
  --name exercise-tracker \
  exercise-tracker
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `EXERCISES_FILE` - Path to exercises.json file (default: `/data/exercises.json` in Docker, `./exercises.json` locally)
- `DEBUG` - Enable debug logging (set to `true` to enable, default: disabled)
- `NODE_ENV` - Node environment (default: `development`)

## Logging

The application includes comprehensive logging for better visibility in Docker logs:

- **INFO**: General information about server operations, API requests, and successful operations
- **WARN**: Warning messages for validation failures or non-critical issues
- **ERROR**: Error messages with stack traces for debugging
- **DEBUG**: Detailed debug information (enabled with `DEBUG=true`)

All logs include ISO timestamps and are formatted for easy reading in Docker logs. View logs with:

```bash
docker logs exercise-tracker
```

Or follow logs in real-time:

```bash
docker logs -f exercise-tracker
```

