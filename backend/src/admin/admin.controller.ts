import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe,
  Post, Put, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, unlink } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const BLOCKED_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.php', '.svg']);
const WORK_TYPES = ['WEB', 'MOBILE', 'DESKTOP', 'OTHER'];

// Fields the admin may write for each resource. Anything else in the body is dropped.
const RESOURCES: Record<string, { model: string; fields: string[]; ints: string[]; json: string[] }> = {
  sections: { model: 'section', fields: ['titleAr', 'titleEn', 'bodyAr', 'bodyEn', 'order'], ints: ['order'], json: [] },
  works: {
    model: 'work',
    fields: [
      'type', 'titleAr', 'titleEn', 'version', 'summaryAr', 'summaryEn', 'imageUrl', 'link',
      'introAr', 'introEn', 'policyAr', 'policyEn', 'steps', 'gallery', 'order',
    ],
    ints: ['order'],
    json: ['steps', 'gallery'],
  },
  links: { model: 'link', fields: ['title', 'url', 'order'], ints: ['order'], json: [] },
  contacts: { model: 'contact', fields: ['title', 'value', 'order'], ints: ['order'], json: [] },
};
const PROFILE_FIELDS = ['nameAr', 'nameEn', 'phone', 'photoUrl', 'aboutAr', 'aboutEn', 'visionAr', 'visionEn'];

function pick(body: any, spec: { fields: string[]; ints?: string[]; json?: string[] }) {
  const data: Record<string, any> = {};
  for (const key of spec.fields) {
    if (!(key in (body || {}))) continue;
    const v = body[key];
    if (spec.ints?.includes(key)) {
      const n = Number(v);
      data[key] = Number.isFinite(n) ? Math.trunc(n) : 0;
    } else if (spec.json?.includes(key)) {
      if (!Array.isArray(v)) throw new BadRequestException(`${key} must be an array`);
      data[key] = v;
    } else if (typeof v === 'string') {
      data[key] = v;
    } else if (v !== undefined && v !== null) {
      throw new BadRequestException(`${key} must be text`);
    }
  }
  return data;
}

function checkUrl(value: string, field: string) {
  // Links must be http(s) or a path on this server, so javascript: URLs can't be stored.
  if (value && !/^(https?:\/\/|\/uploads\/|tel:|mailto:)/i.test(value)) {
    throw new BadRequestException(`${field} must start with http(s)://`);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  private db(model: string): any {
    return (this.prisma as any)[model];
  }

  // ---------- profile (header, About, Vision)
  @Get('profile')
  getProfile() {
    return this.prisma.profile.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  @Put('profile')
  async putProfile(@Body() body: any) {
    const data = pick(body, { fields: PROFILE_FIELDS });
    if (data.photoUrl !== undefined) checkUrl(data.photoUrl, 'photoUrl');
    return this.prisma.profile.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  }

  // ---------- reviews
  @Get('reviews')
  reviews() {
    return this.prisma.review.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Put('reviews/:id')
  async setReview(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const exists = await this.prisma.review.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    return this.prisma.review.update({ where: { id }, data: { approved: !!body?.approved } });
  }

  @Delete('reviews/:id')
  async delReview(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.review.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ---------- uploads (images and downloadable files)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) =>
          cb(null, randomBytes(12).toString('hex') + extname(file.originalname).toLowerCase().slice(0, 12)),
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        cb(BLOCKED_EXT.has(ext) ? new BadRequestException('This file type is not allowed') : null, !BLOCKED_EXT.has(ext));
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file');
    return {
      url: `/uploads/${file.filename}`,
      name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      size: file.size,
    };
  }

  // ---------- downloadable files attached to a work
  @Post('works/:id/files')
  async addFile(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException();
    const name = String(body?.name || '').slice(0, 200);
    const url = String(body?.url || '');
    if (!name || !url.startsWith('/uploads/')) throw new BadRequestException('Upload the file first');
    return this.prisma.workFile.create({ data: { workId: id, name, url, size: Number(body?.size) || 0 } });
  }

  @Delete('files/:id')
  async delFile(@Param('id', ParseIntPipe) id: number) {
    const f = await this.prisma.workFile.findUnique({ where: { id } });
    if (!f) return { ok: true };
    await this.prisma.workFile.delete({ where: { id } });
    const path = join(UPLOAD_DIR, f.url.replace('/uploads/', '').replace(/[^\w.\-]/g, ''));
    unlink(path, () => undefined);
    return { ok: true };
  }

  // ---------- generic CRUD: sections, works, links, contacts
  private resource(name: string) {
    const spec = RESOURCES[name];
    if (!spec) throw new NotFoundException();
    return spec;
  }

  private validate(name: string, data: Record<string, any>) {
    if (name === 'works') {
      if (data.type !== undefined && !WORK_TYPES.includes(data.type)) throw new BadRequestException('Bad type');
      checkUrl(data.link, 'link');
      checkUrl(data.imageUrl, 'imageUrl');
    }
    if (name === 'links') checkUrl(data.url, 'url');
  }

  @Get(':resource')
  list(@Param('resource') name: string) {
    const spec = this.resource(name);
    return this.db(spec.model).findMany({
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      ...(name === 'works' ? { include: { files: true } } : {}),
    });
  }

  @Post(':resource')
  create(@Param('resource') name: string, @Body() body: any) {
    const spec = this.resource(name);
    const data = pick(body, spec);
    this.validate(name, data);
    return this.db(spec.model).create({ data });
  }

  @Put(':resource/:id')
  async update(@Param('resource') name: string, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const spec = this.resource(name);
    const data = pick(body, spec);
    this.validate(name, data);
    const exists = await this.db(spec.model).findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    return this.db(spec.model).update({ where: { id }, data });
  }

  @Delete(':resource/:id')
  async remove(@Param('resource') name: string, @Param('id', ParseIntPipe) id: number) {
    const spec = this.resource(name);
    await this.db(spec.model).deleteMany({ where: { id } });
    return { ok: true };
  }
}
