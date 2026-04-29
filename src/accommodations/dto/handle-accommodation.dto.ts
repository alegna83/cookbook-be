export class HandleAccommodationDto {
  action:
    | 'getAll'
    | 'getOne'
    | 'create'
    | 'getByCamino'
    | 'getByOwner'
    | 'getByBounds'
    | 'getByPlaceId'
    | 'edit'
    | 'requestRemoval';
  payload?: {
    id?: string;
    bounds?: {
      south: number;
      north: number;
      west: number;
      east: number;
    };
    byCamino?: string;
    placeId?: number;
    accountId?: number;
    reason?: string;
    [key: string]: any;
  };
  page?: number;
  limit?: number;
}
