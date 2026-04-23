export class UploadResponseDto {
  url: string;
  publicId: string;
}

export class UploadMultipleResponseDto {
  files: UploadResponseDto[];
}
