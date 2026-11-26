/**
 * Curated architectural SAR language presets showing relative flush placement,
 * batch wing row generators, seamless hallway merging, and custom polygon shapes.
 */
import type { SarTemplate } from './sarTypes';

export const SAR_TEMPLATES: SarTemplate[] = [
  {
    id: 'wing6',
    labelAr: 'جناح ٦ صفوف + ممر',
    labelEn: '6-Class Wing',
    descAr: 'جناح متناظر مدمج تلقائياً بممر وسطي وبهو استقبال',
    descEn: 'Symmetric 6-room wing with flush central corridor & merged foyer',
    source: `# SAR 6-Classroom Wing with Auto-Merged Corridor & Flush Foyer
campus "جناح الصفوف النموذجي" grid 0.5

wing west "الجناح الغربي" color #007aff
wing east "الجناح الشرقي" color #34c759
wing entry "المدخل" color #ff9500

floor f1 "الطابق الأول" y 0 height 3.4
  room cor "الممر الوسطي" kind corridor wing west size 2.5x18 at (0, 0)
    window N 0 width 1.8

  # Generate 3 west classrooms flush against the corridor (x = -4.25)
  row 3 classroom "قاعة غ" prefix w_ wing west start (-4.25, -6) step (0, 6) size 6x6 door E window W color wall #f8fafc

  # Generate 3 east classrooms flush against the corridor (x = +4.25)
  row 3 classroom "قاعة ش" prefix e_ wing east start (4.25, -6) step (0, 6) size 6x6 door W window E color wall #eff6ff

  # Entrance foyer snapped 0.00m south of corridor and seamlessly opened into it
  room foyer "بهو المدخل" kind reception wing entry size 6.5x4.2 south_of cor align center
    double_door S 0
    merge cor
    color wall #ffffff floor #fef9c3

  prop gate at (0, 14) rot 0
  prop fountain at (0, 12.2) scale 0.85
  prop stairs in cor offset (0, -7.2)
  prop desk_cluster in w_1
  prop whiteboard in w_1 offset (0, -2.5)
  prop desk_cluster in e_1
  prop tree_round at (-8, 12)
  prop tree_round at (8, 12)
`,
  },
  {
    id: 'admin_spine',
    labelAr: 'المبنى الإداري',
    labelEn: 'Admin Spine',
    descAr: 'ربط نسبي بين الإدارة والمدير والمعلمين والمسرح',
    descEn: 'Relative flush layout connecting Reception, Principal, Lounge & Stage',
    source: `# Relative Flush Placement (east_of / west_of / south_of)
campus "المبنى الإداري المتكامل" grid 0.5

wing admin "الجناح الإداري" color #ff9500
wing stage "المسرح والأنشطة" color #af52de

floor f1 "الطابق الأول" y 0 height 3.5
  room rec "الاستقبال وشؤون الطلبة" kind reception wing admin size 6x5.5 at (0, -4)
    double_door S 0
    window N 0
    color floor #fef9c3

  room teachers "غرفة المعلمين" kind teachers wing admin size 7x5.5 east_of rec align start
    door S 0
    window N 0

  room principal "مكتب المدير" kind principal wing admin size 5.5x5.5 east_of teachers align start
    door S 0
    window E 0
    state highlight "مكتب الإدارة الرئيسية"

  room aud "المسرح والأنشطة" kind auditorium wing stage size 9x5.5 west_of rec align start
    double_door S 0
    window N 0

  room hall "الرواق الإداري" kind corridor wing admin size 27.5x2.2 south_of principal align end
    double_door S 0
    merge rec

  prop conference_table in teachers
  prop teacher_desk in principal offset (0, -0.8)
  prop auditorium_stage in aud offset (0, -1.2)
  prop flagpole at (0, 3.5)
  prop tree_cypress at (-9, 4)
  prop tree_cypress at (9, 4)
`,
  },
  {
    id: 'courtyard',
    labelAr: 'مدرسة الساحة',
    labelEn: 'Courtyard Campus',
    descAr: 'مدرسة متكاملة بطابقين وساحة وسطى ومرافق رياضية',
    descEn: 'Full 2-floor courtyard campus ready to customize',
    source: `# Full 2-Floor Courtyard Campus
campus "مدرسة المستقبل النموذجية" grid 0.5

wing west "الجناح الغربي" color #007aff
wing east "المختبرات والمكتبة" color #34c759
wing north "الإدارة" color #ff9500
wing yard "الساحة" color #06b6d4

floor f1 "الطابق الأول" y 0 height 3.4
  row 3 classroom "قاعة 10" prefix w1_ wing west start (-12.5, -3) step (0, 6) size 6x5.5 door E window W
  room c1 "ممر الطابق الأول" kind corridor wing west size 1.8x17.5 at (-8.6, 3)

  room yard "الساحة المدرسية" kind courtyard wing yard size 15x16.5 at (0, 2.5)
  room lab "مختبر الحاسوب" kind lab wing east size 6.5x5.5 at (12, -3)
    door W 0
    window E 0
  room lib "المكتبة" kind library wing east size 6.5x5.5 at (12, 3)
    door W 0
    window E 0
  room admin "الإدارة والمدير" kind principal wing north size 10x5 at (0, -9.5)
    double_door S 0
    window N 0

  prop fountain in yard offset (0, 0)
  prop flagpole in yard offset (0, -5)
  prop basketball_hoop in yard offset (0, 6.2) rot 180
  prop bench in yard offset (-3.5, 0) rot 90
  prop bench in yard offset (3.5, 0) rot -90
  prop tree_round in yard offset (-5, -5)
  prop tree_round in yard offset (5, -5)
  prop lab_bench in lab
  prop bookshelf in lib offset (1.2, 0) rot 90

floor f2 "الطابق الثاني" y 3.4 height 3.4
  row 3 classroom "قاعة 20" prefix w2_ wing west start (-12.5, -3) step (0, 6) size 6x5.5 door E window W
`,
  },
  {
    id: 'polygon_hall',
    labelAr: 'قاعة مضلعة 3D',
    labelEn: 'Polygon Hall',
    descAr: 'قاعة متعددة الزوايا مدمجة مع ممر جانبي بأثاث داخلي',
    descEn: 'Custom 5-corner architectural hall merged with adjacent corridor',
    source: `# Custom Polygon Architecture + Merge
campus "قاعة الإبداع المضلعة" grid 0.5

wing hub "مركز الإبداع" color #af52de

floor f1 "الطابق الأول" y 0 height 3.6
  room hex "قاعة الإبداع الكبرى" kind auditorium wing hub at (2, 0)
    shape [(-4, -4), (4, -4), (5.5, 0), (3, 4.5), (-4, 4.5)]
    window 0 0 width 2.8
    window 1 0 width 2.2
    color wall #eef2ff floor #dbeafe
    state highlight "قاعة متعددة الزوايا"

  room entry_cor "ممر الوصول" kind corridor wing hub size 2.4x8.5 west_of hex align center
    double_door W 0
    merge hex

  prop auditorium_stage in hex offset (0.4, -1.8)
  prop bench at (-6, 6)
  prop tree_round at (-6, -5)
`,
  },
];
