export { Service } from "./service";
export { UserService, userService } from "./user-service";
export { RoleService, roleService } from "./role-service";
export { TicketService, ticketService } from "./ticket-service";
export { AttachmentService, attachmentService } from "./attachment-service";
export { ReplyService, replyService } from "./reply-service";
export { SuggestionService, suggestionService } from "./suggestion-service";
export { ComplaintService, complaintService } from "./complaint-service";
export { PartnerService, partnerService } from "./partner-service";
export {
  NotificationService,
  notificationService,
} from "@/notifications/notificationService";
export { CompanyService, companyService } from "./company-service";
export { ProjectService, projectService } from "./project-service";
export {
  UserProjectService,
  userProjectService,
} from "./user-project-service";
export { EmailService, emailService } from "./email-service";
export { SiteRequestService, siteRequestService } from "./site-request-service";
export {
  createSiteRequestSchema,
  siteRequestModuleValues,
  siteRequestStatusValues,
} from "./site-request-service";
export type {
  CreateSiteRequestInput,
  ManualSiteRequestStatus,
  SiteRequest,
  SiteRequestStatus,
} from "./site-request-service";

export {
  loginSchema,
  createUserSchema,
  updateUserSchema,
} from "./user-service";

export type {
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  SafeUser,
  AuthUser,
} from "./user-service";

export type {
  CreateTicketInput,
  AssignTicketInput,
  UpdateTicketInput,
  CreateReportInput,
  TicketStats,
  TicketScope,
  TicketTrendPoint,
  CompanyTicketStats,
  ProjectTicketStats,
  TicketReport,
} from "./ticket-service";

export {
  createPartnerSchema,
  updatePartnerSchema,
} from "./partner-service";

export type {
  CreatePartnerInput,
  UpdatePartnerInput,
  Partner,
} from "./partner-service";

export {
  createNotificationSchema,
  notificationEntityTypeValues,
} from "@/notifications/notificationService";

export type {
  CreateNotificationInput,
  NotificationBody,
  Notification,
  NotificationEntityType,
} from "@/notifications/notificationService";

export {
  createCompanySchema,
  updateCompanySchema,
} from "./company-service";

export type {
  CreateCompanyInput,
  UpdateCompanyInput,
  Company,
} from "./company-service";

export {
  createProjectSchema,
  updateProjectSchema,
} from "./project-service";

export type {
  CreateProjectInput,
  UpdateProjectInput,
  Project,
} from "./project-service";

export { userProjectSchema } from "./user-project-service";

export type {
  UserProjectInput,
  UserProject,
} from "./user-project-service";

export { createReplySchema, replyEntityTypeValues } from "./reply-service";

export type {
  CreateReplyInput,
  ReplyWithAuthor,
  Reply,
  ReplyEntityType,
} from "./reply-service";

export { createSuggestionSchema } from "./suggestion-service";

export type {
  CreateSuggestionInput,
  Suggestion,
} from "./suggestion-service";

export { createComplaintSchema } from "./complaint-service";

export type {
  CreateComplaintInput,
  Complaint,
} from "./complaint-service";
