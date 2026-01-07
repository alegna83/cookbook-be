export class HandleAccommodationDto {
  action: string;
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
    [key: string]: any;
  };
  page?: number;
  limit?: number;
}
