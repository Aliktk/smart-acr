import React from 'react';
import {
  RatingTable,
  AssessmentTable,
  PromotionCheckboxes,
  PenPictureSection,
  SignatureBlock,
  RuledLines,
  PageBreak,
  FormPage
} from './FormPrimitives';

/**
 * Form A: S-121 C (Revised)
 * CONFIDENTIAL REPORT FORM for ASSISTANTS / U.D.Cs / L.D.Cs
 * 4 pages, English only, includes countersigning
 */

const FormA_Page1: React.FC = () => (
  <FormPage pageNumber={1}>
    {/* Header */}
    <div className="flex justify-between items-start mb-6">
      <div className="text-sm">S-121 C (Revised)</div>
      <div className="text-right text-sm">
        <div className="font-bold">CONFIDENTIAL REPORT FORM</div>
        <div className="mt-1">for</div>
        <div className="mt-1 font-bold">ASSISTANTS / U.D.Cs / L.D.Cs</div>
      </div>
    </div>

    <div data-replica-scope="clerk">
      {/* Government of Pakistan */}
      <div className="text-center mb-6">
        <div className="font-bold text-base">GOVERNMENT OF PAKISTAN</div>
        <div className="text-xs mt-2">
          Name of Ministry/Division/Department/Office
        </div>
        <div className="mx-auto mt-2 min-h-[24px] max-w-xl border-b border-black">
          <div data-replica-field="text" data-replica-binding="office-scope-label" className="min-h-[24px] px-1"></div>
        </div>
      </div>

      {/* Report type and period */}
      <div className="flex items-center gap-8 mb-6">
        <div className="flex flex-col">
          <div data-replica-field="check" className="text-xs border border-black px-3 py-1 mb-1">ANNUAL</div>
          <div data-replica-field="check" className="text-xs border border-black px-3 py-1">SPECIAL</div>
        </div>
        <div className="flex-1 text-center text-sm">
          REPORT FOR THE PERIOD
          <span className="inline-flex items-center gap-2 mt-2">
            FROM
            <span data-replica-field="text" data-replica-binding="reporting-period-from" className="inline-block border-b border-black w-24 px-1"></span>
            20
            <span data-replica-field="text" data-replica-binding="reporting-period-from-year" className="inline-block border-b border-black w-8 px-1"></span>
            to
            <span data-replica-field="text" data-replica-binding="reporting-period-to" className="inline-block border-b border-black w-24 px-1"></span>
            20
            <span data-replica-field="text" data-replica-binding="reporting-period-to-year" className="inline-block border-b border-black w-8 px-1"></span>
          </span>
        </div>
      </div>

      {/* PART I */}
      <div className="mb-4">
        <h2 className="font-bold text-center text-base mb-4">PART I</h2>

        <div className="space-y-3 text-xs">
          <div className="flex gap-4">
            <div className="flex-1">
              Name <span data-replica-field="text" className="border-b border-black inline-block w-64 ml-2 px-1"></span>
            </div>
            <div className="flex-1">
              Date of birth <span data-replica-field="text" className="border-b border-black inline-block w-48 ml-2 px-1"></span>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              Designation <span data-replica-field="text" className="border-b border-black inline-block w-48 ml-2 px-1"></span>
            </div>
            <div className="w-32">
              BPS <span data-replica-field="text" className="border-b border-black inline-block w-16 ml-2 px-1"></span>
            </div>
            <div className="flex-1">
              Basic Pay <span data-replica-field="text" className="border-b border-black inline-block w-32 ml-2 px-1"></span>
            </div>
          </div>

          <div>
            Date of entry into Govt. service <span data-replica-field="text" className="border-b border-black inline-block w-96 ml-2 px-1"></span>
          </div>

          <div>
            Date of appointment to the present BPS <span data-replica-field="text" className="border-b border-black inline-block w-80 ml-2 px-1"></span>
          </div>

          <div>
            Qualifications <span data-replica-field="text" className="border-b border-black inline-block w-full ml-2 max-w-2xl px-1"></span>
          </div>

          <div>
            Training course, attended if any <span data-replica-field="text" className="border-b border-black inline-block w-full ml-2 max-w-2xl px-1"></span>
          </div>

          <div>
            Nature of duties on which employed <span data-replica-field="text" className="border-b border-black inline-block w-full ml-2 max-w-xl px-1"></span>
          </div>
        </div>
      </div>
    </div>

    {/* PART II */}
    <div className="mt-6" data-replica-scope="reporting">
      <h2 className="font-bold text-center text-base mb-2">PART II</h2>

      <div className="text-xs italic mb-2">
        <span className="font-bold">Note. —</span> The rating should be recorded by initialling the appropriate box / column:
      </div>

      <div className="text-xs mb-3 flex gap-6">
        <span>'A1' Very Good</span>
        <span>'A' Good</span>
        <span>'B' Average</span>
        <span>'C' Below Average</span>
        <span>'D' Poor</span>
      </div>

      <RatingTable
        title="A. PERFORMANCE"
        rows={[
          {
            number: 1,
            label: 'Referencing and paging of notes and correspondence'
          },
          {
            number: 2,
            label: 'Keeping of files and papers in tidy condition'
          },
          {
            number: 3,
            label: 'Maintenance of records (including recording and indexing)'
          },
          {
            number: 4,
            label: 'Skill in noting and drafting, where applicable'
          },
          {
            number: 5,
            label: 'Other duties, e.g. Cashier duties, preparation of bills, statements and returns, etc.'
          },
          {
            number: 6,
            label: 'Other Clerical duties, e.g. typing, diary/despatch, disbursement of cash, statements/returns'
          },
          {
            number: 7,
            label: 'Regularity and punctuality in attendance'
          },
          {
            number: 8,
            label: 'Standard of work',
            subItems: [
              { label: 'Quality' },
              { label: 'Out-put' }
            ]
          }
        ]}
      />
    </div>
  </FormPage>
);

const FormA_Page2: React.FC = () => (
  <FormPage pageNumber={2}>
    <div data-replica-scope="reporting">
      <RatingTable
      title="B. PERSONAL TRAITS"
      rows={[
        {
          number: 9,
          label: 'Intelligence'
        },
        {
          number: 10,
          label: 'Perseverance and devotion to duty'
        },
        {
          number: 11,
          label: 'Co-operation and tact'
        },
        {
          number: 12,
          label: 'Amenability to discipline'
        },
        {
          number: 13,
          label: 'Integrity'
        },
        {
          number: 14,
          label: 'Trust worthiness in confidential and secret matters',
          hasCheckboxes: true
        }
      ]}
      />

      {/* PART III */}
      <div className="mt-8">
        <h2 className="font-bold text-center text-base mb-2">PART III</h2>
        <h3 className="font-bold text-center text-sm mb-1">GENERAL ASSESSMENT</h3>
        <div className="text-xs text-center italic mb-3">
          (Appraise in the present grade by initialling the appropriate column below)
        </div>

        <AssessmentTable />
      </div>

      {/* PART IV */}
      <div className="mt-8">
        <h2 className="font-bold text-center text-base mb-2">PART IV</h2>
        <h3 className="font-bold text-center text-sm mb-1">SUITABILITY FOR PROMOTION</h3>
        <div className="text-xs text-center italic mb-3">
          (Initial the appropriate box below)
        </div>

        <PromotionCheckboxes />
      </div>
    </div>
  </FormPage>
);

const FormA_Page3: React.FC = () => (
  <FormPage pageNumber={3}>
    <div data-replica-scope="reporting">
      <PenPictureSection />

      <SignatureBlock scope="reporting" title="Signature, Name and Designation of Reporting Officer." />
    </div>

    <div data-replica-scope="countersigning">
      {/* PART V */}
      <div className="mt-8 mb-6">
        <h2 className="font-bold text-center text-base mb-2">PART V</h2>
        <h3 className="font-bold text-center text-sm mb-4">REMARKS OF THE COUNTERSIGNING OFFICER</h3>

        <RuledLines count={3} />
      </div>

      <SignatureBlock scope="countersigning" title="Signature, Name & Designation" showStamp={true} />
    </div>

    {/* Instructions begin */}
    <div className="mt-12 border-t-2 border-black pt-4">
      <h3 className="font-bold text-sm mb-3">A. INSTRUCTIONS FOR MINISTRIES, DEPARTMENTS, ETC.</h3>

      <div className="text-xs space-y-3 text-justify">
        <p>
          <span className="mr-3">1.</span>
          The reports will be initiated by the Branch/Section Officer incharge and will be countersigned by the next higher
          officer, both being concerned with the work of the person reported upon.
        </p>

        <p>
          <span className="mr-3">2.</span>
          When an adverse remark is made in the confidential report of the official reported upon, a copy of the whole
          report should be furnished to him at the earliest opportunity, and in any case within one month from the date the report
          is countersigned, with a memorandum a copy of which should be signed and returned by him in acknowledgement of the report
          and be in turn placed in the character roll for record. A serious view should be taken of any failure on the part of the
          official concerned to furnish a copy of the report containing adverse remarks to the person reported upon.
        </p>

        <p>
          <span className="mr-3">3.</span>
          The officials making representations against adverse remarks recorded in their confidential reports should not
          make any personal remark or remarks against the integrity of the reporting officers. Violation of this rule will be considered
          a misconduct and will also render the representation liable to be summarily rejected.
        </p>
      </div>
    </div>
  </FormPage>
);

const FormA_Page4: React.FC = () => (
  <FormPage pageNumber={4}>
    <div className="text-xs space-y-3 text-justify">
      <p>
        <span className="mr-3">4.</span>
        When a report is both upon on the individual opinion of the reporting and countersigning officers, it is only
        the report is intended to be a complete one.
      </p>

      <p>
        <span className="mr-3">5.</span>
        Remarks in cases where the reporting/countersigning officeruspends judgement, should not be communicated.
      </p>

      <p>
        <span className="mr-3">6.</span>
        The adverse remarks communicated by the Branch/Section Officer incharge or by the countersigning officer to the
        Establishment Officer upon his on her request in the previous years should also be communicated.
      </p>

      <p>
        <span className="mr-3">7.</span>
        Annual Confidential/Sensitive adverse remarks should not be taken into consideration until they
        have been communicated following rule A-2 above and a decision taken thereon by the officer responsible for custody of reports in
        open.
      </p>
    </div>

    <h3 className="font-bold text-sm mt-6 mb-3">B. INSTRUCTIONS FOR THE OFFICERS RESPONSIBLE FOR THE CUSTODY OF CHARACTER ROLLS</h3>

    <div className="text-xs space-y-3 text-justify">
      <p>
        <span className="mr-3">1.</span>
        Arrange for the completion of the routine part of form and send it to the reporting officer concerned.
      </p>

      <p>
        <span className="mr-3">2.</span>
        On receipt of the completed form from the reporting officer attach an along with relevant note for the
        countersigning officer.
      </p>

      <p>
        <span className="mr-3">3.</span>
        See that all entries and remarks, if any, of there are differences of opinion as regards any part in red ink- If so,
        arrange to have them communicated to the person concerned immediately with the direction that his representation, if any,
        should be submitted along with a signed acknowledgement of the adverse remarks by him.
      </p>

      <p>
        <span className="mr-3">4.</span>
        Arrange to obtain a decision on the representation, if any, and communicate it to the official concerned along with
        one seal. Place a copy of the representation in the dossier.
      </p>

      <p>
        <span className="mr-3">5.</span>
        If an official has been receiving adverse remarks for two successive years from the same reporting officer, take
        up the question of placing him under another reporting officer.
      </p>
    </div>

    <h3 className="font-bold text-sm mt-6 mb-3">C. INSTRUCTIONS FOR THE REPORTING OFFICERS</h3>

    <div className="text-xs space-y-3 text-justify">
      <p>
        While reporting on each subordinate: —
      </p>
      <p className="ml-6">
        (i) Be as objective as possible.<br/>
        (ii) Be as accurate as possible.<br/>
        (iii) State all positive and negative points or issues in your remarks.<br/>
        (iv) Be fair to your subordinates.
      </p>

      <p>
        <span className="mr-3">2.</span>
        State whether any of the defects reported have already been brought to the notice of the person concerned
        and whether in the case of those already brought to notice, there has been any improvement.
      </p>

      <p>
        <span className="mr-3">3.</span>
        Fill this form in duplicate and affix your signature on both, at the end of the 'general remarks'.
      </p>

      <p>
        <span className="mr-3">4.</span>
        After an evaluation is complete, pass on the form to the officer authorized to countersign. Retain a copy and roll in your
        office.
      </p>
    </div>

    <h3 className="font-bold text-sm mt-6 mb-3">D. INSTRUCTIONS FOR THE COUNTERSIGNING OFFICERS</h3>

    <div className="text-xs space-y-3 text-justify">
      <p>
        <span className="mr-3">1.</span>
        Weigh the remarks of the reporting officer against (a) your personal knowledge, if any, of the person reported
        upon, (b) the previous reports in his character roll and then give your own remarks at the end of the report.
      </p>

      <p>
        <span className="mr-3">2.</span>
        If you consider that a particular remark on the reporting officer is strong and should be expunged, score it out
        in red and give reasons for such adverse action, with a direction that your remarks in red should be communicated to the person
        concerned. If you do not wholly agree with remarks give you own remarks either against the relevant entry or at the end of the report.
      </p>

      <p>
        <span className="mr-3">3.</span>
        See whether any adverse remarks were, in your opinion, are taken or not should or be has taken steps to remedy the defects pointed out to him. Comment on this aspect unless the reporting
        officer has already done so.
      </p>

      <p>
        <span className="mr-3">4.</span>
        After countersigning or adverse remarks which are to be communicated to the person
        reported upon. Please see also instructions 2 and 4 to 6 under A — Instructions for Ministries, Departments etc.
      </p>

      <p>
        <span className="mr-3">5.</span>
        After completing the form, return it to the officer responsible for the custody of the character roll.
      </p>
    </div>

    <div className="text-center text-xs mt-8 text-gray-600">
      PGP/PK—LRH/1996/07/DC/44F—100,000 Loose
    </div>
  </FormPage>
);

const FormA_S121C: React.FC = () => (
  <div className="form-container">
    <FormA_Page1 />
    <PageBreak />
    <FormA_Page2 />
    <PageBreak />
    <FormA_Page3 />
    <PageBreak />
    <FormA_Page4 />
  </div>
);

export default FormA_S121C;
