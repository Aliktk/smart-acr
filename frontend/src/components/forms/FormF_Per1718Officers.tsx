import React from "react";
import { FormPage } from "./FormPrimitives";
import {
  per1718Fields,
  per1718FitnessOptions,
  per1718IntegrityRows,
  per1718OverallGradingOptions,
  per1718PartIIIRows,
  per1718PartIVRows,
  per1718LanguageFields,
  per1718TrainingFields,
  type ReplicaDecisionOption,
  type ReplicaRatingRow,
} from "./templateFieldSchemas";

function PerInlineField(props: { binding: string; prefill?: string; className?: string }) {
  return (
    <span
      data-replica-field="text"
      data-replica-binding={props.binding}
      data-replica-prefill={props.prefill}
      className={`inline-block min-h-[18px] border-b border-black px-1 align-bottom ${props.className ?? ""}`.trim()}
    ></span>
  );
}

function PerBlockField(props: { binding: string; prefill?: string; className?: string }) {
  return (
    <div
      data-replica-field="text"
      data-replica-binding={props.binding}
      data-replica-prefill={props.prefill}
      className={`w-full px-1 ${props.className ?? ""}`.trim()}
    ></div>
  );
}

function PerRuledLines(props: { bindingPrefix: string; count: number; className?: string }) {
  return (
    <div className={`space-y-3 ${props.className ?? ""}`.trim()}>
      {Array.from({ length: props.count }, (_, index) => (
        <div
          key={`${props.bindingPrefix}-${index + 1}`}
          data-replica-field="text"
          data-replica-binding={`${props.bindingPrefix}-${index + 1}`}
          className="min-h-[22px] border-b border-black px-1"
        ></div>
      ))}
    </div>
  );
}

function PerSectionHeading(props: {
  title: string;
  titleUrdu?: string;
  subtitle?: string;
  subtitleUrdu?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[17px] font-bold uppercase">{props.title}</div>
      {props.titleUrdu ? <div className="mt-1 font-urdu text-[12px]">{props.titleUrdu}</div> : null}
      {props.subtitle ? <div className="mt-1 text-[11px]">{props.subtitle}</div> : null}
      {props.subtitleUrdu ? <div className="mt-1 font-urdu text-[11px]">{props.subtitleUrdu}</div> : null}
    </div>
  );
}

function PerRatingTable(props: { rows: ReplicaRatingRow[]; scope?: "reporting" | "countersigning"; className?: string }) {
  const scope = props.scope ?? "reporting";

  const renderRows = (rows: ReplicaRatingRow[], nested = false): React.ReactNode[] =>
    rows.flatMap((row) => {
      const rowNode = row.categoryOnly ? (
        <tr key={`${scope}-${row.key}-category`} className="border-b border-black align-top">
          <td className="border-r border-black px-2 py-1.5 font-semibold">{row.number}</td>
          <td className="border-r border-black px-2 py-1.5 font-semibold">
            <div className={nested ? "pl-4" : ""}>{row.title}</div>
            {row.titleUrdu ? <div className="mt-1 font-urdu text-[10px] font-normal">{row.titleUrdu}</div> : null}
          </td>
          <td className="border-r border-black"></td>
          <td className="border-r border-black"></td>
          <td className="border-r border-black"></td>
          <td className="border-r border-black"></td>
          <td></td>
        </tr>
      ) : (
        <tr key={`${scope}-${row.key}`} className="border-b border-black align-top">
          <td className="border-r border-black px-2 py-1.5 font-semibold">{row.number}</td>
          <td className="border-r border-black px-2 py-1.5">
            <div className={nested ? "pl-4" : ""}>
              <div className="font-semibold">{row.title}</div>
              {row.titleUrdu ? <div className="mt-1 font-urdu text-[10px]">{row.titleUrdu}</div> : null}
              {row.leftText ? <div className="mt-2 leading-[1.35]">{row.leftText}</div> : null}
              {row.leftUrdu ? <div className="mt-1 font-urdu text-[10px] leading-[1.4]">{row.leftUrdu}</div> : null}
            </div>
          </td>
          {(["a", "b", "c", "d"] as const).map((grade) => (
            <td key={grade} className="border-r border-black px-1 py-1 text-center align-middle">
              <div
                data-replica-field="check"
                data-replica-scope={scope}
                data-replica-binding={`${row.key}-${grade}`}
                data-replica-group={`${scope}-${row.key}`}
                className="mx-auto h-4 w-4 border-2 border-gray-600 rounded-[2px] bg-white"
              ></div>
            </td>
          ))}
          <td className="px-2 py-1.5">
            {row.rightText ? <div className="leading-[1.35]">{row.rightText}</div> : null}
            {row.rightUrdu ? <div className="mt-1 font-urdu text-[10px] leading-[1.4]">{row.rightUrdu}</div> : null}
          </td>
        </tr>
      );

      return row.subRows ? [rowNode, ...renderRows(row.subRows, true)] : [rowNode];
    });

  return (
    <table className={`w-full border-collapse border border-black text-[10px] leading-[1.25] ${props.className ?? ""}`.trim()}>
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black px-1 py-1 text-left font-semibold w-[7%]">No.</th>
          <th className="border-r border-black px-2 py-1 text-left font-semibold w-[45%]">Quality / description</th>
          <th className="border-r border-black px-1 py-1 text-center font-semibold w-[7%]">A</th>
          <th className="border-r border-black px-1 py-1 text-center font-semibold w-[7%]">B</th>
          <th className="border-r border-black px-1 py-1 text-center font-semibold w-[7%]">C</th>
          <th className="border-r border-black px-1 py-1 text-center font-semibold w-[7%]">D</th>
          <th className="px-2 py-1 text-left font-semibold w-[20%]">Opposite shade</th>
        </tr>
      </thead>
      <tbody>{renderRows(props.rows)}</tbody>
    </table>
  );
}

function PerDecisionTable(props: {
  title: string;
  titleUrdu?: string;
  options: ReplicaDecisionOption[];
  groupPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-semibold">{props.title}</div>
      {props.titleUrdu ? <div className="font-urdu text-[11px]">{props.titleUrdu}</div> : null}
      <table className="w-full border-collapse border border-black text-[10px] leading-[1.25]">
        <thead>
          <tr className="border-b border-black">
            <th className="border-r border-black px-2 py-1 text-left font-semibold w-[10%]">Option</th>
            <th className="border-r border-black px-2 py-1 text-left font-semibold">Grade</th>
            <th className="border-r border-black px-2 py-1 text-center font-semibold w-[22%]">
              Reporting officer
              <div className="mt-1 font-urdu text-[10px] font-normal">رپورٹنگ افسر</div>
            </th>
            <th className="px-2 py-1 text-center font-semibold w-[22%]">
              Countersigning officer
              <div className="mt-1 font-urdu text-[10px] font-normal">کاؤنٹر سائننگ افسر</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {props.options.map((option) => (
            <tr key={option.key} className="border-b border-black">
              <td className="border-r border-black px-2 py-1.5 font-semibold">{option.option}</td>
              <td className="border-r border-black px-2 py-1.5">
                <div>{option.label}</div>
                {option.labelUrdu ? <div className="mt-1 font-urdu text-[10px]">{option.labelUrdu}</div> : null}
              </td>
              <td className="border-r border-black px-2 py-1 text-center">
                <div
                  data-replica-field="check"
                  data-replica-scope="reporting"
                  data-replica-binding={`${props.groupPrefix}-${option.key}-reporting`}
                  data-replica-group={`${props.groupPrefix}-reporting`}
                  className="mx-auto h-4 w-4 border-2 border-gray-600 rounded-[2px] bg-white"
                ></div>
              </td>
              <td className="px-2 py-1 text-center">
                <div
                  data-replica-field="check"
                  data-replica-scope="countersigning"
                  data-replica-binding={`${props.groupPrefix}-${option.key}-countersigning`}
                  data-replica-group={`${props.groupPrefix}-countersigning`}
                  className="mx-auto h-4 w-4 border-2 border-gray-600 rounded-[2px] bg-white"
                ></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerOfficerSignatureBlock(props: {
  scope: "reporting" | "countersigning" | "second-countersigning";
  nameBinding: string;
  designationBinding: string;
  namePrefill?: string;
  designationPrefill?: string;
  title: string;
}) {
  return (
    <div data-replica-scope={props.scope} className="grid grid-cols-2 gap-x-8 gap-y-4 text-[11px]">
      <div>
        Name {props.scope === "reporting" || props.scope === "countersigning" ? "(Capital letters)" : ""}
        <PerInlineField binding={props.nameBinding} prefill={props.namePrefill} className="ml-2 w-[62%]" />
      </div>
      <div className="text-right">
        <span className="mr-2">Signature</span>
        <span
          data-replica-field="asset"
          data-replica-binding={`${props.scope}-signature`}
          data-replica-asset-kind="SIGNATURE"
          className="signature-block inline-flex h-10 w-32 items-center justify-center border-b border-black align-bottom"
        >
          <span className="text-[9px] text-gray-400">Signature</span>
        </span>
      </div>
      <div>
        Designation <PerInlineField binding={props.designationBinding} prefill={props.designationPrefill} className="ml-2 w-[60%]" />
      </div>
      <div className="text-right">
        <span className="mr-2">Date</span>
        <PerInlineField binding={`${props.scope}-signature-date`} className="w-[45%]" />
      </div>
      <div className="col-span-2 text-center text-[10px] font-medium">{props.title}</div>
    </div>
  );
}

const FormF_Page1Instructions: React.FC = () => (
  <FormPage pageNumber={1} className="px-10 py-8">
    <div className="space-y-5 text-[11px] leading-[1.35]">
      <div className="text-center text-[16px] font-bold underline">IMPORTANCE OF PER IN CAREER PLANNING</div>
      <p className="px-4 text-justify text-[12px]">
        The Performance Evaluation Report (PER) is an important document which should be completed by the stakeholders
        with utmost care in stipulated time period. It is required during the appointments as well as promotions have
        to be made.
      </p>
      <div className="text-[12px] font-semibold">
        Instructions for Officer Reported Upon / Reporting Officer / Countersigning Officer / Second Countersigning
        Officer (if applicable) / Expunging Authority
      </div>
      <table className="w-full border-collapse border border-black text-[11px] leading-[1.35]">
        <tbody>
          <tr className="border-b border-black align-top">
            <td className="border-r border-black px-2 py-2 font-semibold w-[24%]">Officer Reported Upon</td>
            <td className="px-2 py-2">
              PER along with Submission Certificate should be prepared annually at the close of each calendar year
              which is required to be dispatched to the Officer Incharge entrusted with the maintenance of his/her C.R
              dossier and copy of above certificate must also be forwarded to Establishment Division.
            </td>
          </tr>
          <tr className="border-b border-black align-top">
            <td className="border-r border-black px-2 py-2 font-semibold">Concerned Administration</td>
            <td className="px-2 py-2">
              After initiation/submission of above certificate along with set of PERs, the concerned administration will
              on the same date forward the same to Reporting Officer. This shall enable to ensure follow-up and prompt
              retrieval of PERs from the Reporting/Countersigning Officers.
            </td>
          </tr>
          <tr className="border-b border-black align-top">
            <td className="border-r border-black px-2 py-2 font-semibold">R.O / C.O / 2nd C.O (if applicable)</td>
            <td className="px-2 py-2">
              After receiving PERs from administration, R.O will complete the same within two weeks. After that C.O
              will countersign in the next two weeks and 2nd Countersigning Officer (if applicable) in subsequent two
              weeks and must follow the guidelines mentioned in backside of PER form.
            </td>
          </tr>
          <tr className="border-b border-black align-top">
            <td className="border-r border-black px-2 py-2 font-semibold">Expunging Authority in case of adverse remarks</td>
            <td className="px-2 py-2">
              The role of expunging authority is as a judge who examine/decide the representation of the officer
              reported upon and comments of the C.O on the representation under paras-3.40, 3.41 and instructions
              provided on the backside of PER form or AGPE-2004.
            </td>
          </tr>
          <tr className="align-top">
            <td className="border-r border-black px-2 py-2 font-semibold">
              The concerned administration will get the PER completed and must be forwarded to Establishment Division
              under para-2.37 &amp; 2.38 of AGPE-2004 as per given schedule
            </td>
            <td className="px-2 py-2">
              <div>Officers of Grade 21 and 20 .................................... 31st January</div>
              <div className="mt-2">Officers of Grade 19 ............................................ 28th February</div>
              <div className="mt-2">Officers of Grade 18 and 17 .................................... 31st March</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="space-y-3">
        <div>Failing which disciplinary proceedings will be initiated under para-2.35 (iii) &amp; (iv) of AGPE-2004.</div>
        <div className="pl-6 italic">
          (iii) The President is pleased to direct that the reporting officers concerned will be held responsible for
          ensuring that the reports of the officers working under them are written in time and sent to the Establishment
          Division / Administrative Ministry concerned when due with the least delay.
        </div>
        <div className="pl-6 italic">
          (iv) In case the President received further complaints in this regard, serious notice will be taken thereof
          and defaulting officers will be liable to disciplinary action.
        </div>
      </div>
    </div>
  </FormPage>
);

const FormF_Page2PartI: React.FC = () => (
  <FormPage pageNumber={2} className="px-10 py-8">
    <div data-replica-scope="clerk" className="space-y-5 text-[11px] leading-[1.35]">
      <div className="flex justify-between text-[13px] font-semibold">
        <div>
          FOR OFFICERS IN BPS 17 &amp; 18
          <div className="mt-1 font-urdu text-[11px]">افسران برائے بی ایس 17 اور 18</div>
        </div>
        <div className="text-right">
          RESTRICTED
          <div className="mt-1 font-urdu text-[11px]">محدود</div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[18px] font-bold uppercase">Government of Pakistan</div>
        <div className="mt-1 font-urdu text-[13px]">حکومت پاکستان</div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <div>Ministry / Division <PerInlineField binding={per1718Fields.ministryDivision} className="ml-2 w-[60%]" /></div>
        <div>Service / Group <PerInlineField binding={per1718Fields.serviceGroup} prefill="per1718-service-group" className="ml-2 w-[58%]" /></div>
        <div className="col-span-2">
          Department / Office <PerInlineField binding={per1718Fields.departmentOffice} prefill="office-scope-label" className="ml-2 w-[72%]" />
          <div className="mt-1 font-urdu text-[11px]">محکمہ / دفتر</div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[16px] font-bold uppercase">Performance Evaluation Report</div>
        <div className="mt-1 font-urdu text-[13px]">کارکردگی رپورٹ</div>
      </div>
      <div className="text-center text-[12px]">
        FOR THE PERIOD <PerInlineField binding={per1718Fields.reportingPeriodFrom} prefill="reporting-period-from-day-month" className="mx-2 w-28" />
        20 <PerInlineField binding="per1718-reporting-period-from-year" prefill="reporting-period-from-year" className="mx-1 w-8" />
        TO <PerInlineField binding={per1718Fields.reportingPeriodTo} prefill="reporting-period-to-day-month" className="mx-2 w-28" />
        20 <PerInlineField binding="per1718-reporting-period-to-year" prefill="reporting-period-to-year" className="mx-1 w-8" />
      </div>
      <PerSectionHeading title="PART I" titleUrdu="حصہ اول" subtitle="(TO BE FILLED IN BY THE OFFICER REPORTED UPON)" subtitleUrdu="(متعلقہ افسر خود پُر کریں)" />
      <div className="space-y-3 text-[11px]">
        <div>1. Name (in block letters) <PerInlineField binding={per1718Fields.officerName} prefill="employee-name" className="ml-2 w-[70%]" /></div>
        <div>2. Personnel number <PerInlineField binding={per1718Fields.personnelNumber} prefill="per1718-personnel-number" className="ml-2 w-[72%]" /></div>
        <div>3. Date of birth <PerInlineField binding={per1718Fields.dateOfBirth} prefill="per1718-date-of-birth" className="ml-2 w-[75%]" /></div>
        <div>4. Date of entry in service <PerInlineField binding={per1718Fields.dateOfEntryInService} prefill="employee-joining-date" className="ml-2 w-[66%]" /></div>
        <div>5. Post held during the period (with BPS) <PerInlineField binding={per1718Fields.postHeldDuringPeriod} prefill="employee-post-held" className="ml-2 w-[58%]" /></div>
        <div>6. Academic qualifications <PerInlineField binding={per1718Fields.academicQualifications} prefill="per1718-academic-qualifications" className="ml-2 w-[68%]" /></div>
        <div>
          7. Knowledge of languages (Please indicate proficiency in speaking (S), reading (R) and writing (W))
          <div className="mt-2 space-y-2">
            {per1718LanguageFields.map((binding) => (
              <div key={binding} className="border-b border-black">
                <PerBlockField binding={binding} className="min-h-[20px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </FormPage>
);

const FormF_Page3PartII: React.FC = () => (
  <FormPage pageNumber={3} className="px-10 py-8">
    <div data-replica-scope="clerk" className="space-y-5 text-[11px] leading-[1.35]">
      <div>
        <div className="mb-2 text-[12px] font-semibold">Training received during the evaluation period</div>
        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="border-b border-black">
              <th className="border-r border-black px-2 py-1 text-left font-semibold">Name of course attended</th>
              <th className="border-r border-black px-2 py-1 text-left font-semibold">Duration with dates</th>
              <th className="px-2 py-1 text-left font-semibold">Name of institution and country</th>
            </tr>
          </thead>
          <tbody>
            {per1718TrainingFields.map((row) => (
              <tr key={row.course} className="border-b border-black">
                <td className="border-r border-black px-2 py-1.5"><PerBlockField binding={row.course} className="min-h-[28px]" /></td>
                <td className="border-r border-black px-2 py-1.5"><PerBlockField binding={row.duration} className="min-h-[28px]" /></td>
                <td className="px-2 py-1.5"><PerBlockField binding={row.institution} className="min-h-[28px]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-x-8 text-[11px]">
        <div>Period served (i) In present post <PerInlineField binding={per1718Fields.periodServedPresentPost} className="ml-2 w-[44%]" /></div>
        <div>(ii) Under the reporting officer <PerInlineField binding={per1718Fields.periodServedUnderReportingOfficer} className="ml-2 w-[44%]" /></div>
      </div>
      <PerSectionHeading title="PART II" titleUrdu="حصہ دوم" subtitle="(TO BE FILLED IN BY THE OFFICER REPORTED UPON)" subtitleUrdu="(متعلقہ افسر خود پُر کریں)" />
      <div>
        <div className="mb-2 text-[12px] font-semibold">Job description</div>
        <PerRuledLines bindingPrefix={per1718Fields.jobDescription} count={8} />
      </div>
    </div>
  </FormPage>
);

const FormF_Page4PartIII: React.FC = () => (
  <FormPage pageNumber={4} className="px-10 py-8">
    <div className="space-y-5 text-[11px] leading-[1.35]">
      <div data-replica-scope="clerk">
        <div className="mb-2 text-[12px] font-semibold">
          Brief account of performance on the job during the period supported by statistical data where possible. Targets
          given and actual performance against such targets should be highlighted. Reasons for shortfall, if any, may also be stated.
        </div>
        <PerRuledLines bindingPrefix={per1718Fields.performanceSummary} count={7} />
      </div>
      <div data-replica-scope="reporting" className="space-y-3">
        <PerSectionHeading title="PART III" titleUrdu="حصہ سوم" subtitle="(EVALUATION BY THE REPORTING OFFICER)" subtitleUrdu="(رپورٹنگ افسر کا جائزہ)" />
        <div className="text-center text-[11px]">The rating in Part III should be recorded by initialling the appropriate box.</div>
        <div className="text-center text-[11px]">The ratings denoted by alphabets are as follows: 'A' Very Good, 'B' Good, 'C' Average, 'D' Below Average.</div>
        <div className="text-center text-[11px]">For uniform interpretation of qualities, two extreme shades are mentioned against each quality.</div>
        <PerRatingTable rows={per1718PartIIIRows.slice(0, 1)} />
      </div>
    </div>
  </FormPage>
);

const FormF_Page5PartIII: React.FC = () => (
  <FormPage pageNumber={5} className="px-10 py-8">
    <div data-replica-scope="reporting" className="space-y-4 text-[11px] leading-[1.35]">
      <PerRatingTable rows={per1718PartIIIRows.slice(1, 8)} />
    </div>
  </FormPage>
);

const FormF_Page6PartIV: React.FC = () => (
  <FormPage pageNumber={6} className="px-10 py-8">
    <div data-replica-scope="reporting" className="space-y-5 text-[11px] leading-[1.35]">
      <PerRatingTable rows={per1718PartIIIRows.slice(8)} />
      <PerSectionHeading title="PART IV" titleUrdu="حصہ چہارم" subtitle="(REPORTING OFFICER'S EVALUATION)" subtitleUrdu="(رپورٹنگ افسر کا جائزہ)" />
      <div className="text-[11px]">
        Please comment on the officer&apos;s performance on the job as given in Part II(2) with special reference to
        knowledge of work, quality and quantity of output. How far was the officer able to achieve targets? Do you
        agree with what has been stated in Part II (2)?
      </div>
      <PerRuledLines bindingPrefix={per1718Fields.reportingNarrative} count={6} />
      <PerRatingTable rows={per1718PartIVRows} />
    </div>
  </FormPage>
);

const FormF_Page7PartIV: React.FC = () => (
  <FormPage pageNumber={7} className="px-10 py-8">
    <div data-replica-scope="reporting" className="space-y-5 text-[11px] leading-[1.35]">
      <div className="text-[12px] font-semibold">Integrity (Morality, uprightness and honesty)</div>
      <PerRatingTable rows={per1718IntegrityRows} />
      <div>
        <div className="mb-2 text-[12px] font-semibold">
          Pen picture with focus on the officer&apos;s strengths and weaknesses not covered in Part III
        </div>
        <div className="mb-2 text-[10px]">
          (Weakness will not be considered as adverse entries unless intended to be treated as adverse).
        </div>
        <PerRuledLines bindingPrefix={per1718Fields.strengthsWeaknesses} count={5} />
      </div>
      <div>
        <div className="mb-2 text-[12px] font-semibold">Special aptitude</div>
        <PerRuledLines bindingPrefix={per1718Fields.specialAptitude} count={2} />
      </div>
      <div>
        <div className="mb-2 text-[12px] font-semibold">Recommendations for future training</div>
        <PerRuledLines bindingPrefix={per1718Fields.futureTraining} count={2} />
      </div>
    </div>
  </FormPage>
);

const FormF_Page8PartIV: React.FC = () => (
  <FormPage pageNumber={8} className="px-10 py-8">
    <div className="space-y-6 text-[11px] leading-[1.35]">
      <PerDecisionTable title="Overall grading" titleUrdu="مجموعی درجہ" options={per1718OverallGradingOptions} groupPrefix="per1718-overall-grading" />
      <PerDecisionTable title="Fitness for promotion" titleUrdu="ترقی کے لیے موزونیت" options={per1718FitnessOptions} groupPrefix="per1718-fitness-for-promotion" />
      <PerOfficerSignatureBlock
        scope="reporting"
        nameBinding="reporting-officer-name"
        designationBinding="reporting-officer-designation"
        namePrefill="reporting-officer-name"
        designationPrefill="reporting-officer-designation"
        title="Reporting Officer"
      />
    </div>
  </FormPage>
);

const FormF_Page9PartV: React.FC = () => (
  <FormPage pageNumber={9} className="px-10 py-8">
    <div data-replica-scope="countersigning" className="space-y-5 text-[11px] leading-[1.35]">
      <PerSectionHeading title="PART V" titleUrdu="حصہ پنجم" subtitle="(REMARKS OF THE COUNTERSIGNING OFFICER)" subtitleUrdu="(کاؤنٹر سائننگ افسر کی رائے)" />
      <div>
        <div className="mb-2 text-[12px] font-semibold">
          How well do you know the officer? If you disagree with the assessment of the reporting officer, please give reasons
        </div>
        <PerRuledLines bindingPrefix={per1718Fields.countersigningRemarks} count={5} />
      </div>
      <div className="space-y-3">
        <div className="text-[12px] font-semibold">Evaluation of the quality of assessment made by the reporting officer</div>
        <div className="grid grid-cols-3 gap-6 text-center">
          {[
            { binding: "exaggerated", label: "Exaggerated", urdu: "مبالغہ" },
            { binding: "fair", label: "Fair", urdu: "منصف" },
            { binding: "biased", label: "Biased", urdu: "جانبدار" },
          ].map((item) => (
            <div key={item.binding} className="space-y-2">
              <div
                data-replica-field="check"
                data-replica-binding={`${per1718Fields.countersigningAssessmentQuality}-${item.binding}`}
                data-replica-group={per1718Fields.countersigningAssessmentQuality}
                className="mx-auto h-8 w-14 border border-black"
              ></div>
              <div>{item.label}</div>
              <div className="font-urdu text-[10px]">{item.urdu}</div>
            </div>
          ))}
        </div>
      </div>
      <PerOfficerSignatureBlock
        scope="countersigning"
        nameBinding="countersigning-officer-name"
        designationBinding="countersigning-officer-designation"
        namePrefill="countersigning-officer-name"
        designationPrefill="countersigning-officer-designation"
        title="Countersigning Officer"
      />
    </div>
  </FormPage>
);

const FormF_Page10PartVI: React.FC = () => (
  <FormPage pageNumber={10} className="px-10 py-8">
    <div data-replica-scope="second-countersigning" className="space-y-6 text-[11px] leading-[1.35]">
      <PerSectionHeading title="PART VI" titleUrdu="حصہ ششم" subtitle="REMARKS OF THE SECOND COUNTERSIGNING OFFICER (IF ANY)" subtitleUrdu="دوسرے کاؤنٹر سائننگ افسر کے ریمارکس (اگر کوئی ہوں)" />
      <PerRuledLines bindingPrefix={per1718Fields.secondCountersigningRemarks} count={5} className="mt-8" />
      <PerOfficerSignatureBlock
        scope="second-countersigning"
        nameBinding="second-countersigning-officer-name"
        designationBinding="second-countersigning-officer-designation"
        title="Second Countersigning Officer"
      />
    </div>
  </FormPage>
);

const FormF_Page11Certificate: React.FC = () => (
  <FormPage pageNumber={11} className="px-10 py-8">
    <div data-replica-scope="clerk" className="space-y-5 text-[11px] leading-[1.4]">
      <div className="text-center text-[15px] font-bold uppercase">PER Submission Certificate from Officer Reported Upon</div>
      <div>Certified that I <PerInlineField binding={per1718Fields.submissionCertificateName} prefill="employee-name" className="mx-2 w-[44%]" /></div>
      <div>
        <PerInlineField binding={per1718Fields.submissionCertificateDesignation} prefill="employee-rank-grade" className="w-[38%]" /> have on{" "}
        <PerInlineField binding={per1718Fields.submissionCertificateDate} className="mx-2 w-28" /> submitted my
      </div>
      <div>
        Performance Evaluation Report for the period from{" "}
        <PerInlineField binding={per1718Fields.submissionCertificateFrom} prefill="reporting-period-from" className="mx-2 w-28" /> to{" "}
        <PerInlineField binding={per1718Fields.submissionCertificateTo} prefill="reporting-period-to" className="mx-2 w-28" />
      </div>
      <div>To be initiated by <PerInlineField binding={per1718Fields.submissionReportingOfficer} prefill="reporting-officer-name" className="mx-2 w-[48%]" /></div>
      <div>To be countersigned by <PerInlineField binding={per1718Fields.submissionCountersigningOfficer} prefill="countersigning-officer-name" className="mx-2 w-[44%]" /></div>
      <div>Signatures <PerInlineField binding={per1718Fields.submissionSignature} className="mx-2 w-32" /></div>
      <div className="pt-2">
        <div>To,</div>
        <div className="mt-2">
          (Serving Administration / Ministry / Department){" "}
          <PerInlineField binding={per1718Fields.submissionAdministration} prefill="office-scope-label" className="mx-2 w-[46%]" />
        </div>
        <div className="mt-2 border-b border-black"></div>
        <div className="mt-3 border-b border-black"></div>
      </div>
      <div className="pt-2">
        <div className="font-semibold">CC :</div>
        <div>Director (PD),</div>
        <div>Establishment Division</div>
      </div>
      <div className="space-y-3 pt-4">
        <div className="font-semibold">Instructions for Officer Reported Upon.</div>
        <div className="text-center text-[11px] font-semibold italic">Extract of Para-6.7 of AGPE-2004 and Guideline for filling up of PER</div>
        <div className="flex gap-3">
          <div className="pt-1 text-[16px] leading-none">•</div>
          <div>
            PER along with Submission Certificate should be prepared annually at the close of each calendar year which
            is required to be dispatched to the Officer Incharge entrusted with the maintenance of his/her C.R dossier
            and copy of above certificate must also be forwarded to Establishment Division.
          </div>
        </div>
        <div className="flex gap-3">
          <div className="pt-1 text-[16px] leading-none">•</div>
          <div>Part I and II of PER are required to be filled in duplicate / typed and signed by the officer reported upon.</div>
        </div>
      </div>
    </div>
  </FormPage>
);

const FormF_Per1718Officers: React.FC = () => (
  <div className="flex w-full flex-col items-center gap-8 bg-gray-100 py-8 print:gap-0 print:bg-white print:py-0">
    <FormF_Page1Instructions />
    <FormF_Page2PartI />
    <FormF_Page3PartII />
    <FormF_Page4PartIII />
    <FormF_Page5PartIII />
    <FormF_Page6PartIV />
    <FormF_Page7PartIV />
    <FormF_Page8PartIV />
    <FormF_Page9PartV />
    <FormF_Page10PartVI />
    <FormF_Page11Certificate />
  </div>
);

export default FormF_Per1718Officers;
