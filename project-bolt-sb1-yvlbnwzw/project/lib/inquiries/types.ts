// Generic inquiry types — module-agnostic.
// subject_type is string (not a union) so TypeScript does not need to mirror
// the DB lookup table. DB enforces valid values via inquiry_subject_types FK.

export type InquiryStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'completed'
  | 'cancelled';

// Minimum contract for subject_meta. Each module adds its own fields.
export type InquirySubjectMeta = {
  title: string;
  [key: string]: unknown;
};

export type Inquiry = {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectMeta: InquirySubjectMeta;
  senderId: string;
  receiverId: string;
  threadId: string | null;
  message: string;
  status: InquiryStatus;
  expiresAt: string;
  respondedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

// DB row shape (snake_case) returned by Supabase queries
export type InquiryRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  subject_meta: InquirySubjectMeta;
  sender_id: string;
  receiver_id: string;
  thread_id: string | null;
  message: string;
  status: InquiryStatus;
  expires_at: string;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export function toInquiry(row: InquiryRow): Inquiry {
  return {
    id:           row.id,
    subjectType:  row.subject_type,
    subjectId:    row.subject_id,
    subjectMeta:  row.subject_meta,
    senderId:     row.sender_id,
    receiverId:   row.receiver_id,
    threadId:     row.thread_id,
    message:      row.message,
    status:       row.status,
    expiresAt:    row.expires_at,
    respondedAt:  row.responded_at,
    completedAt:  row.completed_at,
    createdAt:    row.created_at,
  };
}
