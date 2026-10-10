import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Role, ROLE_LABELS } from '../common/access.constants';
import { toObjectId } from '../common/utils/object-id';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { User, UserDocument } from './user.schema';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleLabel: string;
  active: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly config: ConfigService,
  ) {}

  /** Crea el administrador inicial si la colección de usuarios está vacía. */
  async onModuleInit(): Promise<void> {
    if ((await this.userModel.estimatedDocumentCount()) > 0) return;
    const email = this.config.get<string>('ADMIN_EMAIL', 'admin@qa.local');
    await this.userModel.create({
      email,
      name: this.config.get<string>('ADMIN_NAME', 'Administrador'),
      passwordHash: await bcrypt.hash(this.config.get<string>('ADMIN_PASSWORD', 'Admin123!'), 10),
      role: Role.ADMIN,
    });
    this.logger.log(`Usuario administrador inicial creado: ${email}`);
  }

  static toPublic(user: UserDocument): PublicUser {
    const u = user.toObject() as User & { _id: unknown; createdAt?: Date };
    return {
      id: String(u._id),
      email: u.email,
      name: u.name,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role],
      active: u.active,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(toObjectId(id, 'usuario')).exec();
  }

  async list(): Promise<PublicUser[]> {
    const users = await this.userModel.find().sort({ name: 1 }).exec();
    return users.map(UsersService.toPublic);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    if (await this.findByEmail(dto.email)) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }
    const user = await this.userModel.create({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      passwordHash: await bcrypt.hash(dto.password, 10),
    });
    return UsersService.toPublic(user);
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (id === currentUserId && (dto.active === false || (dto.role && dto.role !== Role.ADMIN))) {
      throw new BadRequestException('No puede desactivar ni quitarse el rol de administrador a sí mismo.');
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.active !== undefined) user.active = dto.active;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 10);
    await user.save();
    return UsersService.toPublic(user);
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.userModel.updateOne({ _id: toObjectId(id) }, { passwordHash: await bcrypt.hash(password, 10) });
  }

  async touchLogin(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: toObjectId(id) }, { lastLoginAt: new Date() });
  }
}
