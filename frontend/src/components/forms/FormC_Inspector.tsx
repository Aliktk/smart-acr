import React from 'react';
import { FormPage, SignatureBlock } from './FormPrimitives';

/**
 * Form C: FIA INSPECTOR / INSPECTOR (LEGAL) / S.I / A.S.I
 * 6 pages, English only
 */

const FormC_Page1: React.FC = () => (
  <FormPage pageNumber={1}>
    {/* Header */}
    <div className="flex justify-between items-start mb-6">
      <div className="text-center flex-1">
        <div className="font-bold text-lg">FEDERAL INVESTIGATION AGENCY</div>
      </div>
      <div className="text-right font-bold text-sm">
        CONFIDENTIAL
      </div>
    </div>

    <div data-replica-scope="clerk">
    <div className="flex justify-end mb-6 text-sm">
      <div className="w-64 space-y-3">
        <div className="flex justify-between border-b border-black">
          <span>Zone/Circle/Sub-Circle</span>
          <span data-replica-field="text" data-replica-binding="zone-circle-sub-circle" className="inline-block w-32 px-1 text-right"></span>
        </div>
        <div className="flex justify-between border-b border-black">
          <span>Direct/Deputationist</span>
          <span data-replica-field="text" data-replica-binding="direct-deputationist" className="w-32 px-1"></span>
        </div>
      </div>
    </div>

    <div className="text-center font-bold text-sm mb-8 px-12 leading-relaxed">
      ANNUAL CONFIDENTIAL REPORT ON THE WORKING ON INSPECTOR / INSPECTOR (LEGAL) / S.I / A.S.I <br/>
      <span className="inline-flex items-center gap-2 mt-2">
        FOR THE PERIOD FROM
        <span data-replica-field="text" data-replica-binding="reporting-period-from" className="inline-block border-b border-black w-32 px-1"></span>
        TO
        <span data-replica-field="text" data-replica-binding="reporting-period-to" className="inline-block border-b border-black w-32 px-1"></span>
      </span>
    </div>

    {/* PART I */}
    <div className="mb-8">
      <h2 className="font-bold text-center text-base mb-6">PART I</h2>

      <div className="space-y-4 text-sm">
        <div className="flex gap-4">
          <div className="flex-1 flex border-b border-black pb-1">
            <span className="mr-2">(i) Name</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>
          <div className="flex-1 flex border-b border-black pb-1">
            <span className="mr-2">S/o</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>
        </div>

        <div className="flex border-b border-black pb-1">
          <span className="mr-2">(ii) Post held</span>
          <span data-replica-field="text" className="flex-1 px-1"></span>
        </div>

        <div className="flex border-b border-black pb-1">
          <span className="mr-2">(iii) Rank/Grade</span>
          <span data-replica-field="text" className="flex-1 px-1"></span>
        </div>

        <div>
          <div className="flex border-b border-black pb-1 mb-4">
            <span className="mr-2">(iv) Training courses attended</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>
          <div data-replica-field="text" className="mb-4 min-h-[24px] border-b border-black px-1"></div>
          <div data-replica-field="text" className="mb-4 min-h-[24px] border-b border-black px-1"></div>
        </div>

        <div>
          <div className="flex border-b border-black pb-1 mb-4">
            <span className="mr-2">(v) Departmental enquiry if any, instituted against him</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>
          <div data-replica-field="text" className="mb-4 min-h-[24px] border-b border-black px-1"></div>
        </div>

        <div>
          <div className="flex border-b border-black pb-1 mb-4">
            <span className="mr-2">(vi) Any major/minor punishment awarded</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>
          <div data-replica-field="text" className="mb-4 min-h-[24px] border-b border-black px-1"></div>
        </div>

        <div>
          <div className="flex border-b border-black pb-1 mb-4">
            <span className="mr-2">(vii) Any Reward / Commendation Certificate / Letter of Appreciation</span>
            <span data-replica-field="text" className="flex-1 px-1"></span>
          </div>
          <div data-replica-field="text" className="mb-4 min-h-[24px] border-b border-black px-1"></div>
        </div>
      </div>
    </div>
    </div>

    {/* PART II */}
    <div data-replica-scope="reporting">
      <h2 className="font-bold text-center text-base mb-6">PART II</h2>
      <div className="font-bold text-sm mb-4">A — Performance</div>
      
      <div className="mb-2 font-bold text-sm">1. Rating as crime control officer</div>
      <table className="w-full border-collapse border border-black text-sm">
        <thead>
          <tr className="border-b border-black">
            <th className="border-r border-black p-2 text-left font-bold w-1/2"></th>
            <th className="border-r border-black p-2 text-center font-bold w-20">Very good</th>
            <th className="border-r border-black p-2 text-center font-bold w-20">Good</th>
            <th className="border-r border-black p-2 text-center font-bold w-20">Average</th>
            <th className="p-2 text-center font-bold w-24">Below Average</th>
          </tr>
        </thead>
        <tbody>
          {[
            '(a) Investigating ability and initiative in anti corruption cases and ability in mobilizing source of information',
            '(b) Capability for interrogation',
            '(c) Detection of forged documents / immigration cases',
            '(d) Number of successful raids / traps'
          ].map((label, idx) => (
            <tr key={idx} className="border-b border-black">
              <td className="border-r border-black p-2">{label}</td>
              <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
              <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
              <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
              <td className="p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            </tr>
          ))}
          <tr className="border-b border-black">
            <td className="border-r border-black p-2">(e) Disposal of cases</td>
            <td colSpan={4} className="p-2 text-center">
               <div className="flex justify-end gap-2">
                 <div data-replica-field="text" className="h-8 w-16 border border-black px-1"></div>
                 <div data-replica-field="text" className="h-8 w-16 border border-black px-1"></div>
               </div>
            </td>
          </tr>
          <tr className="border-b border-black">
            <td className="border-r border-black p-2">(f) Disposal of enquiries</td>
            <td colSpan={4} className="p-2 text-center">
               <div className="flex justify-end gap-2">
                 <div data-replica-field="text" className="h-8 w-16 border border-black px-1"></div>
                 <div data-replica-field="text" className="h-8 w-16 border border-black px-1"></div>
               </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </FormPage>
);

const FormC_Page2: React.FC = () => (
  <FormPage pageNumber={2}>
    <div data-replica-scope="reporting">
    <div className="font-bold text-sm mb-4">2. Rating as Inspector / Legal</div>
    
    <div className="flex justify-between border-b border-black pb-1 mb-4 text-sm">
      <span>(a) Number of cases prosecuted</span>
      <span data-replica-field="text" className="w-48 px-1"></span>
    </div>
    
    <div className="flex justify-between border-b border-black pb-1 mb-6 text-sm">
      <span>(b) Number of cases convicted</span>
      <span data-replica-field="text" className="w-48 px-1"></span>
    </div>

    <table className="w-full border-collapse border border-black text-sm mb-6">
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black p-2 text-left w-1/2"></th>
          <th className="border-r border-black p-2 text-center w-20">Very good</th>
          <th className="border-r border-black p-2 text-center w-20">Good</th>
          <th className="border-r border-black p-2 text-center w-20">Average</th>
          <th className="p-2 text-center w-24">Below average</th>
        </tr>
      </thead>
      <tbody>
        {[
          '(c) Ability to prosecute cases in courts',
          '(d) Legal acumen and knowledge of procedures'
        ].map((label, idx) => (
          <tr key={idx} className="border-b border-black">
            <td className="border-r border-black p-2">{label}</td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="font-bold text-sm mb-6">3. Rating as Supervisory Officer</div>

    <div className="font-bold text-sm mb-4">B — Personal Traits</div>
    
    <div className="font-bold text-sm mb-2">4. Rating as leader of men</div>
    <table className="w-full border-collapse border border-black text-sm mb-6">
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black p-2 text-left w-1/2"></th>
          <th className="border-r border-black p-2 text-center w-20">Very good</th>
          <th className="border-r border-black p-2 text-center w-20">Good</th>
          <th className="border-r border-black p-2 text-center w-20">Average</th>
          <th className="p-2 text-center w-24">Below average</th>
        </tr>
      </thead>
      <tbody>
        {[
          '(a) Readiness to accepts responsibility',
          '(b) Readiness to take action / report against subordinates'
        ].map((label, idx) => (
          <tr key={idx} className="border-b border-black">
            <td className="border-r border-black p-2">{label}</td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="font-bold text-sm mb-2">5. Relations with:</div>
    <table className="w-full border-collapse border border-black text-sm mb-6">
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black p-2 text-left w-1/2"></th>
          <th className="border-r border-black p-2 text-center w-20">Very good</th>
          <th className="border-r border-black p-2 text-center w-20">Good</th>
          <th className="border-r border-black p-2 text-center w-20">Tolerable</th>
          <th className="p-2 text-center w-24">Bad</th>
        </tr>
      </thead>
      <tbody>
        {[
          '(a) Public',
          '(b) Colleagues',
          '(c) Attitude towards subordinates'
        ].map((label, idx) => (
          <tr key={idx} className="border-b border-black">
            <td className="border-r border-black p-2">{label}</td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="border-r border-black p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
            <td className="p-2 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="font-bold text-sm mb-2">6. Punctuality</div>
    <div className="flex gap-12 mb-6 ml-8">
      <label className="flex items-center gap-2">
        <span>Punctual</span>
        <div data-replica-field="check" className="h-4 w-4 border border-black"></div>
      </label>
      <label className="flex items-center gap-2">
        <span>UnPunctual</span>
        <div data-replica-field="check" className="h-4 w-4 border border-black"></div>
      </label>
    </div>

    <div className="font-bold text-sm mb-2">7. Standard of living</div>
    <div className="space-y-3 mb-6 ml-8 text-sm">
      <div className="flex justify-between items-center w-3/4">
        <span>(a) Lives within known means of income</span>
        <div data-replica-field="check" className="h-4 w-4 border border-black"></div>
      </div>
      <div className="flex justify-between items-center w-3/4">
        <span>(b) Reported to be living beyond known means of income</span>
        <div data-replica-field="check" className="h-4 w-4 border border-black"></div>
      </div>
    </div>

    <div className="font-bold text-sm mb-4">8. Personality & General turn-out</div>
    
    <div className="font-bold text-sm mb-2">9. Standard of health</div>
    <table className="w-full border-collapse border border-black text-sm">
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black p-2 text-center w-1/4">Very good</th>
          <th className="border-r border-black p-2 text-center w-1/4">Good</th>
          <th className="border-r border-black p-2 text-center w-1/4">Average</th>
          <th className="p-2 text-center w-1/4">Poor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border-r border-black p-4 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
          <td className="border-r border-black p-4 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
          <td className="border-r border-black p-4 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
          <td className="p-4 text-center"><div data-replica-field="check" className="mx-auto h-4 w-4 border border-black"></div></td>
        </tr>
      </tbody>
    </table>
    </div>
  </FormPage>
);

const FormC_Page3: React.FC = () => (
  <FormPage pageNumber={3}>
    <div data-replica-scope="reporting">
    <div className="space-y-4 mb-8 text-sm">
      <div className="flex border-b border-black pb-1">
        <span className="mr-2">10. General reputation and moral habits</span>
        <span data-replica-field="text" className="flex-1 px-1"></span>
      </div>
      <div data-replica-field="text" className="min-h-[24px] border-b border-black px-1"></div>
      
      <div className="flex justify-between items-center w-1/2">
        <span className="font-bold">11. Integrity</span>
        <div data-replica-field="check" className="h-8 w-8 border border-black"></div>
      </div>
    </div>

    <div className="font-bold text-sm mb-2">A — General Assessment</div>
    <div className="font-bold text-sm mb-2">PART III</div>
    <div className="text-sm mb-2">(Initial the appropriate box below)</div>

    <table className="w-full border-collapse border border-black text-sm mb-8">
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black p-2 text-center w-1/5">Very good<br/>(A–I)</th>
          <th className="border-r border-black p-2 text-center w-1/5">Good<br/>(A)</th>
          <th className="border-r border-black p-2 text-center w-1/5">Average<br/>(B)</th>
          <th className="border-r border-black p-2 text-center w-1/5">Below average<br/>(C)</th>
          <th className="p-2 text-center w-1/5">Special aptitude, if any</th>
        </tr>
      </thead>
    <tbody>
      <tr>
          <td className="border-r border-black p-6 text-center"><div data-replica-field="check" className="mx-auto h-5 w-5 border border-black"></div></td>
          <td className="border-r border-black p-6 text-center"><div data-replica-field="check" className="mx-auto h-5 w-5 border border-black"></div></td>
          <td className="border-r border-black p-6 text-center"><div data-replica-field="check" className="mx-auto h-5 w-5 border border-black"></div></td>
          <td className="border-r border-black p-6 text-center"><div data-replica-field="check" className="mx-auto h-5 w-5 border border-black"></div></td>
          <td className="p-6 align-top"><div data-replica-field="text" className="min-h-[48px] w-full px-1"></div></td>
      </tr>
    </tbody>
  </table>

    <div className="font-bold text-sm mb-2">B — Suitability for Promotion</div>
    <div className="text-sm mb-4">(Initial the appropriate box below)</div>

    <div className="space-y-4 mb-8 text-sm w-3/4">
      {[
        '(a) Recommended for accelerated promotion',
        '(b) Fit for promotion',
        '(c) Recently promoted/appointed, consideration for promotion pre-mature',
        '(d) Not yet fit for promotion, but likely to be fit in course of time',
        '(e) Unfit for promotion, has reached his ceiling'
      ].map((label, idx) => (
        <div key={idx} className="flex justify-between items-center">
          <span>{label}</span>
          <div data-replica-field="check" className="h-6 w-6 border border-black"></div>
        </div>
      ))}
    </div>

    <div className="font-bold text-sm mb-4">C — Fitness for retention after 25 years service</div>
    <div className="flex gap-12 ml-8">
      <label className="flex items-center gap-2">
        <span>Fit</span>
        <div data-replica-field="check" className="h-6 w-6 border border-black"></div>
      </label>
      <label className="flex items-center gap-2">
        <span>Unfit</span>
        <div data-replica-field="check" className="h-6 w-6 border border-black"></div>
      </label>
    </div>
    </div>
  </FormPage>
);

const FormC_Page4: React.FC = () => (
  <FormPage pageNumber={4}>
    <div data-replica-scope="reporting">
    <h2 className="font-bold text-center text-base mb-6">D. Pen Picture</h2>
    <div data-replica-field="text" className="mb-8 min-h-[260px] border border-black p-4"></div>
    <SignatureBlock scope="reporting" title="Signature, Name & Designation of Reporting Officer" showStamp={true} />
    </div>

    <div className="border-t border-black w-full my-8"></div>

    <div data-replica-scope="countersigning">
      <h2 className="font-bold text-center text-base mb-2">PART IV</h2>
      <h3 className="text-center text-sm mb-12">Remarks of the Countersigning Officer</h3>

      <div className="mb-12 space-y-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} data-replica-field="text" className="min-h-[28px] border-b border-black px-1"></div>
        ))}
      </div>

      <SignatureBlock scope="countersigning" title="Signature, Name & Designation" showStamp={true} />
    </div>
  </FormPage>
);

const FormC_Page5: React.FC = () => (
  <FormPage pageNumber={5}>
    <h2 className="font-bold text-[11px] mb-2">A. INSTRUCTIONS FOR MINISTRIES, DEPARTMENTS, ETC.</h2>
    <div className="text-[10px] space-y-1.5 text-justify mb-3">
      <p><span className="mr-2 font-semibold">1.</span>The report will be initiated by the branch officer and countersigned by the next higher officer.</p>
      <p><span className="mr-2 font-semibold">2.</span>The reporting officer should apply his mind carefully to the assessment of the subordinate's character and working. The assessment should be objective and impartial.</p>
      <p><span className="mr-2 font-semibold">3.</span>If any adverse remarks are recorded, they should be communicated to the official concerned to give him an opportunity to improve.</p>
    </div>

    <h2 className="font-bold text-[11px] mt-3 mb-2">B. INSTRUCTIONS FOR THE OFFICERS RESPONSIBLE FOR THE CUSTODY OF CHARACTER ROLLS</h2>
    <div className="text-[10px] space-y-1.5 text-justify mb-3">
      <p><span className="mr-2 font-semibold">1.</span>The Character Roll is a highly confidential document and must be kept in safe custody.</p>
      <p><span className="mr-2 font-semibold">2.</span>When an official is transferred from one office to another, his Character Roll should be sent to his new office under sealed cover.</p>
    </div>

    <h2 className="font-bold text-[11px] mt-3 mb-2">C. INSTRUCTIONS FOR THE REPORTING OFFICER</h2>
    <div className="text-[10px] space-y-1.5 text-justify mb-3">
      <p>(i) Ensure that the form is filled in duplicate.</p>
      <p>(ii) Complete the assessment in Part II carefully.</p>
      <p>(iii) The "Pen Picture" in Part IV should be a comprehensive assessment of the officer's strengths, weaknesses, and overall suitability.</p>
      <p>(iv) Sign and date the report before submitting it to the Countersigning Officer.</p>
    </div>

    <h2 className="font-bold text-[11px] mt-3 mb-2">D. INSTRUCTIONS FOR THE COUNTERSIGNING OFFICER</h2>
    <div className="text-[10px] space-y-1.5 text-justify">
      <p><span className="mr-2 font-semibold">1.</span>Review the assessment made by the Reporting Officer.</p>
      <p><span className="mr-2 font-semibold">2.</span>Add any additional remarks or observations in the space provided.</p>
      <p><span className="mr-2 font-semibold">3.</span>If you disagree with any assessment made by the Reporting Officer, state the reasons clearly.</p>
      <p><span className="mr-2 font-semibold">4.</span>Sign and date the report.</p>
    </div>
  </FormPage>
);

const FormC_Inspector: React.FC = () => {
  return (
    <div className="bg-gray-100 flex flex-col items-center gap-8 py-8 w-full print:bg-white print:py-0 print:gap-0">
      <FormC_Page1 />
      <FormC_Page2 />
      <FormC_Page3 />
      <FormC_Page4 />
      <FormC_Page5 />
    </div>
  );
};

export default FormC_Inspector;
