import React from 'react';
import {
  RatingTable,
  AssessmentTable,
  PromotionCheckboxes,
  PenPictureSection,
  SignatureBlock,
  PageBreak,
  FormPage
} from './FormPrimitives';

/**
 * Form B: S-121-E (Revised)
 * ANNUAL RESTRICTED REPORT FORM FOR ASSISTANT PRIVATE SECRETARY / STENOTYPISTS
 * 8 pages, bilingual (English + Urdu), NO countersigning section
 */

const FormB_Page1: React.FC = () => (
  <FormPage pageNumber={1}>
    {/* Header */}
    <div className="flex justify-between items-start mb-6">
      <div className="text-sm">S-121-E-(Revised)</div>
      <div className="text-right text-sm">
        <div className="font-bold">ANNUAL RESTRICTED REPORT FORM</div>
        <div className="mt-1">FOR ASSISTANT PRIVATE SECRETARY / STENOTYPISTS</div>
        <div className="font-urdu text-xs mt-2">اسسٹنٹ پرائیویٹ سیکریٹری / اسٹینوٹائپسٹ کے لیے سالانہ محدود رپورٹ فارم</div>
      </div>
    </div>

    <div data-replica-scope="clerk">
      {/* Government of Pakistan */}
      <div className="text-center mb-6">
        <div className="font-bold text-base">GOVERNMENT OF PAKISTAN</div>
        <div className="font-urdu text-sm mt-1">حکومت پاکستان</div>
        <div className="text-xs mt-3">
          Name of Ministry/Division/Department/Office
        </div>
        <div className="font-urdu text-xs mt-1">وزارت/ڈویژن/محکمہ/دفتر کا نام</div>
        <div className="mx-auto mt-2 min-h-[24px] max-w-xl border-b border-black">
          <div data-replica-field="text" data-replica-binding="office-scope-label" className="min-h-[24px] px-1"></div>
        </div>
      </div>

      {/* Report period */}
      <div className="text-center mb-6 text-sm">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          ANNUAL/SPECIAL REPORT FOR THE PERIOD FROM
          <span data-replica-field="text" data-replica-binding="reporting-period-from" className="inline-block border-b border-black w-24 px-1"></span>
          20
          <span data-replica-field="text" data-replica-binding="reporting-period-from-year" className="inline-block border-b border-black w-8 px-1"></span>
          TO
          <span data-replica-field="text" data-replica-binding="reporting-period-to" className="inline-block border-b border-black w-24 px-1"></span>
          20
          <span data-replica-field="text" data-replica-binding="reporting-period-to-year" className="inline-block border-b border-black w-8 px-1"></span>
        </div>
        <div className="font-urdu text-xs mt-2">مدت ____ 20__ سے ____ 20__ کے لیے سالانہ/خصوصی رپورٹ</div>
      </div>

      {/* PART I */}
      <div className="mb-4">
        <h2 className="font-bold text-center text-base">PART-I</h2>
        <div className="font-urdu text-center text-sm mb-4">حصہ اول</div>

        <div className="space-y-3 text-xs">
          <div className="flex gap-4">
            <div className="flex-1">
              Name / <span className="font-urdu">نام</span>
              <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
            </div>
            <div className="flex-1">
              Date of Birth / <span className="font-urdu">تاریخ پیدائش</span>
              <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              Designation / <span className="font-urdu">عہدہ</span>
              <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
            </div>
            <div className="w-32">
              BS / <span className="font-urdu">بی ایس</span>
              <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
            </div>
            <div className="flex-1">
              Basic Pay / <span className="font-urdu">بنیادی تنخواہ</span>
              <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
            </div>
          </div>

          <div>
            Date of entry into Government Service / <span className="font-urdu">سرکاری ملازمت میں داخلے کی تاریخ</span>
            <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
          </div>

          <div>
            Date of appointment to the present BS / <span className="font-urdu">موجودہ بی ایس پر تقرری کی تاریخ</span>
            <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
          </div>

          <div>
            Qualifications / <span className="font-urdu">تعلیمی قابلیت</span>
            <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
          </div>

          <div>
            Training courses, attended, if any / <span className="font-urdu">تربیتی کورسز، اگر کوئی ہو</span>
            <div data-replica-field="text" className="border-b border-black mt-1 min-h-[24px] px-1"></div>
          </div>
        </div>
      </div>
    </div>

    {/* PART II */}
    <div className="mt-6" data-replica-scope="reporting">
      <h2 className="font-bold text-center text-base">PART-II</h2>
      <div className="font-urdu text-center text-sm mb-3">حصہ دوم</div>

      <RatingTable
        title="A. PERFORMANCE"
        titleUrdu="کارکردگی"
        rows={[
          {
            number: 1,
            label: 'Standard of Shorthand/Typing',
            labelUrdu: 'شارٹ ہینڈ/ٹائپنگ کا معیار',
            subItems: [
              { label: 'Speed', labelUrdu: 'رفتار' },
              { label: 'Accuracy', labelUrdu: 'درستگی' }
            ]
          },
          {
            number: 2,
            label: 'Attending Telephones',
            labelUrdu: 'ٹیلی فون کا جواب دینا',
            subItems: [
              { label: 'Etiquette', labelUrdu: 'آداب' },
              { label: 'Checking unnecessary intrusion', labelUrdu: 'غیر ضروری مداخلت کی جانچ' },
              { label: 'Economy', labelUrdu: 'اقتصادیات' }
            ]
          }
        ]}
      />
    </div>
  </FormPage>
);

const FormB_Page2: React.FC = () => (
  <FormPage pageNumber={2}>
    <div data-replica-scope="reporting">
    <RatingTable
      title=""
      rows={[
        {
          number: 3,
          label: "Maintenance of officer's engagement diary and conducting of visitors",
          labelUrdu: 'افسر کی مصروفیت کی ڈائری کی دیکھ بھال اور زائرین کی رہنمائی'
        }
      ]}
    />

    <RatingTable
      title="B. PERFORMANCE"
      titleUrdu="کارکردگی"
      rows={[
        {
          number: 4,
          label: 'Movement of files and records of suspense cases',
          labelUrdu: 'فائلوں کی نقل و حرکت اور التواء میں پڑے کیسز کا ریکارڈ'
        },
        {
          number: 5,
          label: 'Dress and cleanliness',
          labelUrdu: 'لباس اور صفائی'
        },
        {
          number: 6,
          label: 'Other duties, e.g. tour arrangements, provision of amenities, etc.',
          labelUrdu: 'دیگر فرائض، مثلاً دورے کے انتظامات، سہولیات کی فراہمی وغیرہ'
        },
        {
          number: 7,
          label: 'Regularity and punctuality in attendance',
          labelUrdu: 'حاضری میں باقاعدگی اور وقت کی پابندی'
        }
      ]}
    />

    <RatingTable
      title="C. PERSONAL TRAITS"
      titleUrdu="ذاتی خصوصیات"
      rows={[
        {
          number: 8,
          label: 'Intelligence',
          labelUrdu: 'ذہانت'
        },
        {
          number: 9,
          label: 'Perseverance and devotion to duty',
          labelUrdu: 'فرض کی انجام دہی میں استقامت'
        },
        {
          number: 10,
          label: 'Co-operation and tact',
          labelUrdu: 'تعاون اور تدبر'
        },
        {
          number: 11,
          label: 'Amenability to discipline',
          labelUrdu: 'نظم و ضبط کی پابندی'
        },
        {
          number: 12,
          label: 'Integrity',
          labelUrdu: 'دیانتداری'
        },
        {
          number: 13,
          label: 'Trustworthiness in confidential and secret matters',
          labelUrdu: 'خفیہ اور سری معاملات میں قابل اعتماد',
          hasCheckboxes: true
        }
      ]}
    />

    <div className="text-xs italic mt-4 mb-2">
      <span className="font-bold">Note—</span> The rating should be recorded by initialling the appropriate box:
      <div className="font-urdu text-xs mt-1">نوٹ— مناسب خانے پر مختصر دستخط سے درجہ بندی ریکارڈ کی جائے</div>
    </div>

    <div className="text-xs flex gap-4 flex-wrap">
      <span>'A1' Very good / <span className="font-urdu">بہت اچھا</span></span>
      <span>'A' Good / <span className="font-urdu">اچھا</span></span>
      <span>'B' Average / <span className="font-urdu">اوسط</span></span>
      <span>'C' Below Average / <span className="font-urdu">اوسط سے کم</span></span>
      <span>'D' Poor / <span className="font-urdu">ناقص</span></span>
    </div>
    </div>
  </FormPage>
);

const FormB_Page3: React.FC = () => (
  <FormPage pageNumber={3}>
    <div data-replica-scope="reporting">
    {/* PART III */}
    <div className="mt-4">
      <h2 className="font-bold text-center text-base">PART-III</h2>
      <div className="font-urdu text-center text-sm">حصہ سوم</div>
      <h3 className="font-bold text-center text-sm mt-2">GENERAL ASSESSMENT</h3>
      <div className="font-urdu text-center text-xs">عمومی جائزہ</div>
      <div className="text-xs text-center italic mt-2 mb-3">
        (Appraise in the present grade by initialling the appropriate column below)
        <div className="font-urdu text-xs mt-1">موجودہ گریڈ میں نیچے دیے گئے مناسب کالم پر مختصر دستخط کر کے جائزہ لیں</div>
      </div>

      <AssessmentTable bilingual={true} />
    </div>

    {/* PART IV */}
    <div className="mt-8">
      <h2 className="font-bold text-center text-base">PART-IV</h2>
      <div className="font-urdu text-center text-sm">حصہ چہارم</div>
      <h3 className="font-bold text-center text-sm mt-2">SUITABILITY FOR PROMOTION</h3>
      <div className="font-urdu text-center text-xs">ترقی کے لیے موزونیت</div>
      <div className="text-xs text-center italic mt-2 mb-3">
        (Initial the appropriate box below)
        <div className="font-urdu text-xs mt-1">نیچے دیے گئے مناسب خانے پر مختصر دستخط کریں</div>
      </div>

      <PromotionCheckboxes bilingual={true} />
    </div>
    </div>
  </FormPage>
);

const FormB_Page4: React.FC = () => (
  <FormPage pageNumber={4}>
    <div data-replica-scope="reporting">
      <PenPictureSection bilingual={true} />

      <div className="mt-8">
        <SignatureBlock
          scope="reporting"
          title="Signature, Name & Designation of Reporting Officer"
          titleUrdu="رپورٹنگ افسر کے دستخط، نام اور عہدہ"
          showStamp={true}
        />
      </div>
    </div>

    {/* NO COUNTERSIGNING SECTION - This is a key difference from Form A */}
  </FormPage>
);

const FormB_Page5: React.FC = () => (
  <FormPage pageNumber={5}>
    <h3 className="font-bold text-[11px] mb-2 text-center">Assistant Private Secretary (APS) / Stenotypists</h3>

    <h3 className="font-bold text-[11px] mb-2">A. INSTRUCTIONS FOR MINISTRIES, DEPARTMENTS, ETC.</h3>
    <div className="text-[10px] space-y-1.5 text-justify">
      <p><span className="mr-2 font-semibold">1.</span>The reports will be initiated by the officer to whom the Stenographer / Stenotypist is attached.</p>
      <p><span className="mr-2 font-semibold">2.</span>When an adverse remark is made in the evaluation report of the official reported upon, a copy of the whole report should be furnished to him within one month from the date the report is countersigned. A serious view should be taken of any failure to furnish a copy containing adverse remarks.</p>
      <p><span className="mr-2 font-semibold">3.</span>Officials making representations against adverse remarks should not make personal remarks against the integrity of reporting officers. Violation will be considered misconduct and may render the representation liable to be summarily rejected.</p>
      <p><span className="mr-2 font-semibold">4.</span>Any remarks to the effect that the person reported upon has or has not taken steps to remedy the defects pointed out in the previous year should also be communicated.</p>
      <p><span className="mr-2 font-semibold">5.</span>Adverse remarks should be communicated by the senior officer incharge of establishment matters in the Ministry/Division/Department/Office concerned.</p>
      <p><span className="mr-2 font-semibold">6.</span>Annual performance evaluation reports containing adverse remarks should not be taken into consideration until communicated following rule A-2 above and a decision taken on the representation, if any.</p>
    </div>

    <h3 className="font-bold text-[11px] mt-3 mb-2">B. INSTRUCTIONS FOR THE OFFICERS RESPONSIBLE FOR THE CUSTODY OF CHARACTER ROLLS</h3>
    <div className="text-[10px] space-y-1.5 text-justify">
      <p><span className="mr-2 font-semibold">1.</span>Arrange for the completion of the routine part of form and send it to the reporting officer concerned.</p>
      <p><span className="mr-2 font-semibold">2.</span>Go through each report carefully to see if there are any adverse remarks underlined in red ink. If so, arrange to have them communicated to the person concerned immediately, with the direction that his representation, if any, should be submitted within a fortnight.</p>
      <p><span className="mr-2 font-semibold">3.</span>Arrange to obtain a decision on the representation, if any, and communicate it to the official concerned within one month. Place a copy of the representation in the dossier.</p>
      <p><span className="mr-2 font-semibold">4.</span>Keep the duplicate as well as original copies of the evaluation reports in your office.</p>
      <p><span className="mr-2 font-semibold">5.</span>If an official has been receiving adverse remarks for two successive years from the same reporting officer, take up the question of placing him under another reporting officer.</p>
    </div>

    <h3 className="font-bold text-[11px] mt-3 mb-2">C. INSTRUCTIONS FOR THE REPORTING OFFICER</h3>
    <div className="text-[10px] space-y-1.5 text-justify">
      <p>While reporting on each subordinate: (i) Be as objective as possible. (ii) Be as accurate as possible. (iii) State all positive and negative points or issues in your remarks. (iv) Be fair to your subordinates.</p>
      <p><span className="mr-2 font-semibold">2.</span>State whether any of the defects reported have already been brought to the notice of the person concerned and whether there has been any improvement.</p>
      <p><span className="mr-2 font-semibold">3.</span>Fill this form in duplicate and affix your signature on both, at the end of the 'general remarks'.</p>
      <p><span className="mr-2 font-semibold">4.</span>After an evaluation is complete, send it to the officer responsible for the custody of character rolls.</p>
    </div>
  </FormPage>
);

const FormB_Page7: React.FC = () => (
  <FormPage pageNumber={7}>
    <div className="font-urdu text-right leading-loose space-y-4 text-sm">
      <h3 className="font-bold text-base mb-4 text-center">
        اسسٹنٹ پرائیویٹ سیکریٹری (اے پی ایس) / اسٹینوٹائپسٹ
      </h3>

      <h3 className="font-bold mb-3">الف۔ وزارتوں، محکموں وغیرہ کے لیے ہدایات</h3>

      <p>
        ۱۔ رپورٹس اس افسر کی طرف سے شروع کی جائیں گی جس سے اسٹینوگرافر / اسٹینوٹائپسٹ منسلک ہے۔
      </p>

      <p>
        ۲۔ جب رپورٹ شدہ اہلکار کی تشخیصی رپورٹ میں کوئی منفی تبصرہ کیا جائے تو پوری رپورٹ کی ایک کاپی
        اسے جلد سے جلد فراہم کی جائے، اور بہرحال رپورٹ پر دستخط کی تاریخ سے ایک ماہ کے اندر، ایک
        یادداشت کے ساتھ، جس کی ایک کاپی پر اسے رپورٹ کی رسید کے طور پر دستخط کرکے واپس کرنا ہوگا
        اور اسے کردار رول میں ریکارڈ کے لیے رکھا جائے گا۔ متعلقہ اہلکار کی طرف سے رپورٹ شدہ شخص کو
        منفی تبصرے والی رپورٹ کی کاپی فراہم کرنے میں کسی ناکامی کو سنجیدگی سے لیا جائے گا۔
      </p>

      <p>
        ۳۔ اپنی تشخیصی رپورٹوں میں درج منفی تبصروں کے خلاف نمائندگی کرنے والے اہلکاروں کو رپورٹنگ
        افسران کی دیانت داری کے خلاف کوئی ذاتی تبصرہ یا تبصرے نہیں کرنا چاہیے۔ اس قاعدے کی خلاف ورزی
        بدانتظامی تصور کی جائے گی اور نمائندگی کو مسترد کرنے کا باعث بھی بنے گی۔
      </p>

      <p>
        ۴۔ اس اثر کے کوئی تبصرے کہ رپورٹ شدہ شخص نے گزشتہ سال اسے بتائی گئی خامیوں کو دور کرنے کے
        لیے اقدامات کیے ہیں یا نہیں، بھی بتائے جائیں۔
      </p>

      <p>
        ۵۔ منفی تبصرے متعلقہ وزارت/ڈویژن/محکمہ/دفتر میں اسٹیبلشمنٹ کے معاملات کے انچارج سینئر
        افسر کی طرف سے بتائے جائیں۔
      </p>

      <p>
        ۶۔ منفی تبصروں پر مشتمل سالانہ کارکردگی کی تشخیصی رپورٹ پر اس وقت تک غور نہیں کیا جائے گا
        جب تک کہ انہیں اوپر قاعدہ اے-۲ کے مطابق بتایا نہیں جاتا اور رپورٹ شدہ شخص کی نمائندگی پر
        فیصلہ نہیں لیا جاتا۔
      </p>

      <h3 className="font-bold mt-6 mb-3">
        ب۔ کردار رولز کی تحویل کے ذمہ دار افسران کے لیے ہدایات
      </h3>

      <p>
        ۱۔ فارم کے معمول کے حصے کی تکمیل کا بندوبست کریں اور اسے متعلقہ رپورٹنگ افسر کو بھیجیں۔
      </p>

      <p>
        ۲۔ ہر رپورٹ کو احتیاط سے دیکھیں تاکہ یہ معلوم ہو سکے کہ آیا سرخ سیاہی میں کوئی منفی تبصرے
        ہیں۔ اگر ایسا ہے تو، فوری طور پر متعلقہ شخص کو ان کی اطلاع دینے کا بندوبست کریں اور ہدایت دیں
        کہ ان تبصروں کی رسید کے ایک پندرہ روز کے اندر اس کی نمائندگی جمع کرائی جائے۔
      </p>

      <p>
        ۳۔ نمائندگی پر فیصلہ حاصل کرنے کا بندوبست کریں اور ایک ماہ کے اندر متعلقہ اہلکار کو اطلاع دیں۔
        نمائندگی کی ایک کاپی ڈوزیئر میں رکھیں۔
      </p>

      <p>
        ۴۔ تشخیصی رپورٹوں کی نقول اور اصل کاپیاں اپنے دفتر میں رکھیں۔
      </p>

      <p>
        ۵۔ اگر کوئی اہلکار ایک ہی رپورٹنگ افسر سے مسلسل دو سال تک منفی تبصرے حاصل کر رہا ہے تو اسے
        دوسرے رپورٹنگ افسر کے ماتحت رکھنے کا سوال اٹھائیں۔
      </p>
    </div>
  </FormPage>
);

const FormB_Page8: React.FC = () => (
  <FormPage pageNumber={8}>
    <div className="font-urdu text-right leading-loose space-y-4 text-sm">
      <h3 className="font-bold mb-3">ج۔ رپورٹنگ افسر کے لیے ہدایات</h3>

      <p>
        ہر ماتحت پر رپورٹ کرتے وقت: —
      </p>

      <div className="mr-6 space-y-2">
        <p>(i) جتنا ممکن ہو معروضی بنیں۔</p>
        <p>(ii) جتنا ممکن ہو درست ہوں۔</p>
        <p>(iii) اپنے تبصروں میں تمام مثبت اور منفی نکات یا مسائل بیان کریں۔</p>
        <p>(iv) اپنے ماتحتوں کے ساتھ منصفانہ رہیں۔</p>
      </div>

      <p>
        ۲۔ بتائیں کہ آیا رپورٹ کی گئی خامیوں کو پہلے ہی متعلقہ شخص کے علم میں لایا گیا ہے
        اور جن کے بارے میں پہلے آگاہ کیا گیا ہے، کیا ان میں کوئی بہتری آئی ہے۔
      </p>

      <p>
        ۳۔ اس فارم کو دو نقول میں بھریں اور 'عمومی تبصروں' کے آخر میں دونوں پر اپنے دستخط کریں۔
      </p>

      <p>
        ۴۔ تشخیص مکمل ہونے کے بعد، اسے کردار رولز کی تحویل کے ذمہ دار افسر کو بھیجیں۔
      </p>
    </div>
  </FormPage>
);

const FormB_S121E: React.FC = () => (
  <div className="form-container">
    <FormB_Page1 />
    <PageBreak />
    <FormB_Page2 />
    <PageBreak />
    <FormB_Page3 />
    <PageBreak />
    <FormB_Page4 />
    <PageBreak />
    <FormB_Page5 />
    <PageBreak />
    <FormB_Page7 />
    <PageBreak />
    <FormB_Page8 />
  </div>
);

export default FormB_S121E;
