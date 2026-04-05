import React from 'react';
import {
  RatingTable,
  AssessmentTable,
  PromotionCheckboxes,
  PenPictureSection,
  SignatureBlock,
  RuledLines,
  FormPage
} from './FormPrimitives';

/**
 * Form D: S-121-B (Revised)
 * ANNUAL RESTRICTED REPORT FORM FOR SUPERINTENDENT / ASSISTANT INCHARGE
 * 4 pages, bilingual English + Urdu
 */

const FormD_Page1: React.FC = () => (
  <FormPage pageNumber={1}>
    <div className="flex justify-between items-start mb-6">
      <div className="text-sm">S-121-B (Revised)</div>
      <div className="text-right text-sm">
        <div className="font-bold">Annual Restricted Report form</div>
        <div className="font-urdu mt-1">سالانہ محدود رپورٹ فارم</div>
        <div className="mt-1">for Superintendent / Assistant Incharge</div>
        <div className="font-urdu mt-1">برائے سپرنٹنڈنٹ / اسسٹنٹ انچارج</div>
      </div>
    </div>

    <div data-replica-scope="clerk">
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

      <div className="text-center text-sm font-bold mb-8">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          Annual/Special report for the period from
          <span data-replica-field="text" data-replica-binding="reporting-period-from" className="inline-block border-b border-black w-24 px-1"></span>
          20
          <span data-replica-field="text" data-replica-binding="reporting-period-from-year" className="inline-block border-b border-black w-8 px-1"></span>
          to
          <span data-replica-field="text" data-replica-binding="reporting-period-to" className="inline-block border-b border-black w-24 px-1"></span>
          20
          <span data-replica-field="text" data-replica-binding="reporting-period-to-year" className="inline-block border-b border-black w-8 px-1"></span>
        </div>
        <div className="font-urdu text-xs mt-1">سالانہ/خصوصی رپورٹ برائے عرصہ _________ 20__ تا _________ 20__</div>
      </div>

      {/* PART I */}
      <div className="mb-6">
        <h2 className="font-bold text-center text-base mb-1">PART-I</h2>
        <div className="font-urdu text-center text-sm mb-4">حصہ اول</div>

        <div className="space-y-4 text-xs">
          <div className="flex gap-4 border-b border-black pb-1">
            <span className="font-bold w-16">Name</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
            <span className="font-bold w-24 border-l border-black pl-2">Date of Birth</span>
            <span data-replica-field="text" className="w-32 px-1"></span>
          </div>

          <div className="flex gap-4 border-b border-black pb-1">
            <span className="font-bold w-24">Designation</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
            <span className="font-bold w-8 border-l border-black pl-2">BS</span>
            <span data-replica-field="text" className="w-16 px-1"></span>
            <span className="font-bold w-20 border-l border-black pl-2">Basic Pay</span>
            <span data-replica-field="text" className="w-32 px-1"></span>
          </div>

          <div className="flex border-b border-black pb-1">
            <span className="font-bold mr-2">Date of entry into Government Service</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>

          <div className="flex border-b border-black pb-1">
            <span className="font-bold mr-2">Date of appointment to present BS</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>

          <div className="flex border-b border-black pb-1">
            <span className="font-bold mr-2">Qualifications</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>

          <div className="flex border-b border-black pb-1">
            <span className="font-bold mr-2">Training course, attended, if any</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>

          <div className="flex border-b border-black pb-1">
            <span className="font-bold mr-2">Nature of duties on which employed</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>
        </div>
      </div>
    </div>

    {/* PART II */}
    <div data-replica-scope="reporting">
      <h2 className="font-bold text-center text-base mb-1">PART-II</h2>
      <div className="font-urdu text-center text-sm mb-4">حصہ دوم</div>

      <RatingTable
        title="A. PERFORMANCE"
        titleUrdu="الف۔ کارکردگی"
        rows={[
          { number: 1, label: 'Regularity and punctuality in attendance', labelUrdu: 'حاضری میں باقاعدگی اور پابندی' },
          { number: 2, label: 'Knowledge of procedure and regulations', labelUrdu: 'طریقہ کار اور ضوابط کا علم' },
          { number: 3, label: 'Capacity for ensuring prompt disposal of work', labelUrdu: 'کام کو فوری نمٹانے کی صلاحیت' },
          { number: 4, label: 'Submission of cases in proper order', labelUrdu: 'معاملات کی مناسب ترتیب میں پیشی' },
          { number: 5, label: 'Ability to handle:', labelUrdu: 'سنبھالنے کی صلاحیت:', subItems: [
            { label: 'difficult cases', labelUrdu: 'مشکل معاملات' },
            { label: 'simple cases', labelUrdu: 'آسان معاملات' }
          ]}
        ]}
      />
    </div>
  </FormPage>
);

const FormD_Page2: React.FC = () => (
  <FormPage pageNumber={2}>
    <div data-replica-scope="reporting">
    <RatingTable
      title="PERFORMANCE (continued)"
      titleUrdu="کارکردگی (جاری)"
      rows={[
        { number: 6, label: 'Maintaining discipline in the Section', labelUrdu: 'سیکشن میں نظم و ضبط برقرار رکھنا' },
        { number: 7, label: 'Standard of work:', labelUrdu: 'کام کا معیار:', subItems: [
          { label: 'quality', labelUrdu: 'معیار' },
          { label: 'output', labelUrdu: 'مقدار' }
        ]}
      ]}
    />

    <RatingTable
      title="B. Superintendence of Work"
      titleUrdu="ب۔ کام کی نگرانی"
      rows={[
        { number: 8, label: 'Capacity to train/help and advice less experienced staff', labelUrdu: 'کم تجربہ کار عملے کو تربیت/مدد اور مشورہ دینے کی صلاحیت' },
        { number: 9, label: 'Allocation of work so that no man is unduly burdened', labelUrdu: 'کام کی تقسیم تاکہ کسی پر غیر ضروری بوجھ نہ پڑے' },
        { number: 10, label: 'Maintenance of Record (including recording and indexing)', labelUrdu: 'ریکارڈ کی دیکھ بھال (بشمول ریکارڈنگ اور انڈیکسنگ)' },
        { number: 11, label: 'Maintenance of tidiness in premises', labelUrdu: 'احاطے میں صفائی کی دیکھ بھال' }
      ]}
    />

    <RatingTable
      title="C. Personal Traits"
      titleUrdu="ج۔ ذاتی خصوصیات"
      rows={[
        { number: 12, label: 'Intelligence', labelUrdu: 'ذہانت' },
        { number: 13, label: 'Perseverance and devotion to duty', labelUrdu: 'ثابت قدمی اور فرض شناسی' },
        { number: 14, label: 'Cooperation and tact', labelUrdu: 'تعاون اور حکمت عملی' },
        { number: 15, label: 'Amenability to discipline', labelUrdu: 'نظم و ضبط کی پابندی' },
        { number: 16, label: 'Integrity', labelUrdu: 'دیانتداری' },
        { number: 17, label: 'Trustworthiness in confidential and secret matters', labelUrdu: 'خفیہ اور رازدارانہ معاملات میں قابل اعتماد' }
      ]}
    />

    <div className="mt-8 text-xs bg-gray-50 p-4 border border-black">
      <div className="font-bold">Note: The rating should be recorded by initialling the appropriate box.</div>
      <div className="mb-2">'A1' Very good, 'A' Good, 'B' Average, 'C' Below Average, 'D' Poor.</div>
      <div className="font-urdu">نوٹ: ریٹنگ متعلقہ خانے میں دستخط کر کے درج کی جانی چاہیے۔</div>
      <div className="font-urdu">'A1' بہت اچھا، 'A' اچھا، 'B' اوسط، 'C' اوسط سے کم، 'D' ناقص۔</div>
    </div>
    </div>
  </FormPage>
);

const FormD_Page3: React.FC = () => (
  <FormPage pageNumber={3}>
    <div data-replica-scope="reporting">
    <h2 className="font-bold text-center text-base mb-1">PART-III</h2>
    <div className="font-urdu text-center text-sm mb-2">حصہ سوم</div>
    <h3 className="font-bold text-center text-sm mb-1">GENERAL ASSESSMENT</h3>
    <div className="font-urdu text-center text-sm mb-4">عمومی جائزہ</div>
    <div className="text-center text-xs mb-4">
      (Initial the appropriate box below)
      <div className="font-urdu mt-1">(نیچے دیے گئے مناسب خانے میں دستخط کریں)</div>
    </div>

    <AssessmentTable bilingual={true} />

    <div className="mt-12">
      <h2 className="font-bold text-center text-base mb-1">PART-IV</h2>
      <div className="font-urdu text-center text-sm mb-2">حصہ چہارم</div>
      <h3 className="font-bold text-center text-sm mb-1">SUITABILITY FOR PROMOTION</h3>
      <div className="font-urdu text-center text-sm mb-4">ترقی کے لیے موزونیت</div>
      <div className="text-center text-xs mb-6">
        (Initial the appropriate box below)
        <div className="font-urdu mt-1">(نیچے دیے گئے مناسب خانے میں دستخط کریں)</div>
      </div>

      <PromotionCheckboxes bilingual={true} />
    </div>
    </div>
  </FormPage>
);

const FormD_Page4: React.FC = () => (
  <FormPage pageNumber={4}>
    <div data-replica-scope="reporting">
      <PenPictureSection bilingual={true} />

      <SignatureBlock
        scope="reporting"
        title="Signature, Name & Designation of Reporting Officer"
        titleUrdu="رپورٹنگ افسر کے دستخط، نام اور عہدہ"
        showStamp={true}
      />
    </div>

    <div className="border-t border-black w-full my-8"></div>

    <div data-replica-scope="countersigning">
      <h2 className="font-bold text-center text-base mb-1">PART-V</h2>
      <div className="font-urdu text-center text-sm mb-2">حصہ پنجم</div>
      <h3 className="font-bold text-center text-sm mb-1">REMARKS OF THE COUNTERSIGNING OFFICER</h3>
      <div className="font-urdu text-center text-sm mb-4">کاؤنٹر سائننگ افسر کے ریمارکس</div>

      <RuledLines count={4} />

      <SignatureBlock
        scope="countersigning"
        title="Signature, Name & Designation"
        titleUrdu="دستخط، نام اور عہدہ"
        showStamp={true}
      />
    </div>
  </FormPage>
);

const FormD_Superintendent: React.FC = () => {
  return (
    <div className="bg-gray-100 flex flex-col items-center gap-8 py-8 w-full print:bg-white print:py-0 print:gap-0">
      <FormD_Page1 />
      <FormD_Page2 />
      <FormD_Page3 />
      <FormD_Page4 />
    </div>
  );
};

export default FormD_Superintendent;
