/**
 * Administrator HTTP routes for exporting school database snapshots, downloading
 * structured templates, and injecting JSON school datasets atomically.
 */
const { exportSchoolSnapshot, sampleSchoolTemplate } = require('./db-snapshot.cjs');
const { importSchoolSnapshot } = require('./db-injector.cjs');

function registerDatabaseRoutes(app, ctx, { nationalHash }) {
  const { schoolManager } = ctx;

  app.get('/api/admin/database/export', async (req) => {
    schoolManager(req.user);
    return exportSchoolSnapshot(ctx, req.user.school_id);
  });

  app.get('/api/admin/database/template', async (req) => {
    schoolManager(req.user);
    return sampleSchoolTemplate();
  });

  app.post('/api/admin/database/import', { bodyLimit: 5 * 1024 * 1024 }, async (req) => {
    const u = req.user;
    schoolManager(u);
    const result = importSchoolSnapshot(ctx, u.school_id, u, req.body, { nationalHash });
    return { ok: true, ...result };
  });
}

module.exports = { registerDatabaseRoutes };
