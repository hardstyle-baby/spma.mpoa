require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { validateSecurityConfig } = require('./config/security');

validateSecurityConfig();

const sequelize   = require('./config/database');
require('./models'); // load all models + associations

const authRoutes      = require('./routes/auth');
const memberRoutes    = require('./routes/members');
const asaRoutes       = require('./routes/asa');
const pbRoutes        = require('./routes/pb');
const importRoutes    = require('./routes/import');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes      = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));            // large enough for bulk roster imports
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/members',   memberRoutes);
app.use('/api/asa',       asaRoutes);
app.use('/api/pb',        pbRoutes);
app.use('/api/import',    importRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/mpoa/members', require('./routes/mpoaMembers'));
// Serve the production React build from the same domain as the API.
const frontendBuild = process.env.FRONTEND_BUILD_DIR || path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendBuild));
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) =>
  res.sendFile(path.join(frontendBuild, 'index.html'))
);
// ── 404 catch-all ────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

// ── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// ── Database sync + start ────────────────────────────────────
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅  Database connected.');

    // alter disabled — tables already match models; alter hits MySQL's 64-key limit on COMPANY
    await sequelize.sync({ alter: false });
    console.log('✅  Models synchronised.');

    app.listen(PORT, () =>
      console.log(`🚀  MPOA API running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error('❌  Failed to start server:', err);
    process.exit(1);
  }
})();
