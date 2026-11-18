import { AuditEvent } from "../types";

export const MOCK_AUDIT_LOGS: AuditEvent[] = [
  {
    id: "aud-901",
    timestamp: "2026-09-04T07:15:30Z",
    actor: {
      name: "Aadhaar e-KYC Gateway",
      uId: "SYS-AUTH-UIDAI",
      role: "System Authority",
      ipAddress: "164.100.128.42",
    },
    action: "SESSION_AUTHENTICATION",
    resource: "Citizen Session (U-9842-8821-IND)",
    result: "SUCCESS",
    context: "Two-factor OTP verified successfully via registered mobile (+91 98*** **421)",
  },
  {
    id: "aud-902",
    timestamp: "2026-09-02T11:20:15Z",
    actor: {
      name: "RTO Motor Vehicles Officer",
      uId: "OFFICER-MH12-881",
      role: "Department Officer",
      ipAddress: "10.24.11.90",
    },
    action: "APPLICATION_STATUS_UPDATE",
    resource: "Application UGOV-2026-DL-448201",
    result: "INFO",
    context: "Status transitioned from 'Submitted' to 'Action Required' (Driving test slot booking required)",
  },
  {
    id: "aud-903",
    timestamp: "2026-08-28T14:15:40Z",
    actor: {
      name: "National Scholarship Portal Node",
      uId: "API-NSP-CENTRAL",
      role: "External Integration Adapter",
      ipAddress: "164.100.80.12",
    },
    action: "DOCUMENT_ACCESS_VERIFICATION",
    resource: "DigiDocument: Income Certificate",
    result: "SUCCESS",
    context: "Accessed under active citizen consent ID: c-1 for DBT income ceiling validation",
  },
  {
    id: "aud-904",
    timestamp: "2026-08-24T16:35:02Z",
    actor: {
      name: "Revenue Sub-Divisional Officer",
      uId: "REV-SDO-PUNE-14",
      role: "Issuing Authority",
      ipAddress: "10.45.2.110",
    },
    action: "CERTIFICATE_ISSUANCE",
    resource: "DigiDocument: State Domicile Certificate",
    result: "SUCCESS",
    context: "Digitally signed with DSC token (Serial: 44F89A21) and deposited to citizen DigiVault",
  },
];
