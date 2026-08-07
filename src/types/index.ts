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
  employee_id: string;
  display_name: string;
  employee?: Employee | null;
  created_at: string;
}

export interface Client {
  id: string;
  company_id: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  address: string | null;
  service_area: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  price: number;
  discount: number;
  tax: number;
  final_price: number;
  duration_weeks: number;
  visits_per_week: number;
  total_visits: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  company_id: string;
  client_id: string;
  package_id: string | null;
  contract_number: string;
  start_date: string;
  end_date: string;
  status: string;
  price: number;
  discount: number;
  tax: number;
  final_amount: number;
  amount_paid: number;
  remaining_balance: number;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  package?: Package | null;
  employee?: Employee | null;
}

export interface ContractWithRelations extends Contract {
  client: Client | null;
  package: Package | null;
  employee: Employee | null;
}

export interface Visit {
  id: string;
  company_id: string;
  contract_id: string;
  employee_id: string | null;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  status: string;
  visit_index: number;
  visit_type: string;
  visit_duration_minutes: number | null;
  actual_started_at: string | null;
  actual_completed_at: string | null;
  visit_charge_amount: number | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  package?: Package | null;
}

export interface VisitWithRelations extends Visit {
  employee: Employee | null;
  contract: Contract | null;
}

export interface QrCode {
  id: string;
  code: string;
  visit_id: string;
  employee_id: string;
  valid_from: string;
  valid_until: string;
  used_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  contract_id: string | null;
  visit_id: string | null;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  remaining_balance: number;
  status: string;
  payment_status: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  company_id: string;
  invoice_id: string;
  contract_id: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string | null;
  audience: string | null;
  category: string | null;
  notification_type: string | null;
  recipient_employee_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  company_id: string;
  client_id: string | null;
  contract_id: string | null;
  subject: string;
  message: string;
  status: string;
  source: string;
  requester_name: string | null;
  requester_phone: string | null;
  requester_address: string | null;
  requested_service: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
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

export interface SearchResult {
  id: string;
  type: string;
  label: string;
  subtitle: string;
  link: string;
}

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
  status: string;
  priority: string;
  notes: string | null;
  sales_lead_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: Employee | null;
}
