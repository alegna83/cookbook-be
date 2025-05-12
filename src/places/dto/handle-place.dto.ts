export class HandlePlaceDto {
  action: string;//'getAll' | 'getOne' | 'create';
  payload?: any;
  page?: number;
  limit?: number;
}