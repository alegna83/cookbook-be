export class HandlePlaceDto {
  action: string;//'getAll' | 'getOne' | 'create';
  payload?: {
    id?: string;
    bounds?: {
      south: number;
      north: number;
      west: number;
      east: number;
    };
    byCamino?: string;
    [key: string]: any;
  };
  page?: number;
  limit?: number;
}