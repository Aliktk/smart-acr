import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

export interface CertificateMetadata {
  acrNo: string;
  employeeName: string;
  employeeDesignation: string;
  employeeBps: number;
  employeePosting: string;
  reportingPeriodFrom: string;
  reportingPeriodTo: string;
  submittedByName: string;
  submittedByDesignation: string;
  submittedAt: string;
  forwardedToName: string;
  integrityHash: string;
}

@Injectable()
export class SubmissionCertificateService {
  /**
   * Generates submission certificate metadata and integrity hash.
   * FIA rule item ii: Submission Certificate must be prepared along with PER.
   *
   * Note: Actual PDF rendering is deferred to a document service or client-side.
   * This service produces the certified metadata and integrity hash.
   */
  generateCertificate(params: {
    acrNo: string;
    employeeName: string;
    employeeDesignation: string;
    employeeBps: number;
    employeePosting: string;
    reportingPeriodFrom: Date;
    reportingPeriodTo: Date;
    submittedByName: string;
    submittedByDesignation: string;
    formDataJson: string;
  }): CertificateMetadata {
    const integrityHash = crypto
      .createHash("sha256")
      .update(params.formDataJson)
      .digest("hex");

    return {
      acrNo: params.acrNo,
      employeeName: params.employeeName,
      employeeDesignation: params.employeeDesignation,
      employeeBps: params.employeeBps,
      employeePosting: params.employeePosting,
      reportingPeriodFrom: params.reportingPeriodFrom.toISOString().slice(0, 10),
      reportingPeriodTo: params.reportingPeriodTo.toISOString().slice(0, 10),
      submittedByName: params.submittedByName,
      submittedByDesignation: params.submittedByDesignation,
      submittedAt: new Date().toISOString(),
      forwardedToName: "Deputy Director (PIAB), FIA Headquarters",
      integrityHash,
    };
  }

  /**
   * Generates the storage path for the certificate.
   */
  getCertificatePath(acrNo: string): string {
    return `certificates/${acrNo.replaceAll("/", "-")}-submission-cert.json`;
  }
}
