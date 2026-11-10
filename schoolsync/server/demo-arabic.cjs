// Translate only the original fictional seed values. Edited school records are
// preserved; operational schools never call this development-only migration.
module.exports = function localizeDemo(db) {
  const values = {
    'Olive Grove School': 'مدرسة الآفاق',
    'Alex Morgan': 'يوسف أحمد',
    'Sarah Morgan': 'ليلى أحمد',
    'Emma Wilson': 'سارة خالد',
    'Rami Haddad': 'رامي حداد',
    'Jamie Morgan': 'عمر أحمد',
    'Nora Ahmad': 'نورا محمد',
    Mathematics: 'الرياضيات',
    English: 'اللغة الإنجليزية',
    Science: 'العلوم',
    Arabic: 'اللغة العربية',
    'Art & design': 'الفنون والتصميم',
    History: 'التاريخ',
    'Room 204': 'القاعة ٢٠٤',
    'Room 108': 'القاعة ١٠٨',
    'Science lab': 'مختبر العلوم',
    'Room 202': 'القاعة ٢٠٢',
    'Art studio': 'مرسم الفنون',
    'Room 105': 'القاعة ١٠٥',
    'Junior Room 204': 'قاعة الصغار ٢٠٤',
    'Junior Room 108': 'قاعة الصغار ١٠٨',
    'Junior Science lab': 'مختبر الصغار',
    'Junior Room 202': 'قاعة الصغار ٢٠٢',
    'Junior Art studio': 'مرسم الصغار',
    'Junior Room 105': 'قاعة الصغار ١٠٥',
    'A little everyday algebra': 'خطوات صغيرة في عالم الجبر',
    'Complete exercises 1–8 on page 42. Show your working and explain how you found each answer.':
      'أكمل التمارين من ١ إلى ٨ في الصفحة ٤٢. وضّح خطوات الحل واشرح كيف توصلت إلى كل إجابة.',
    'Stories worth telling': 'حكاية تستحق أن تُروى',
    'Write 150 words about a place that feels like home. Include three descriptive details.':
      'اكتب ١٥٠ كلمة باللغة الإنجليزية عن مكان تشعر فيه بالانتماء. أضف ثلاثة تفاصيل وصفية تجعل القارئ يتخيّل المكان.',
    'The world under a leaf': 'العالم تحت ورقة شجر',
    'Find a leaf, sketch it, and label the parts involved in photosynthesis.':
      'اختر ورقة شجر، وارسمها، وسمِّ الأجزاء المسؤولة عن عملية البناء الضوئي.',
    'Creative project': 'مشروع إبداعي',
    'Class participation': 'المشاركة الصفية',
    'Learning journal': 'دفتر التعلّم',
    'A day for curious minds': 'يوم للاكتشاف والأسئلة الجميلة',
    'Our school discovery day is coming up. Bring your questions, your ideas, and a little curiosity. Families are welcome — contact the school office for details.':
      'يقترب يوم الاكتشاف في مدرستنا. احضروا أسئلتكم وأفكاركم وشغفكم بالمعرفة. نرحّب بأولياء الأمور؛ تواصلوا مع الإدارة لمعرفة التفاصيل.',
    'Alex brought a thoughtful perspective to our class discussion today. Lovely to see that confidence growing.':
      'أضاف يوسف فكرة مميزة إلى نقاشنا الصفي اليوم. يسعدني أن أرى ثقته بنفسه تنمو يوماً بعد يوم.',
    'Hi Sarah! A lovely day of learning today. Please let me know if you have any questions about the new homework.':
      'مرحباً ليلى! قضينا يوماً جميلاً من التعلّم. يسعدني الإجابة عن أي سؤال حول الواجب الجديد.',
    'Welcome to your school day': 'أهلاً بك في يومك المدرسي',
    'Your timetable, homework, and school updates, together in one calm place.':
      'جدولك وواجباتك ومستجدات مدرستك، معاً في مساحة هادئة واحدة.',
  };
  const columns = {
    schools: ['name'],
    users: ['name'],
    students: ['name'],
    lessons: ['subject', 'room'],
    homework: ['subject', 'title', 'description'],
    grades: ['subject', 'title'],
    notes: ['content'],
    announcements: ['title', 'content'],
    messages: ['content'],
    notifications: ['title', 'content'],
  };
  db.transaction(() => {
    const roster = [
      ['demo-student-1', 'آدم مصطفى', '8A', 'آ م'],
      ['demo-student-2', 'زين عبد الله', '8A', 'ز ع'],
      ['demo-student-3', 'مريم سالم', '8A', 'م س'],
      ['demo-student-4', 'سلمى عمر', '8A', 'س ع'],
      ['demo-student-5', 'ليان ناصر', '6B', 'ل ن'],
      ['demo-student-6', 'كريم فادي', '6B', 'ك ف'],
    ];
    for (const [id, name, section, initials] of roster)
      db.prepare(
        'INSERT OR IGNORE INTO students(id,school_id,name,section,initials,color) VALUES(?,?,?,?,?,?)',
      ).run(id, 'school-demo', name, section, initials, 'blue');
    for (const [table, fields] of Object.entries(columns))
      for (const field of fields)
        for (const [english, arabic] of Object.entries(values)) {
          const scope = table === 'schools' ? 'id' : 'school_id';
          db.prepare(
            `UPDATE ${table} SET ${field}=? WHERE ${scope}='school-demo' AND ${field}=?`,
          ).run(arabic, english);
        }
    db.prepare("UPDATE students SET initials='ي أ' WHERE id='alex' AND initials='AM'").run();
    db.prepare("UPDATE students SET initials='ع أ' WHERE id='jamie' AND initials='JM'").run();
  })();
};
