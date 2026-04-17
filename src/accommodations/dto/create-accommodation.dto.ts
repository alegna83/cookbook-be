// src/accommodations/dto/create-place.dto.ts
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateAccommodationDto {
  @IsString()
  place_name: string;

  @IsOptional()
  place_category?: number | string;

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

  @IsOptional()
  @IsString()
  camino_id?: string;

  @IsOptional()
  services?: string[];

  @IsOptional()
  nearbyActivities?: string[];

  @IsOptional()
  prices?: any[];
}
