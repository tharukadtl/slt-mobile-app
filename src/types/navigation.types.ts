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
  TechnicianTabs: undefined;
  TaskDetail: {taskId: string};
  Navigation: {taskId: string};
  UpdateStatus: {taskId: string};
  Materials: {taskId: string};
  Signature: {taskId: string};
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
  AssignJobs: undefined;
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
};