import React from 'react';

// Reusable form primitives for government document forms

const ReplicaCheckboxSquare: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    data-replica-field="check"
    className={`mx-auto flex h-4 w-4 items-center justify-center border border-black bg-white ${className}`.trim()}
  ></div>
);

const ReplicaTextBlock: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    data-replica-field="text"
    className={`w-full rounded-sm px-1 ${className}`.trim()}
  ></div>
);

export const UnderlinedField: React.FC<{
  label: string;
  labelUrdu?: string;
  width?: string;
  inline?: boolean;
}> = ({ label, labelUrdu, width = 'flex-1', inline = false }) => (
  <div className={inline ? 'inline-flex items-baseline gap-2' : 'flex flex-col mb-3'}>
    <div className="text-sm">
      {label}
      {labelUrdu && <div className="text-xs text-right font-urdu mt-0.5">{labelUrdu}</div>}
    </div>
    <div data-replica-field="text" className={`${width} border-b border-black min-h-[24px] px-1`}></div>
  </div>
);

export const RatingTable: React.FC<{
  title: string;
  titleUrdu?: string;
  rows: Array<{
    number?: number;
    label: string;
    labelUrdu?: string;
    subItems?: Array<{ label: string; labelUrdu?: string }>;
    hasCheckboxes?: boolean;
  }>;
  showRemarks?: boolean;
}> = ({ title, titleUrdu, rows, showRemarks = true }) => (
  <div className="mt-4">
    <div className="font-bold text-sm mb-2">
      {title}
      {titleUrdu && <div className="font-urdu text-xs mt-0.5">{titleUrdu}</div>}
    </div>
    <table className="w-full border-collapse border border-black text-xs">
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black p-2 text-left font-bold w-1/2"></th>
          <th className="border-r border-black p-1 text-center font-bold w-12">A1</th>
          <th className="border-r border-black p-1 text-center font-bold w-12">A</th>
          <th className="border-r border-black p-1 text-center font-bold w-12">B</th>
          <th className="border-r border-black p-1 text-center font-bold w-12">C</th>
          <th className="border-r border-black p-1 text-center font-bold w-12">D</th>
          {showRemarks && <th className="p-2 text-center font-bold w-32">Remarks</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <React.Fragment key={idx}>
            <tr className="border-b border-black">
              <td className="border-r border-black p-2">
                {row.number && <span className="font-bold mr-2">{row.number}.</span>}
                {row.label}
                {row.labelUrdu && (
                  <div className="font-urdu text-xs mt-1">{row.labelUrdu}</div>
                )}
              </td>
              {row.hasCheckboxes ? (
                <td colSpan={5} className="border-r border-black p-2 text-center">
                  <div className="flex justify-center gap-8">
                    <label className="flex items-center gap-2">
                      <span className="text-xs">Yes</span>
                      <div data-replica-field="check" className="h-6 w-6 border-2 border-black"></div>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-xs">No</span>
                      <div data-replica-field="check" className="h-6 w-6 border-2 border-black"></div>
                    </label>
                  </div>
                </td>
              ) : (
                <>
                  <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                  <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                  <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                  <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                  <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                </>
              )}
              {showRemarks && !row.hasCheckboxes && <td className="p-2 align-top"><ReplicaTextBlock className="min-h-[26px]" /></td>}
              {showRemarks && row.hasCheckboxes && <td className="p-2 align-top"><ReplicaTextBlock className="min-h-[26px]" /></td>}
            </tr>
            {row.subItems?.map((subItem, subIdx) => (
              <tr key={`${idx}-${subIdx}`} className="border-b border-black">
                <td className="border-r border-black p-2 pl-8">
                  ({String.fromCharCode(97 + subIdx)}) {subItem.label}
                  {subItem.labelUrdu && (
                    <div className="font-urdu text-xs mt-1">{subItem.labelUrdu}</div>
                  )}
                </td>
                <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                <td className="border-r border-black p-1 align-middle"><ReplicaCheckboxSquare /></td>
                {showRemarks && <td className="p-2 align-top"><ReplicaTextBlock className="min-h-[26px]" /></td>}
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
);

export const AssessmentTable: React.FC<{
  bilingual?: boolean;
}> = ({ bilingual = false }) => (
  <table className="w-full border-collapse border border-black text-xs mt-2">
    <thead>
      <tr className="border-b border-black">
        <th className="border-r border-black p-2 text-center font-bold">
          Very Good
          {bilingual && <div className="font-urdu text-xs mt-1">بہت اچھا</div>}
        </th>
        <th className="border-r border-black p-2 text-center font-bold">
          Good
          {bilingual && <div className="font-urdu text-xs mt-1">اچھا</div>}
        </th>
        <th className="border-r border-black p-2 text-center font-bold">
          Average
          {bilingual && <div className="font-urdu text-xs mt-1">اوسط</div>}
        </th>
        <th className="border-r border-black p-2 text-center font-bold">
          Below Average
          {bilingual && <div className="font-urdu text-xs mt-1">اوسط سے کم</div>}
        </th>
        <th className="border-r border-black p-2 text-center font-bold">
          Poor
          {bilingual && <div className="font-urdu text-xs mt-1">ناقص</div>}
        </th>
        <th className="p-2 text-center font-bold">
          Special aptitude, if any
          {bilingual && <div className="font-urdu text-xs mt-1">خاص صلاحیت اگر کوئی ہو</div>}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="border-r border-black p-4 align-middle"><ReplicaCheckboxSquare /></td>
        <td className="border-r border-black p-4 align-middle"><ReplicaCheckboxSquare /></td>
        <td className="border-r border-black p-4 align-middle"><ReplicaCheckboxSquare /></td>
        <td className="border-r border-black p-4 align-middle"><ReplicaCheckboxSquare /></td>
        <td className="border-r border-black p-4 align-middle"><ReplicaCheckboxSquare /></td>
        <td className="p-4 align-top"><ReplicaTextBlock className="min-h-[48px]" /></td>
      </tr>
    </tbody>
  </table>
);

export const PromotionCheckboxes: React.FC<{
  bilingual?: boolean;
}> = ({ bilingual = false }) => {
  const items = [
    { text: 'Recommended for accelerated promotion', urdu: 'سریع ترقی کے لیے سفارش' },
    { text: 'Fit for promotion', urdu: 'ترقی کے لیے موزوں' },
    { text: 'Recently promoted/appointed, consideration for promotion premature', urdu: 'حال ہی میں ترقی یا تقرری، ترقی کی غور و فکر قبل از وقت ہے' },
    { text: 'Not yet fit for promotion', urdu: 'ترقی کے لیے ابھی موزوں نہیں' },
    { text: 'Unfit for further promotion', urdu: 'مزید ترقی کے لیے غیر موزوں' },
  ];

  return (
    <div className="space-y-3 mt-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-start justify-between py-2">
          <div className="flex-1">
            <span className="text-xs">
              ({String.fromCharCode(97 + idx)}) {item.text}
            </span>
            {bilingual && (
                <div className="font-urdu text-xs mt-1">{item.urdu}</div>
              )}
            </div>
          <div data-replica-field="check" className="ml-4 h-8 w-8 flex-shrink-0 border-2 border-black"></div>
        </div>
      ))}
      <div className="flex items-start justify-between py-2">
        <div className="flex-1">
          <span className="text-xs">
            (f) Fitness for retention after 25 years service
          </span>
          {bilingual && (
            <div className="font-urdu text-xs mt-1">25 سال کی خدمت کے بعد برقرار رکھنے کے لیے فٹنس</div>
          )}
        </div>
        <div className="flex items-center gap-4 ml-4">
          <label className="flex items-center gap-2">
            <span className="text-xs">Fit{bilingual && <span className="font-urdu">/موزوں</span>}</span>
            <div data-replica-field="check" className="h-8 w-8 border-2 border-black"></div>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs">Unfit{bilingual && <span className="font-urdu">/غیر موزوں</span>}</span>
            <div data-replica-field="check" className="h-8 w-8 border-2 border-black"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export const PenPictureSection: React.FC<{
  bilingual?: boolean;
}> = ({ bilingual = false }) => (
  <div className="mt-6">
    <h3 className="text-center font-bold text-base mb-4">
      PEN-PICTURE
      {bilingual && <div className="font-urdu text-sm mt-1">قلمی تصویر</div>}
    </h3>
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} data-replica-field="text" className="min-h-[32px] border-b border-black px-1"></div>
      ))}
    </div>
  </div>
);

export const SignatureBlock: React.FC<{
  scope: "reporting" | "countersigning";
  title: string;
  titleUrdu?: string;
  showStamp?: boolean;
}> = ({ scope, title, titleUrdu, showStamp = true }) => (
  <div className="mt-8 mb-6">
    <div className="grid grid-cols-[1fr_auto_1.2fr] gap-6 items-end">
      <div className="text-xs">
        <div className="font-semibold">Dated</div>
        {titleUrdu && <div className="font-urdu mt-1">تاریخ</div>}
        <div className="mt-2 border-b border-black min-h-[24px]">
          <div data-replica-field="text" data-replica-binding={`${scope}-signature-date`} className="min-h-[24px] px-1"></div>
        </div>
      </div>
      <div className="text-center text-xs">
        {showStamp && (
          <div className="flex flex-col items-center">
            <div
              data-replica-field="asset"
              data-replica-binding={`${scope}-official-stamp`}
              data-replica-asset-kind="STAMP"
              className="stamp-block h-20 w-20 rounded-full border-2 border-dashed border-transparent mb-2 flex items-center justify-center transition-colors"
            >
              <span className="text-[10px] text-gray-400">Official Stamp</span>
            </div>
            <span>
              Official Stamp
              {titleUrdu && <div className="font-urdu mt-1">دفتری مہر</div>}
            </span>
          </div>
        )}
      </div>
      <div className="text-xs text-right flex flex-col items-end">
        <div
          data-replica-field="asset"
          data-replica-binding={`${scope}-signature`}
          data-replica-asset-kind="SIGNATURE"
          className="signature-block h-20 w-52 border-2 border-dashed border-transparent mb-2 flex items-center justify-center transition-colors"
        >
          <span className="text-gray-400">Signature</span>
        </div>
        <div className="w-56 border-t border-black pt-2 text-center">
          <div
            data-replica-field="text"
            data-replica-binding={`${scope}-officer-name`}
            className="min-h-[24px] px-1 font-semibold"
          ></div>
        </div>
        <div className="w-56 border-t border-black pt-1 text-center">
          <div
            data-replica-field="text"
            data-replica-binding={`${scope}-officer-designation`}
            className="min-h-[24px] px-1"
          ></div>
        </div>
        <div className="mt-2 max-w-56 text-center">
          {title}
          {titleUrdu && <div className="font-urdu text-right mt-1">{titleUrdu}</div>}
        </div>
      </div>
    </div>
  </div>
);

export const RuledLines: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4 my-4">
    {[...Array(count)].map((_, i) => (
      <div key={i} data-replica-field="text" className="min-h-[24px] border-b border-black px-1"></div>
    ))}
  </div>
);

export const PageBreak: React.FC = () => (
  <div className="page-break"></div>
);

export const FormPage: React.FC<{
  children: React.ReactNode;
  pageNumber?: number;
}> = ({ children, pageNumber }) => (
  <div className="form-page bg-white p-12 min-h-[297mm] relative">
    {children}
    {pageNumber && (
      <div className="absolute bottom-8 left-0 right-0 text-center text-xs">
        {pageNumber}
      </div>
    )}
  </div>
);
