export class HandleAdminDto {
  action:
    | 'getPendingAccommodations'
    | 'getPendingComments'
    | 'getPendingRemovalRequests'
    | 'getRemovalRequests'
    | 'approveAccommodation'
    | 'approveComment'
    | 'approveRemovalRequest'
    | 'rejectAccommodation'
    | 'rejectComment'
    | 'rejectRemovalRequest'
    | 'rejectRemoval';

  payload?: {
    id?: number;
    rejectionReason?: string;
    [key: string]: any;
  };
}
