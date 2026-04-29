export class HandleAdminDto {
  action:
    | 'getPendingAccommodations'
    | 'getPendingComments'
    | 'getPendingRemovalRequests'
    | 'approveAccommodation'
    | 'approveComment'
    | 'approveRemovalRequest'
    | 'rejectAccommodation'
    | 'rejectComment'
    | 'rejectRemovalRequest';

  payload?: {
    id?: number;
    rejectionReason?: string;
    [key: string]: any;
  };
}
