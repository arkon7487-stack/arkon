export type RoleKey =
  | 'super_admin'
  | 'administrator'
  | 'operations_manager'
  | 'coordinator'
  | 'hr'
  | 'accountant'
  | 'field_employee'
  | 'sales'
  | 'customer_service'
  | 'supervisor'
  | 'dispatcher'
  | 'client';

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  key: RoleKey;
  name: string;
  description: string | null;
  is_staff: boolean;
  created_at: string;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface Employee {
  id: string;
  company_id: string;
  full_name: string;
  phone_number: string;
  national_id: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  service_area: string | null;
  employment_date: string | null;
  department: string | null;
  position: string | null;
  working_hours: string | null;
  employment_status: string;
  job_title: string | null;
  photo_url: string | null;
  emergency_contact: string | null;
  username: string | null;
  auth_email: string | null;
  skills: string | null;
  max_daily_visits: number;
  max_weekly_visits: number;
  latitude: number | null;
  longitude: number | null;
  availability_status: string;
  monthly_salary: number | null;
  salary_type: string;
  salary_effective_date: string | null;
  salary_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeLeave {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  role_id: string;
  employee_id: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  role?: Role;
  employee?: Employee | null;
}

export interface Client {
  id: string;
  company_id: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  address: string | null;
  service_area: string | null;
  date_of_birth: string | null;
  gender: string | null;
  notes: string | null;
  status: string;
  medical_conditions: string | null;
  allergies: string | null;
  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  latitude: number | null;
  longitude: number | null;
  source_opportunity_id: string | null;
  source_sales_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientMedical {
  id: string;
  client_id: string;
  medical_conditions: string | null;
  allergies: string | null;
  blood_type: string | null;
  notes: string | null;
  updated_at: string;
}

export interface ClientEmergencyContact {
  id: string;
  client_id: string;
  name: string;
  phone: string;
  relation: string | null;
  created_at: string;
}

export interface Package {
  id: string;
  company_id: string;
  name: string;
  code: string;
  category: string | null;
  description: string | null;
  contract_duration_weeks: number | null;
  visits_per_week: number | null;
  total_visits: number | null;
  visit_duration_minutes: number | null;
  default_visit_start_time: string | null;
  default_visit_end_time: string | null;
  included_services: string | null;
  price: number;
  discount: number;
  tax: number;
  final_price: number;
  notes: string | null;
  terms: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type ContractStatus = 'draft' | 'active' | 'expired' | 'archived' | 'cancelled';

export interface Contract {
  id: string;
  company_id: string;
  contract_number: string;
  client_id: string;
  package_id: string | null;
  employee_id: string | null;
  start_date: string;
  end_date: string;
  contract_duration_weeks: number | null;
  contract_type?: string;
  status: ContractStatus;
  price: number;
  discount: number;
  tax: number;
  final_amount: number;
  payment_status: string;
  remaining_balance: number;
  amount_paid: number;
  signed_contract_url: string | null;
  notes: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  package?: Package;
  employee?: Employee | null;
}

export interface ContractAttachment {
  id: string;
  contract_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
}

export interface ContractTimelineEntry {
  id: string;
  contract_id: string;
  event_type: string;
  message: string;
  meta: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  contract_id: string;
  employee_id: string | null;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  status: string;
  visit_duration_minutes: number | null;
  qr_code_id: string | null;
  completed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  start_gps_lat: number | null;
  start_gps_lng: number | null;
  end_gps_lat: number | null;
  end_gps_lng: number | null;
  visit_index: number | null;
  assigned_at: string | null;
  archived_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee | null;
  contract?: Contract | null;
  client?: Client | null;
}

export interface QrCode {
  id: string;
  contract_id: string | null;
  visit_id: string | null;
  client_id: string | null;
  code_value: string;
  sequence_number: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  contract_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  amount: number;
  tax: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string | null;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string | null;
  audience: string | null;
  category: string | null;
  notification_type?: string | null;
  recipient_employee_id?: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export type { RichNotification } from '@/lib/notifications/types';

export interface Attachment {
  id: string;
  client_id: string | null;
  contract_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  category: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityTimelineEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface AuthSession {
  kind: 'staff' | 'client';
  userId: string;
  profile?: Profile | null;
  client?: Client | null;
  role?: Role | null;
  permissions?: string[];
}

// ===== Relational / Aggregate Types =====

export interface ContractWithRelations extends Contract {
  client?: Client;
  package?: Package;
  employee?: Employee | null;
}

export interface VisitWithRelations extends Visit {
  employee?: Employee | null;
  contract?: ContractWithRelations | null;
  client?: Client | null;
  package?: Package | null;
}

export interface InvoiceWithRelations extends Invoice {
  contract?: ContractWithRelations | null;
}

export interface PaymentWithRelations extends Payment {
  invoice?: InvoiceWithRelations | null;
}

export interface ClientProfile {
  client: Client | null;
  contracts: ContractWithRelations[];
  visits: VisitWithRelations[];
  attachments: Attachment[];
  invoices: InvoiceWithRelations[];
  activity: ActivityTimelineEntry[];
  qrCode: QrCode | null;
}

export interface EmployeeProfile {
  employee: Employee | null;
  leave: EmployeeLeave[];
  availability: EmployeeAvailability[];
  visits: VisitWithRelations[];
  assignedClients: Client[];
  activity: ActivityTimelineEntry[];
}

export interface Settings {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface SearchResult {
  type: 'client' | 'employee' | 'contract' | 'visit' | 'invoice' | 'package' | 'qr';
  id: string;
  label: string;
  subtitle: string;
  link: string;
}

// ===== Inventory Module =====
export interface InventoryCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string;
  quantity: number;
  min_quantity: number;
  purchase_price: number;
  selling_price: number | null;
  supplier: string | null;
  storage_location: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  category?: InventoryCategory | null;
}

export interface InventoryMovement {
  id: string;
  company_id: string;
  item_id: string;
  movement_type: string;
  quantity: number;
  reason: string | null;
  notes: string | null;
  user_id: string | null;
  employee_id: string | null;
  created_at: string;
  item?: InventoryItem | null;
  employee?: Employee | null;
}

export interface InventoryAssignment {
  id: string;
  company_id: string;
  item_id: string;
  employee_id: string;
  quantity: number;
  status: string;
  assigned_at: string;
  returned_at: string | null;
  notes: string | null;
  item?: InventoryItem | null;
  employee?: Employee | null;
}

// ===== Opportunities Module =====
export interface Opportunity {
  id: string;
  company_id: string;
  customer_name: string;
  phone_number: string;
  alt_phone: string | null;
  address: string | null;
  city: string | null;
  location_link: string | null;
  interested_service: string | null;
  expected_budget: number | null;
  lead_source: string | null;
  notes: string | null;
  priority: string;
  status: string;
  created_by: string | null;
  converted_client_id: string | null;
  converted_contract_id: string | null;
  sales_lead_id: string | null;
  sent_to_sales_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: Employee | null;
  sales_lead?: Lead | null;
}

// ===== Sales CRM Module =====
export type LeadStage =
  | 'new_lead'
  | 'contacted'
  | 'follow_up'
  | 'quotation_sent'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Lead {
  id: string;
  company_id: string;
  full_name: string;
  phone_number: string;
  alternate_phone: string | null;
  address: string | null;
  area: string | null;
  lead_source: string | null;
  interested_service: string | null;
  notes: string | null;
  stage: LeadStage;
  assigned_employee_id: string | null;
  expected_value: number | null;
  follow_up_date: string | null;
  lost_reason: string | null;
  converted_client_id: string | null;
  opportunity_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  created_at: string;
  updated_at: string;
  assigned_employee?: Employee | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  event_type: string;
  message: string;
  user_name: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

// ===== Contract Payment Ledger =====
export interface ContractPayment {
  id: string;
  company_id: string;
  contract_id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

// ===== Financial Module =====
export interface Expense {
  id: string;
  company_id: string;
  title: string;
  category: string;
  amount: number;
  payment_method: string | null;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
  entered_by: string | null;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee | null;
}

export interface Payroll {
  id: string;
  company_id: string;
  employee_id: string;
  salary_amount: number;
  salary_month: string;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_by: string | null;
  payment_notes: string | null;
  expense_id: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee | null;
}

export interface ServiceRequest {
  id: string;
  company_id: string;
  client_id: string;
  contract_id: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface VisitRating {
  id: string;
  company_id: string;
  visit_id: string;
  client_id: string;
  employee_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}
