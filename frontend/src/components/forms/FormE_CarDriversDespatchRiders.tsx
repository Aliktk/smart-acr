import React from "react";
import { FormPage, ScannedPage } from "./FormPrimitives";
import { driverChecklistRows, driverFormFields } from "./templateFieldSchemas";

const DRIVER_INSTRUCTION_PAGES = [
  "/form-assets/car-drivers/page-3.jpg",
  "/form-assets/car-drivers/page-4.jpg",
  "/form-assets/car-drivers/page-5.jpg",
  "/form-assets/car-drivers/page-6.jpg",
  "/form-assets/car-drivers/page-7.jpg",
];

function DriverLineField(props: {
  binding: string;
  prefill?: string;
  className?: string;
}) {
  return (
    <span
      data-replica-field="text"
      data-replica-binding={props.binding}
      data-replica-prefill={props.prefill}
      className={`inline-block min-h-[20px] border-b border-black px-1 align-bottom ${props.className ?? ""}`.trim()}
    ></span>
  );
}

function DriverChecklistTable(props: {
  rows: ReadonlyArray<(typeof driverChecklistRows)[number]>;
  scope: "reporting";
}) {
  return (
    <table className="w-full border-collapse border border-black text-[11px] leading-[1.25]">
      <thead>
        <tr className="border-b border-black">
          <th className="border-r border-black px-2 py-1 text-left font-bold">STANDARD OF PERFORMANCE / PERSONAL TRAITS</th>
          <th className="border-r border-black px-2 py-1 text-center font-bold w-14">
            Yes
            <div className="mt-1 font-urdu text-[10px] font-normal">ہاں</div>
          </th>
          <th className="px-2 py-1 text-center font-bold w-14">
            No
            <div className="mt-1 font-urdu text-[10px] font-normal">نہیں</div>
          </th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => {
          const group = `${props.scope}-${row.key}`;
          return (
            <tr key={row.key} className="border-b border-black align-top">
              <td className="border-r border-black px-2 py-1.5">
                <div className="flex gap-2">
                  <span className="font-semibold">{row.number}</span>
                  <div>
                    <div>{row.label}</div>
                    <div className="mt-1 font-urdu text-[10px] leading-[1.35]">{row.labelUrdu}</div>
                  </div>
                </div>
              </td>
              <td className="border-r border-black px-2 py-1 text-center">
                <div
                  data-replica-field="check"
                  data-replica-binding={`drivers-${row.key}-yes`}
                  data-replica-group={group}
                  className="mx-auto h-4 w-4 border border-black"
                ></div>
              </td>
              <td className="px-2 py-1 text-center">
                <div
                  data-replica-field="check"
                  data-replica-binding={`drivers-${row.key}-no`}
                  data-replica-group={group}
                  className="mx-auto h-4 w-4 border border-black"
                ></div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DriverRemarksBlock(props: {
  scope: "reporting" | "countersigning";
  title: string;
  titleUrdu: string;
}) {
  return (
    <div data-replica-scope={props.scope} className="space-y-3">
      <div className="text-center text-[11px] font-semibold uppercase">{props.title}</div>
      <div className="text-center font-urdu text-[11px]">{props.titleUrdu}</div>
      {[1, 2, 3, 4].map((lineIndex) => (
        <div
          key={lineIndex}
          data-replica-field="text"
          data-replica-binding={`${props.scope === "reporting" ? driverFormFields.reportingRemarks : driverFormFields.countersigningRemarks}-${lineIndex}`}
          className="min-h-[22px] border-b border-black px-1"
        ></div>
      ))}
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-6 pt-1 text-[11px]">
        <div>
          <div>
            Date <DriverLineField binding={`${props.scope}-signature-date`} className="w-20" />
            <span className="mx-1">20</span>
            <DriverLineField binding={`${props.scope}-signature-year`} className="w-10" />
          </div>
          <div className="mt-1 font-urdu text-[10px]">تاریخ</div>
        </div>
        <div className="text-center">
          <div
            data-replica-field="asset"
            data-replica-binding={`${props.scope}-official-stamp`}
            data-replica-asset-kind="STAMP"
            className="stamp-block mx-auto mb-1 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-transparent"
          >
            <span className="text-[9px] text-gray-400">Stamp</span>
          </div>
          <div>Official Stamp</div>
          <div className="mt-1 font-urdu text-[10px]">دفتری مہر</div>
        </div>
        <div className="text-right">
          <div
            data-replica-field="asset"
            data-replica-binding={`${props.scope}-signature`}
            data-replica-asset-kind="SIGNATURE"
            className="signature-block ml-auto mb-1 flex h-14 w-28 items-center justify-center border-2 border-dashed border-transparent"
          >
            <span className="text-[9px] text-gray-400">Signature</span>
          </div>
          <div>Signature</div>
          <div className="mt-1 font-urdu text-[10px]">دستخط</div>
        </div>
      </div>
    </div>
  );
}

const FormE_Page1: React.FC = () => (
  <FormPage pageNumber={1} className="px-10 py-8">
    <div className="space-y-5 text-[11px] leading-[1.3]">
      <div className="flex items-start justify-between">
        <div>S. 121-F (Revised)</div>
        <div className="text-right">
          <div className="font-semibold uppercase">Annual Restricted Report Form for</div>
          <div className="mt-1 font-semibold uppercase">Car Drivers / Despatch Riders</div>
          <div className="mt-1 font-urdu text-[11px]">سالانہ محدود رپورٹ فارم برائے کار ڈرائیورز / ڈسپیچ رائیڈرز</div>
        </div>
      </div>

      <div data-replica-scope="clerk" className="space-y-5">
        <div className="text-center">
          Report for the period from{" "}
          <DriverLineField binding={driverFormFields.periodFrom} prefill="reporting-period-from" className="w-24" /> to{" "}
          <DriverLineField binding={driverFormFields.periodTo} prefill="reporting-period-to" className="w-24" />
          <div className="mt-1 font-urdu text-[10px]">رپورٹ برائے عرصہ</div>
        </div>

        <div className="text-center">
          <div className="font-semibold uppercase">PART-I</div>
          <div className="mt-1 font-urdu text-[11px]">حصہ اول</div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            Name: <DriverLineField binding={driverFormFields.name} prefill="employee-name" className="w-[72%]" />
            <div className="mt-1 font-urdu text-[10px]">نام</div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              Date of birth: <DriverLineField binding={driverFormFields.dateOfBirth} prefill="drivers-date-of-birth" className="w-[52%]" />
              <div className="mt-1 font-urdu text-[10px]">تاریخ پیدائش</div>
            </div>
            <div className="w-24">
              BS: <DriverLineField binding={driverFormFields.bps} prefill="employee-bps" className="w-14" />
              <div className="mt-1 font-urdu text-[10px]">سکیل</div>
            </div>
          </div>
          <div>
            Present Pay: <DriverLineField binding={driverFormFields.presentPay} className="w-[58%]" />
            <div className="mt-1 font-urdu text-[10px]">موجودہ تنخواہ</div>
          </div>
          <div>
            Type of License held: <DriverLineField binding={driverFormFields.typeOfLicense} className="w-[56%]" />
            <div className="mt-1 font-urdu text-[10px]">لائسنس کی قسم</div>
          </div>
          <div className="col-span-2">
            Type of Vehicle Driven: <DriverLineField binding={driverFormFields.typeOfVehicleDriven} className="w-[70%]" />
            <div className="mt-1 font-urdu text-[10px]">زیر استعمال گاڑی کی قسم</div>
          </div>
        </div>
      </div>

      <div data-replica-scope="reporting" className="space-y-3">
        <div className="text-center">
          <div className="font-semibold uppercase">PART-II</div>
          <div className="mt-1 font-urdu text-[11px]">حصہ دوم</div>
        </div>
        <div>Initial the appropriate Column.</div>
        <div className="font-urdu text-[10px]">موزوں خانے میں ابتدائیہ درج کریں</div>
        <DriverChecklistTable rows={driverChecklistRows.slice(0, 8)} scope="reporting" />
      </div>
    </div>
  </FormPage>
);

const FormE_Page2: React.FC = () => (
  <FormPage pageNumber={2} className="px-10 py-8">
    <div className="space-y-5 text-[11px] leading-[1.3]">
      <div data-replica-scope="reporting">
        <DriverChecklistTable rows={driverChecklistRows.slice(8)} scope="reporting" />
        <div className="mt-2 text-[10px] italic">*For dispatch riders only</div>
        <div className="mt-1 font-urdu text-[10px]">*صرف ڈسپیچ رائیڈرز کے لیے</div>
      </div>

      <DriverRemarksBlock
        scope="reporting"
        title="General Remarks of the Reporting Officer:"
        titleUrdu="رپورٹنگ افسر کے عمومی ریمارکس"
      />

      <DriverRemarksBlock
        scope="countersigning"
        title="General Remarks of the Reporting Officer:"
        titleUrdu="رپورٹنگ افسر کے عمومی ریمارکس"
      />
    </div>
  </FormPage>
);

const FormE_CarDriversDespatchRiders: React.FC = () => {
  return (
    <div className="flex w-full flex-col items-center gap-8 bg-gray-100 py-8 print:gap-0 print:bg-white print:py-0">
      <FormE_Page1 />
      <FormE_Page2 />
      {DRIVER_INSTRUCTION_PAGES.map((src, index) => (
        <ScannedPage key={src} src={src} alt={`Car Drivers / Despatch Riders instruction page ${index + 3}`} />
      ))}
    </div>
  );
};

export default FormE_CarDriversDespatchRiders;
