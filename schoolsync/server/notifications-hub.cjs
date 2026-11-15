/**
 * Notification persistence & real-time per-user SSE stream publisher for web
 * browsers and native Android background listeners.
 */
const { id } = require('./db-crypto.cjs');

function createNotificationsHub(one, all, run) {
  const userStreams = new Map();

  const subscribeUserNotifications = (userId, handler) => {
    if (!userStreams.has(userId)) userStreams.set(userId, new Set());
    userStreams.get(userId).add(handler);
    return () => {
      const set = userStreams.get(userId);
      if (!set) return;
      set.delete(handler);
      if (!set.size) userStreams.delete(userId);
    };
  };

  const pushUserNotification = (userId, payload) => {
    const listeners = userStreams.get(userId);
    if (!listeners) return;
    for (const handler of listeners) {
      try {
        handler(payload);
      } catch {
        listeners.delete(handler);
      }
    }
  };

  const insertNotification = (userId, schoolId, title, content) => {
    const nid = id();
    const created = new Date().toISOString().replace('T', ' ').slice(0, 19);
    run(
      'INSERT INTO notifications(id,school_id,user_id,title,content,created) VALUES(?,?,?,?,?,?)',
      nid,
      schoolId,
      userId,
      title,
      content,
      created,
    );
    pushUserNotification(userId, {
      id: nid,
      title,
      content,
      read: 0,
      created,
      urgent: title.includes('غياب') || title.includes('تأخر') || title.includes('تحقق'),
    });
    return nid;
  };

  const notify = (u, studentId, title, content) => {
    const recipients = all(
      "SELECT guardian_id id FROM guardian_links WHERE student_id=? UNION SELECT guardian_id id FROM family_credentials WHERE student_id=? UNION SELECT user_id id FROM students WHERE id=? UNION SELECT id FROM users WHERE school_id=? AND role IN ('admin','assistant')",
      studentId,
      studentId,
      studentId,
      u.school_id,
    );
    const seen = new Set();
    for (const r of recipients) {
      if (r.id && !seen.has(r.id)) {
        seen.add(r.id);
        insertNotification(r.id, u.school_id, title, content);
      }
    }
  };

  return { insertNotification, notify, subscribeUserNotifications, pushUserNotification };
}

module.exports = { createNotificationsHub };
