// src/places/dto/create-place.dto.ts
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CreatePlaceDto {
  @IsString()
  place_name: string;

  @IsOptional()
  @IsNumber()
  place_category?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  location_help?: string;

  @IsOptional()
  @IsString()
  pilgrim_exclusive?: string;

  @IsOptional()
  @IsString()
  allow_reservation?: string;

  @IsOptional()
  @IsString()
  main_photo?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  /*@IsOptional()
  @IsString()
  place_category_id?: string;*/

  @IsOptional()
  @IsString()
  camino_id?: string;

  // podes adicionar os outros campos que aparecem nos steps do frontend
  @IsOptional()
  services?: string[];

  @IsOptional()
  nearbyActivities?: string[];

  @IsOptional()
  prices?: any[];
}
