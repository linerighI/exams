export type BankPDFOptions = {
  audience: 'teacher' | 'student';
  approvedOnly: boolean;
  chapter: string;
  title: string;
};
export type ReportOptions = {
  sections: ('students' | 'results' | 'exams' | 'banks' | 'activity' | 'accounts')[];
  includeLoginCodes: boolean;
  includeAnswerDetails: boolean;
  includeArchived: boolean;
};
