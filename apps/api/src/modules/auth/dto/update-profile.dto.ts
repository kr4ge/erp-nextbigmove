import { IsOptional, IsString, MinLength, MaxLength, Matches, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  employeeId?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ValidateIf((o) => o.newPassword !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and number/special character',
  })
  newPassword?: string;
}
