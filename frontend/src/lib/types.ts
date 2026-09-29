export type Role = "ADMIN" | "ESTETICISTA";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  googleEmail: string | null;
}

export interface KanbanStage {
  id: string;
  tenantId: string;
  name: string;
  orderIndex: number;
  color: string;
  patients: Patient[];
}

export interface Patient {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  birthDate: string | null;
  cpf: string | null;
  address: string | null;
  avatarUrl: string | null;
  stageId: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  stage?: KanbanStage | null;
  appointments?: Appointment[];
  anamnesis?: AnamnesisForm[];
  evolutions?: ClinicalEvolution[];
  messages?: Message[];
}

export interface Procedure {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  color: string;
  active: boolean;
}

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt?: string;
  _count?: { appointments: number };
}

export interface AppointmentTagLink {
  id: string;
  tagId: string;
  appointmentId: string;
  tag: Tag;
}

export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  procedureId: string | null;
  startTime: string;
  endTime: string;
  googleEventId: string | null;
  status: AppointmentStatus;
  notes: string | null;
  patient?: Patient;
  procedure?: Procedure | null;
  tags?: AppointmentTagLink[];
}

export interface AnamnesisForm {
  id: string;
  tenantId: string;
  patientId: string;
  healthHistory: string | null;
  allergies: string | null;
  medications: string | null;
  skinType: string | null;
  lifestyle: string | null;
  complaints: string | null;
  attachmentUrl: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface BodyMapMarking {
  id: string;
  evolutionId: string;
  tenantId: string;
  procedureId: string | null;
  bodyRegion: string;
  view: "front" | "back" | "face";
  specificNotes: string | null;
  posX: number;
  posY: number;
  procedure?: Procedure | null;
}

export interface ClinicalEvolution {
  id: string;
  tenantId: string;
  patientId: string;
  sessionDate: string;
  generalNotes: string | null;
  createdAt: string;
  markings: BodyMapMarking[];
  patient?: Patient;
}

export interface Message {
  id: string;
  tenantId: string;
  patientId: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  timestamp: string;
  readAt: string | null;
}

export interface Conversation {
  patient: Pick<Patient, "id" | "name" | "phone" | "avatarUrl">;
  lastMessage: Message | null;
  unread: number;
}

export interface BodyRegion {
  id: string;
  label: string;
  view: "front" | "back" | "face";
  cx: number;
  cy: number;
  r: number;
}

export interface DashboardData {
  patients: number;
  monthAppointments: number;
  todayAppointments: Appointment[];
  funnel: { id: string; name: string; color: string; count: number }[];
  recentPatients: Patient[];
  whatsapp: string;
}

export interface WhatsAppStatus {
  status: "DISCONNECTED" | "CONNECTING" | "QR_READY" | "CONNECTED" | "FAILED";
  qrCode: string | null;
  phoneNumber: string | null;
  provider?: "WEB" | "OFFICIAL" | "DEMO";
}
