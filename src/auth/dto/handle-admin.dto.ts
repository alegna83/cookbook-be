export class HandleAdminDto {
  action:
    | 'getPendingAccommodations'
    | 'getPendingComments'
    | 'approveAccommodation'
    | 'approveComment'
    | 'rejectAccommodation'
    | 'rejectComment';

  payload?: {
    id?: number;
    rejectionReason?: string;
    [key: string]: any;
  };
}
