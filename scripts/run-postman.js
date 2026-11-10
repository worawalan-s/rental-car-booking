const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });
const PORT = process.env.PORT || 5003;
const BASE_URL = `http://localhost:${PORT}`;

// Helper: Check if server is running
const checkServerRunning = (url) => {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/v1/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
};

// Helper: Wait for server to start
const waitForServer = async (url, maxAttempts = 30, intervalMs = 500) => {
  for (let i = 0; i < maxAttempts; i++) {
    const isUp = await checkServerRunning(url);
    if (isUp) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return false;
};

async function main() {
  console.log('====================================================');
  console.log('  Rental Car Booking: Postman & Newman Test Runner  ');
  console.log('====================================================');

  let serverProcess = null;
  const isAlreadyRunning = await checkServerRunning(BASE_URL);

  if (isAlreadyRunning) {
    console.log(`[INFO] Server already running at ${BASE_URL}`);
  } else {
    console.log(`[INFO] Starting local Express server on port ${PORT}...`);
    serverProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      detached: false,
    });

    serverProcess.stdout.on('data', (data) => {
      // Optional debug logging
    });
    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(`[SERVER ERROR] ${data.toString()}`);
    });

    const isUp = await waitForServer(BASE_URL);
    if (!isUp) {
      console.error('[FATAL] Timed out waiting for server to start.');
      if (serverProcess) serverProcess.kill('SIGTERM');
      process.exit(1);
    }
    console.log(`[SUCCESS] Express server is alive at ${BASE_URL}`);
  }

  const collectionPath = path.join(__dirname, '..', 'postman', 'rental-car-stage1-2.collection.json');
  const environmentPath = path.join(__dirname, '..', 'postman', 'rental-car-local.environment.json');
  const reportPath = path.join(__dirname, '..', 'postman', 'newman-report.json');

  console.log('\n[INFO] Running Newman against Postman Collection...');
  const newmanCmd = `npx newman run "${collectionPath}" -e "${environmentPath}" --reporters cli,json --reporter-json-export "${reportPath}"`;

  let exitCode = 0;
  try {
    execSync(newmanCmd, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('\n[SUCCESS] All Postman & Newman verification tests passed!');
  } catch (err) {
    console.error('\n[FAILURE] Newman test run encountered failures.');
    exitCode = 1;
  } finally {
    if (serverProcess) {
      console.log('\n[INFO] Stopping temporary server process...');
      serverProcess.kill('SIGTERM');
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
