export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTPVerify: { phoneNumber: string };
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
  IssueDetail: { issueId: string };
};

export type TechnicianTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Profile: undefined;
};

export type TechnicianStackParamList = {
  TechnicianTabs: undefined;
  TaskDetail: { taskId: string };
  Navigation: { taskId: string };
  UpdateStatus: { taskId: string };
  Materials: { taskId: string };
  Signature: { taskId: string };
};

export type TeamLeadTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Team: undefined;
  Profile: undefined;
};

export type TeamLeadStackParamList = {
  TeamLeadTabs: undefined;
  Payment: undefined;
  Team: undefined;
  Tasks: undefined;
  Profile: undefined;
};