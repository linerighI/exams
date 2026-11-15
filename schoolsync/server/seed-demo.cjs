/**
 * Isolated development/test fixture seeding (`--demo` only).
 * Operational live databases never execute this module.
 */
const { id, hash, day } = require('./db.cjs');

/** Seed isolated demo fixtures only when `--demo` is enabled. */
function seed(db) {
  if (db.prepare('SELECT 1 FROM schools LIMIT 1').get()) return;
  db.transaction(() => {
    db.prepare('INSERT INTO schools(id,name,timezone,start_time,end_time) VALUES(?,?,?,?,?)').run(
      'school-demo',
      'Olive Grove School',
      'Asia/Amman',
      '08:00',
      '14:00',
    );
    const users = [
      ['student-demo', 'Alex Morgan', 'alex@schoolsync.demo', 'student', '8A'],
      ['parent-demo', 'Sarah Morgan', 'sarah@schoolsync.demo', 'parent', null],
      ['teacher-demo', 'Emma Wilson', 'emma@schoolsync.demo', 'teacher', '8A'],
      ['teacher-sibling', 'Nora Ahmad', 'nora@schoolsync.demo', 'teacher', '6B'],
      ['assistant-demo', 'Tareq Zaid', 'tareq@schoolsync.demo', 'assistant', null],
      ['admin-demo', 'Rami Haddad', 'rami@schoolsync.demo', 'admin', null],
      ['student-sibling', 'Jamie Morgan', 'jamie@schoolsync.demo', 'student', '6B'],
    ];
    for (const [uid, name, email, role, section] of users)
      db.prepare('INSERT INTO users(id,school_id,name,email,password,role,section) VALUES(?,?,?,?,?,?,?)').run(
        uid,
        'school-demo',
        name,
        email,
        hash('SchoolSync!2026'),
        role,
        section,
      );
    db.prepare('INSERT INTO students(id,school_id,user_id,name,section,initials,color) VALUES(?,?,?,?,?,?,?)').run(
      'alex',
      'school-demo',
      'student-demo',
      'Alex Morgan',
      '8A',
      'AM',
      'lilac',
    );
    db.prepare('INSERT INTO students(id,school_id,user_id,name,section,initials,color) VALUES(?,?,?,?,?,?,?)').run(
      'jamie',
      'school-demo',
      'student-sibling',
      'Jamie Morgan',
      '6B',
      'JM',
      'peach',
    );
    for (const sid of ['alex', 'jamie'])
      db.prepare('INSERT INTO guardian_links(guardian_id,student_id) VALUES(?,?)').run('parent-demo', sid);
    const subjects = [
      ['Mathematics', '08:00', '08:50', 'Room 204', 'blue', 1],
      ['English', '09:00', '09:50', 'Room 108', 'peach', 2],
      ['Science', '10:10', '11:00', 'Science lab', 'mint', 3],
      ['Arabic', '11:10', '12:00', 'Room 202', 'lilac', 4],
      ['Art & design', '12:10', '13:00', 'Art studio', 'pink', 5],
      ['History', '13:10', '14:00', 'Room 105', 'yellow', 6],
    ];
    for (const section of ['8A', '6B'])
      for (const weekday of [0, 1, 2, 3, 4])
        for (const [n, start, end, room, color, period] of subjects)
          db.prepare(
            'INSERT INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          ).run(
            `${section}-${weekday}-${n}`,
            'school-demo',
            section,
            section === '8A' ? 'teacher-demo' : 'teacher-sibling',
            n,
            section === '8A' ? room : `Junior ${room}`,
            weekday,
            start,
            end,
            color,
            period,
          );
    const today = day();
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const due = tomorrow.toISOString().slice(0, 10);
    for (const section of ['8A', '6B'])
      for (const [n, title, desc, color] of [
        ['Mathematics', 'A little everyday algebra', 'Complete exercises 1–8 on page 42. Show your working and explain how you found each answer.', 'blue'],
        ['English', 'Stories worth telling', 'Write 150 words about a place that feels like home. Include three descriptive details.', 'peach'],
        ['Science', 'The world under a leaf', 'Find a leaf, sketch it, and label the parts involved in photosynthesis.', 'mint'],
      ])
        db.prepare('INSERT INTO homework(id,school_id,section,teacher_id,subject,title,description,due,color) VALUES(?,?,?,?,?,?,?,?,?)').run(
          id(),
          'school-demo',
          section,
          'teacher-demo',
          n,
          title,
          desc,
          due,
          color,
        );
    for (const sid of ['alex', 'jamie'])
      for (let i = 0; i < 6; i++) {
        const d = new Date(`${today}T12:00:00Z`);
        d.setDate(d.getDate() - (6 - i) * 7);
        db.prepare('INSERT INTO grades(id,school_id,student_id,teacher_id,subject,title,score,max,published,date) VALUES(?,?,?,?,?,?,?,?,?,?)').run(
          id(),
          'school-demo',
          sid,
          'teacher-demo',
          subjects[i][0],
          ['Creative project', 'Class participation', 'Learning journal'][i % 3],
          [78, 84, 81, 89, 92, 94][i],
          100,
          1,
          d.toISOString().slice(0, 10),
        );
      }
    db.prepare('INSERT INTO announcements(id,school_id,author_id,title,content) VALUES(?,?,?,?,?)').run(
      id(),
      'school-demo',
      'admin-demo',
      'A day for curious minds',
      'Our school discovery day is coming up. Bring your questions, your ideas, and a little curiosity. Families are welcome — contact the school office for details.',
    );
    db.prepare('INSERT INTO notes(id,school_id,student_id,author_id,content,category) VALUES(?,?,?,?,?,?)').run(
      id(),
      'school-demo',
      'alex',
      'teacher-demo',
      'Alex brought a thoughtful perspective to our class discussion today. Lovely to see that confidence growing.',
      'behavior',
    );
    for (const uid of ['student-demo', 'parent-demo'])
      db.prepare('INSERT INTO notifications(id,school_id,user_id,title,content) VALUES(?,?,?,?,?)').run(
        id(),
        'school-demo',
        uid,
        'Welcome to your school day',
        'Your timetable, homework, and school updates, together in one calm place.',
      );
  })();
}

module.exports = { seed };
