export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  OTPVerify: {phoneNumber: string; isRegistration?: boolean};
};

export type ClientTabParamList = {
  Home: undefined;
  MyIssues: undefined;
  History: undefined;
  Profile: undefined;
};

export type ClientStackParamList = {
  ClientTabs: undefined;
  ReportIssue: undefined;
  IssueDetail: {issueId: string};
  BillDetail: {billId: string};
  BillingHistory: undefined;
  TechnicianTracking: {issueId: string};
  EditProfile: undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
};

export type TechnicianTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Resources: undefined;
  Profile: undefined;
};

export type TechnicianStackParamList = {
  BODGate: undefined;
  TechnicianTabs: undefined;
  BOD: undefined;
  TaskDetail: {taskId: string};
  Navigation: {taskId: string};
  JobsMap: undefined;
  UpdateStatus: {taskId: string};
  Materials: {taskId: string};
  Signature: {
    taskId: string;
    completionPhotoUrls: string;
    completionRemarks?: string;
    causeOfFault?: string;
  };
  ResourceManagement: undefined;
  KPITargets: undefined;
  TechEditProfile: undefined;
  TechNotificationSettings: undefined;
  TechLanguageSettings: undefined;
};

export type TeamLeadTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Team: undefined;
  Profile: undefined;
};

export type TeamLeadStackParamList = {
  BODGate: undefined;
  TeamLeadTabs: undefined;
  BOD: undefined;
  EOD: undefined;
  // Optional pre-selection params: when a Team Lead taps "Reassign" on a job in
  // the Needs Attention queue, AssignJobs opens scrolled to / highlighting that
  // job's fault. Opened with no params from the header "Assign" button.
  AssignJobs: {jobId?: string; faultId?: string} | undefined;
  Payment: undefined;
  PaymentSubmission: {taskId: string};
  PaymentHistory: undefined;
  TeamMap: undefined;
  KPIPerformance: undefined;
  FieldOperations: undefined;
  JobNavigation: {
    taskId: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  MaterialRequest: {taskId: string};
  // SRS 5.5.3 (v1.9) — Work-Group-scoped material distribution: approve/reject
  // pending requests from this Team Lead's own Work Group, drawing from its
  // OPMC-allocated balance.
  TeamMaterialRequests: undefined;
};