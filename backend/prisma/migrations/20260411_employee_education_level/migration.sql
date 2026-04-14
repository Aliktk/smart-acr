-- CreateEnum EducationLevel + AddColumn Employee.educationLevel
CREATE TYPE "EducationLevel" AS ENUM (
  'BELOW_MATRIC',
  'MATRIC',
  'INTERMEDIATE',
  'DIPLOMA',
  'BA_BSC',
  'BS_HONORS',
  'MA_MSC',
  'MS_MPHIL',
  'PHD',
  'OTHER'
);

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "educationLevel" "EducationLevel";
