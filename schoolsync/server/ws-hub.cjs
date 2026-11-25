/**
 * Role-scoped WebSocket broadcast hub for SchoolSync `/api/live` connections:
 * separates full-state invalidation, campus blueprint publishes, and high-frequency
 * admin-only teacher location deltas.
 */

const MANAGER_ROLES = new Set(['admin', 'assistant']);
const STAFF_ROLES = new Set(['admin', 'assistant', 'teacher']);

/** Create an in-memory WebSocket connection registry scoped by school and role. */
function createWsHub() {
  const clients = new Map();

  function register(socket, user) {
    clients.set(socket, {
      school: user.school_id,
      userId: user.id,
      role: user.role,
      expires: Date.now() + 3600000,
    });
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  }

  function broadcast(schoolId, rawMessage, allowedRoles = null) {
    const now = Date.now();
    for (const [socket, info] of clients) {
      if (info.expires < now) {
        try {
          socket.close();
        } catch {
          clients.delete(socket);
        }
        continue;
      }
      if (info.school !== schoolId || socket.readyState !== 1) continue;
      if (allowedRoles && !allowedRoles.has(info.role)) continue;
      try {
        socket.send(rawMessage);
      } catch {
        clients.delete(socket);
      }
    }
  }

  return {
    register,
    broadcastStateChanged: (schoolId) => broadcast(schoolId, '{"changed":true}'),
    broadcastCampusLayout: (schoolId) =>
      broadcast(schoolId, '{"type":"campus_layout"}', STAFF_ROLES),
    broadcastTeacherLocation: (schoolId, delta) =>
      broadcast(schoolId, JSON.stringify({ type: 'teacher_location', ...delta }), MANAGER_ROLES),
    clientCount: () => clients.size,
    closeAll: () => clients.clear(),
  };
}

module.exports = { createWsHub };
