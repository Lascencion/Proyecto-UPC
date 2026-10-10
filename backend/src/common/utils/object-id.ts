import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export function toObjectId(id: string, label = 'identificador'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException(`El ${label} "${id}" no es válido.`);
  }
  return new Types.ObjectId(id);
}
