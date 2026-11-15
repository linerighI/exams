/**
 * Shared Jordanian grade/class sorting and automatic unified student account
 * provisioning helpers (`nationalId` + `<first5>@Alshereqi.Edu`).
 */
const { id, hash, normalizeNationalId, fail } = require('./db-crypto.cjs');

const GRADE_RULES = [
  [/(?:ال)?حادي\s*عشر|الأول\s*ثانوي|الاول\s*ثانوي|(?<!\d)11(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 11],
  [/(?:ال)?ثاني\s*عشر|التوجيهي|توجيهي|(?<!\d)12(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 12],
  [/(?:ال)?عاشر|(?<!\d)10(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 10],
  [/روضة|بستان|تمهيدي|\b(?:kg|pre)\b/i, 0],
  [/الأول|الاول|أول|(?<!\d)1(?:st)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 1],
  [/الثاني|ثاني|(?<!\d)2(?:nd)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 2],
  [/الثالث|ثالث|(?<!\d)3(?:rd)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 3],
  [/الرابع|رابع|(?<!\d)4(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 4],
  [/الخامس|خامس|(?<!\d)5(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 5],
  [/السادس|سادس|(?<!\d)6(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 6],
  [/السابع|سابع|(?<!\d)7(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 7],
  [/الثامن|ثامن|(?<!\d)8(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 8],
  [/التاسع|تاسع|(?<!\d)9(?:th)?(?=[A-Za-z\u0621-\u064A\s\-_/]|$)/i, 9],
];

const SECTION_LETTERS = 'أابجدهوزحطيكلمنسعفصقرشتثخذضظغ'.split('');

/** Build the default unified student password `<first5>@Alshereqi.Edu`. */
function studentPasswordFromNationalId(nationalId) {
  const clean = normalizeNationalId(nationalId);
  return `${clean.slice(0, 5)}@Alshereqi.Edu`;
}

/** Validate and normalize a student National ID (5–20 digits, supporting 10-digit JO IDs). */
function parseNationalId(raw) {
  const clean = normalizeNationalId(raw || '');
  if (!/^\d{5,20}$/.test(clean)) {
    fail('أدخل الرقم الوطني بالأرقام (٥ أرقام على الأقل)', 400);
  }
  return clean;
}

/** Compute a deterministic numeric rank for Jordanian class names so 8th precedes 9th. */
function inferClassSortScore(name) {
  const clean = String(name || '').trim();
  let gradeRank = 999;
  for (const [pattern, score] of GRADE_RULES) {
    if (pattern.test(clean)) {
      gradeRank = score;
      break;
    }
  }
  let sectionRank = 0;
  const trimmedTail = clean.replace(/[\s()[\]-]+$/g, '');
  const tailAr = trimmedTail.match(/(?:^|[\s\-_/()])([أابجدهوزحطيكلمنسعفصقرشتثخذضظغ])$/);
  const tailLat = trimmedTail.match(/([A-Za-z]|\d)$/);
  if (tailAr) {
    sectionRank = Math.max(1, SECTION_LETTERS.indexOf(tailAr[1]) + 1);
  } else if (tailLat) {
    const token = tailLat[1].toUpperCase();
    sectionRank = /^\d+$/.test(token) ? Number(token) : token.charCodeAt(0) - 64;
  }
  return gradeRank * 100 + sectionRank;
}

/** Sort class records cleanly by inferred Jordanian grade and section. */
function sortClassesByGrade(classes) {
  return [...classes].sort((a, b) => {
    const diff = inferClassSortScore(a.name) - inferClassSortScore(b.name);
    return diff !== 0 ? diff : String(a.name).localeCompare(String(b.name), 'ar');
  });
}

/** Initialize or re-apply automatic grade sorting for school classes. */
function syncClassSortOrders(db, schoolId = null, forceAuto = false) {
  const schoolIds = schoolId
    ? [schoolId]
    : db.prepare('SELECT id FROM schools').all().map((r) => r.id);
  db.transaction(() => {
    for (const sid of schoolIds) {
      const rows = db.prepare('SELECT id,name,sort_order FROM classes WHERE school_id=?').all(sid);
      if (!rows.length) continue;
      if (!forceAuto && rows.some((r) => Number(r.sort_order) > 0)) continue;
      const ordered = sortClassesByGrade(rows);
      ordered.forEach((cls, idx) => {
        db.prepare('UPDATE classes SET sort_order=? WHERE id=?').run(idx + 1, cls.id);
      });
    }
  })();
}

/** Auto-create or update a unified `student` login backed by National ID + `<first5>@Alshereqi.Edu`. */
function provisionStudentAccount({ db, schoolId, studentRow, nationalId, nationalHash, passwordOverride }) {
  const cleanId = parseNationalId(nationalId);
  const nh = nationalHash(cleanId);
  const dupStudent = db
    .prepare('SELECT id FROM students WHERE national_id_hash=? AND id<>?')
    .get(nh, studentRow.id);
  if (dupStudent) fail('الرقم الوطني مرتبط بطالب آخر بالفعل', 409);

  const syntheticEmail = `${cleanId}.${schoolId.slice(0, 8)}@student.alshereqi.local`.toLowerCase();
  const conflictUser = db
    .prepare('SELECT id FROM users WHERE email=? AND id<>?')
    .get(syntheticEmail, studentRow.user_id || '');
  if (conflictUser) fail('الرقم الوطني مستخدم لحساب آخر', 409);

  const defaultPw = studentPasswordFromNationalId(cleanId);
  const pwHash = hash(passwordOverride || defaultPw);
  let uid = studentRow.user_id;

  if (uid) {
    db.prepare('UPDATE users SET name=?,email=?,password=?,role=?,section=? WHERE id=?').run(
      studentRow.name,
      syntheticEmail,
      pwHash,
      'student',
      studentRow.section,
      uid,
    );
    if (studentRow.national_id_hash !== nh) {
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(uid);
    }
  } else {
    uid = id();
    db.prepare(
      'INSERT INTO users(id,school_id,name,email,password,role,section) VALUES(?,?,?,?,?,?,?)',
    ).run(uid, schoolId, studentRow.name, syntheticEmail, pwHash, 'student', studentRow.section);
  }

  db.prepare('UPDATE students SET user_id=?,national_id=?,national_id_hash=? WHERE id=?').run(
    uid,
    cleanId,
    nh,
    studentRow.id,
  );

  return { userId: uid, nationalId: cleanId, defaultPassword: defaultPw };
}

module.exports = {
  studentPasswordFromNationalId,
  parseNationalId,
  inferClassSortScore,
  sortClassesByGrade,
  syncClassSortOrders,
  provisionStudentAccount,
};
