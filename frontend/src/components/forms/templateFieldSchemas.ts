export type ReplicaRatingRow = {
  key: string;
  number: string;
  title: string;
  titleUrdu?: string;
  leftText?: string;
  leftUrdu?: string;
  rightText?: string;
  rightUrdu?: string;
  categoryOnly?: boolean;
  subRows?: ReplicaRatingRow[];
};

export type ReplicaDecisionOption = {
  key: string;
  option: string;
  label: string;
  labelUrdu?: string;
};

export const driverFormFields = {
  periodFrom: "drivers-period-from",
  periodTo: "drivers-period-to",
  name: "drivers-name",
  dateOfBirth: "drivers-date-of-birth",
  bps: "drivers-bps",
  presentPay: "drivers-present-pay",
  typeOfLicense: "drivers-type-of-license",
  typeOfVehicleDriven: "drivers-type-of-vehicle-driven",
  reportingRemarks: "drivers-reporting-remarks",
  countersigningRemarks: "drivers-countersigning-remarks",
} as const;

export const driverChecklistRows = [
  {
    key: "rules-compliance",
    number: "1.",
    label: "Whether he is conversant with the rules for the staff cars and observes them rigidly.",
    labelUrdu: "کیا وہ سرکاری گاڑیوں کے قواعد سے واقف ہے اور ان کی سختی سے پابندی کرتا ہے۔",
  },
  {
    key: "mechanical-knowledge",
    number: "2.",
    label: "Whether he possesses adequate knowledge of the mechanism of cars and their engines, and is competent to do minor running repairs and replacement of spares.",
    labelUrdu: "کیا اسے گاڑی اور اس کے انجن کے نظام کا مناسب علم ہے اور معمولی مرمت اور اسپیئر پارٹس کی تبدیلی کر سکتا ہے۔",
  },
  {
    key: "courtesies-traffic",
    number: "3.",
    label: "Whether he has been careful in observing the ordinary courtesies and rules of traffic.",
    labelUrdu: "کیا وہ معمول کی شائستگی اور ٹریفک قوانین کی پابندی میں محتاط رہا ہے۔",
  },
  {
    key: "accidents-licence",
    number: "4.",
    label: "Whether he has been involved in any road accident or traffic offence and whether there has been any adverse entry in his Driving License during the period under review.",
    labelUrdu: "کیا جائزہ مدت کے دوران وہ کسی حادثہ یا ٹریفک خلاف ورزی میں ملوث رہا یا اس کے ڈرائیونگ لائسنس میں کوئی منفی اندراج ہوا۔",
  },
  {
    key: "cooperative-tactful",
    number: "5.",
    label: "Whether he is co-operative and tactful.",
    labelUrdu: "کیا وہ تعاون کرنے والا اور معاملہ فہم ہے۔",
  },
  {
    key: "polite-courteous",
    number: "6.",
    label: "Whether he is polite and courteous.",
    labelUrdu: "کیا وہ مہذب اور خوش اخلاق ہے۔",
  },
  {
    key: "appearance-bearing",
    number: "7.",
    label: "Whether he puts up clean appearance and bearing.",
    labelUrdu: "کیا اس کی ظاہری حالت اور رکھ رکھاو صاف ستھرا ہے۔",
  },
  {
    key: "amenable-discipline",
    number: "8.",
    label: "Is he amenable to discipline.",
    labelUrdu: "کیا وہ نظم و ضبط کا پابند ہے۔",
  },
  {
    key: "regular-punctual",
    number: "9.",
    label: "Is he regular and punctual in attending office and appointed place of duty.",
    labelUrdu: "کیا وہ دفتر اور مقررہ مقام ڈیوٹی پر حاضری میں باقاعدہ اور وقت کا پابند ہے۔",
  },
  {
    key: "vehicle-documents",
    number: "10.",
    label: "Whether he takes due care of the documents of the vehicle issued to him.",
    labelUrdu: "کیا وہ اپنے سپرد کردہ گاڑی کے کاغذات کی مناسب دیکھ بھال کرتا ہے۔",
  },
  {
    key: "servicing-cleanliness",
    number: "11.",
    label: "Whether he keeps the Car/M./Cycle in neat and tidy condition and keeps watch of the timely servicing/change of oil/parts according to the service manual.",
    labelUrdu: "کیا وہ گاڑی/موٹر سائیکل کو صاف ستھرا رکھتا ہے اور سروس مینول کے مطابق بروقت سروسنگ، آئل اور پرزہ جات کی تبدیلی کا خیال رکھتا ہے۔",
  },
  {
    key: "crash-helmet",
    number: "12.",
    label: "*While driving motor cycle/scooter, does he make use of crash helmet; sun glasses.",
    labelUrdu: "*موٹر سائیکل/اسکوٹر چلاتے وقت کیا وہ ہیلمٹ، عینک وغیرہ استعمال کرتا ہے؟",
  },
  {
    key: "mail-documents",
    number: "13.",
    label: "*Does he take proper care of the mail/packages/documents on his charge and takes signature of the recipient at the time of handing them over?",
    labelUrdu: "*کیا وہ اپنے سپرد ڈاک/پیکج/دستاویزات کی مناسب دیکھ بھال کرتا ہے اور حوالے کرتے وقت وصول کنندہ کے دستخط لیتا ہے؟",
  },
] as const;

export const per1718Fields = {
  ministryDivision: "per1718-ministry-division",
  serviceGroup: "per1718-service-group",
  departmentOffice: "per1718-department-office",
  reportingPeriodFrom: "per1718-reporting-period-from",
  reportingPeriodTo: "per1718-reporting-period-to",
  officerName: "per1718-officer-name",
  personnelNumber: "per1718-personnel-number",
  dateOfBirth: "per1718-date-of-birth",
  dateOfEntryInService: "per1718-date-of-entry-in-service",
  postHeldDuringPeriod: "per1718-post-held-during-period",
  academicQualifications: "per1718-academic-qualifications",
  periodServedPresentPost: "per1718-period-served-present-post",
  periodServedUnderReportingOfficer: "per1718-period-served-under-reporting-officer",
  jobDescription: "per1718-job-description",
  performanceSummary: "per1718-performance-summary",
  reportingNarrative: "per1718-reporting-narrative",
  strengthsWeaknesses: "per1718-strengths-weaknesses",
  specialAptitude: "per1718-special-aptitude",
  futureTraining: "per1718-future-training",
  countersigningRemarks: "per1718-countersigning-remarks",
  countersigningAssessmentQuality: "per1718-countersigning-assessment-quality",
  secondCountersigningRemarks: "per1718-second-countersigning-remarks",
  submissionCertificateName: "per1718-submission-certificate-name",
  submissionCertificateDesignation: "per1718-submission-certificate-designation",
  submissionCertificateDate: "per1718-submission-certificate-date",
  submissionCertificateFrom: "per1718-submission-certificate-period-from",
  submissionCertificateTo: "per1718-submission-certificate-period-to",
  submissionReportingOfficer: "per1718-submission-reporting-officer",
  submissionCountersigningOfficer: "per1718-submission-countersigning-officer",
  submissionSignature: "per1718-submission-signature",
  submissionAdministration: "per1718-submission-administration",
} as const;

export const per1718LanguageFields = [
  "per1718-language-1",
  "per1718-language-2",
  "per1718-language-3",
] as const;

export const per1718TrainingFields = Array.from({ length: 4 }, (_, index) => ({
  course: `per1718-training-${index + 1}-course`,
  duration: `per1718-training-${index + 1}-duration`,
  institution: `per1718-training-${index + 1}-institution`,
}));

export const per1718PartIIIRows: ReplicaRatingRow[] = [
  {
    key: "intelligence",
    number: "1.",
    title: "Intelligence",
    titleUrdu: "ذہانت",
    leftText: "Exceptionally bright; excellent comprehension",
    leftUrdu: "انتہائی ذہین؛ عمدہ فہم",
    rightText: "Dull; slow",
    rightUrdu: "کم فہم؛ سست",
  },
  {
    key: "confidence-will-power",
    number: "2.",
    title: "Confidence and will power",
    titleUrdu: "اعتماد اور قوت ارادی",
    leftText: "Exceptionally confident and resolute",
    leftUrdu: "انتہائی بااعتماد اور پختہ ارادہ",
    rightText: "Uncertain; hesitant",
    rightUrdu: "غیر یقینی؛ ہچکچاہٹ کا شکار",
  },
  {
    key: "acceptance-of-responsibility",
    number: "3.",
    title: "Acceptance of responsibility",
    titleUrdu: "ذمہ داری قبول کرنے کا رویہ",
    leftText: "Always prepared to take on responsibility even in difficult cases.",
    leftUrdu: "مشکل حالات میں بھی ذمہ داری لینے کے لیے ہمیشہ تیار۔",
    rightText: "Reluctant to take on responsibility; will avoid it whenever possible.",
    rightUrdu: "ذمہ داری لینے میں ہچکچاہٹ؛ ممکن ہو تو اجتناب کرتا ہے۔",
  },
  {
    key: "reliability-under-pressure",
    number: "4.",
    title: "Reliability under pressure",
    titleUrdu: "دباو میں اعتماد",
    leftText: "Calm and exceptionally reliable at all times",
    leftUrdu: "ہر حال میں پراعتماد اور نہایت قابل اعتبار",
    rightText: "Confused and easily flustered even under normal pressure.",
    rightUrdu: "معمولی دباو میں بھی پریشان اور گھبراہٹ کا شکار",
  },
  {
    key: "financial-responsibility",
    number: "5.",
    title: "Financial responsibility",
    titleUrdu: "مالی ذمہ داری",
    leftText: "Exercises due care and discipline",
    leftUrdu: "مناسب احتیاط اور مالی نظم و ضبط کا حامل",
    rightText: "Irresponsible",
    rightUrdu: "غیر ذمہ دار",
  },
  {
    key: "relations-with",
    number: "6.",
    title: "Relations with",
    titleUrdu: "تعلقات",
    categoryOnly: true,
    subRows: [
      {
        key: "relations-superiors",
        number: "6(i)",
        title: "Superiors",
        titleUrdu: "بالادست",
        leftText: "Cooperative and trusted",
        leftUrdu: "تعاون کرنے والا اور قابل اعتماد",
        rightText: "Un-cooperative",
        rightUrdu: "عدم تعاون",
      },
      {
        key: "relations-colleagues",
        number: "6(ii)",
        title: "Colleagues",
        titleUrdu: "ساتھی",
        leftText: "Works well in a team",
        leftUrdu: "ٹیم میں خوش اسلوبی سے کام کرتا ہے",
        rightText: "Difficult colleague",
        rightUrdu: "مشکل ساتھی",
      },
      {
        key: "relations-subordinates",
        number: "6(iii)",
        title: "Subordinates",
        titleUrdu: "ماتحت",
        leftText: "Courteous and effective; encouraging",
        leftUrdu: "شائستہ، مؤثر اور حوصلہ افزا",
        rightText: "Discourteous and intolerant; harsh",
        rightUrdu: "بدتمیز، عدم برداشت والا؛ سخت گیر",
      },
    ],
  },
  {
    key: "behavior-with-public",
    number: "7.",
    title: "Behavior with public",
    titleUrdu: "عوام سے برتاو",
    leftText: "Courteous and helpful",
    leftUrdu: "خوش اخلاق اور مددگار",
    rightText: "Arrogant, discourteous and indifferent",
    rightUrdu: "متکبر، بدتمیز اور لاپرواہ",
  },
  {
    key: "routine-matters",
    number: "8.",
    title: "Ability to decide routine matters",
    titleUrdu: "روزمرہ امور میں فیصلہ کرنے کی صلاحیت",
    leftText: "Logical and decisive",
    leftUrdu: "منطقی اور فیصلہ کن",
    rightText: "Indecisive; vacillating",
    rightUrdu: "غیر فیصلہ کن؛ تذبذب کا شکار",
  },
  {
    key: "knowledge-of-laws",
    number: "9.",
    title: "Knowledge of relevant laws, rules, regulations, instructions and procedures",
    titleUrdu: "متعلقہ قوانین، قواعد، ضوابط، ہدایات اور طریقہ کار کا علم",
    leftText: "Exceptionally well informed, keeps abreast of latest developments.",
    leftUrdu: "بہت اچھی طرح باخبر اور تازہ ترین پیش رفت سے آگاہ۔",
    rightText: "Ignorant and uninformed.",
    rightUrdu: "لاعلم اور بے خبر۔",
  },
];

export const per1718PartIVRows: ReplicaRatingRow[] = [
  {
    key: "quality-of-work",
    number: "1.",
    title: "Quality of work",
    titleUrdu: "کام کا معیار",
    leftText: "Always produces work of exceptionally high quality",
    leftUrdu: "ہمیشہ غیر معمولی اعلیٰ معیار کا کام پیش کرتا ہے",
    rightText: "Generally produces work of poor quality.",
    rightUrdu: "عموماً کم معیار کا کام پیش کرتا ہے۔",
  },
  {
    key: "output-of-work",
    number: "2.",
    title: "Output of work",
    titleUrdu: "کام کی مقدار",
    leftText: "Always up-to-date; accumulates no arrears",
    leftUrdu: "ہمیشہ اپ ٹو ڈیٹ؛ کوئی زیر التوا کام جمع نہیں ہونے دیتا",
    rightText: "Always behind schedule; very slow disposal.",
    rightUrdu: "ہمیشہ تاخیر کا شکار؛ بہت سست رفتار",
  },
];

export const per1718IntegrityRows: ReplicaRatingRow[] = [
  {
    key: "integrity",
    number: "1.",
    title: "Integrity",
    titleUrdu: "دیانتداری",
    categoryOnly: true,
    subRows: [
      {
        key: "integrity-general",
        number: "a.",
        title: "General",
        titleUrdu: "عمومی",
        leftText: "Irreproachable",
        leftUrdu: "بے داغ",
        rightText: "Unscrupulous",
        rightUrdu: "بے اصول",
      },
      {
        key: "integrity-intellectual",
        number: "b.",
        title: "Intellectual",
        titleUrdu: "فکری",
        leftText: "Honest & straightforward",
        leftUrdu: "دیانت دار اور صاف گو",
        rightText: "Devious; Sycophant",
        rightUrdu: "مکار؛ چاپلوس",
      },
    ],
  },
];

export const per1718OverallGradingOptions: ReplicaDecisionOption[] = [
  { key: "very-good", option: "(i)", label: "Very Good", labelUrdu: "بہت اچھا" },
  { key: "good", option: "(ii)", label: "Good", labelUrdu: "اچھا" },
  { key: "average", option: "(iii)", label: "Average", labelUrdu: "اوسط" },
  { key: "below-average", option: "(iv)", label: "Below Average", labelUrdu: "اوسط سے کم" },
];

export const per1718FitnessOptions: ReplicaDecisionOption[] = [
  { key: "fit-for-promotion", option: "(i)", label: "Fit for promotion", labelUrdu: "ترقی کے لیے موزوں" },
  {
    key: "assessment-premature",
    option: "(ii)",
    label: "Recently promoted/appointed. Assessment premature",
    labelUrdu: "حال ہی میں ترقی/تقرری۔ جائزہ قبل از وقت",
  },
  { key: "not-yet-fit", option: "(iii)", label: "Not yet fit for promotion", labelUrdu: "ابھی ترقی کے لیے موزوں نہیں" },
  {
    key: "unlikely-to-progress",
    option: "(iv)",
    label: "Unlikely to progress further",
    labelUrdu: "مزید ترقی کا امکان نہیں",
  },
];
