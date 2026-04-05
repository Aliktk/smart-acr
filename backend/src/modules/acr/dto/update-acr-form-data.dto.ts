import { IsObject } from "class-validator";

export class UpdateAcrFormDataDto {
  @IsObject()
  formData!: Record<string, unknown>;
}
