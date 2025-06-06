import { Expose, Type } from 'class-transformer';
import { GalleryPhotoDto } from 'src/gallery/dto/gallery-photo.dto';
import { PlacePriceDto } from 'src/place-prices/dto/place-price.dto';

export class PlaceDto {
  @Expose()
  id: string;

  @Expose()
  place_name: string;

  @Expose()
  location_help: string;

  @Expose()
  address: string;

  @Expose()
  latitude: number;

  @Expose()
  longitude: number;

  @Expose()
  place_category: string;

  @Expose()
  region: string;

  @Expose()
  phone: string;

  @Expose()
  email: string;

  @Expose()
  website: string;

  @Expose()
  reservation_link: string;

  @Expose()
  pilgrim_exclusive: string;

  @Expose()
  allow_reservation: string;

  @Expose()
  dates_open: string;

  @Expose()
  time_open: string;

  @Expose()
  time_checkin: string;

  @Expose()
  time_checkout: string;

  @Expose()
  place_room_notes: string;

  @Expose()
  place_observations: string;

  @Expose()
  place_created_date: string;

  @Expose()
  place_management: string;

  @Expose()
  place_manager: string;

  @Expose()
  main_photo: string;

  @Expose()
  @Type(() => GalleryPhotoDto)
  gallery_photos: GalleryPhotoDto[];

  @Expose()
  @Type(() => PlacePriceDto)
  prices: PlacePriceDto[];
}
