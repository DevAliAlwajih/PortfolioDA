import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsInt, IsString, Length, Max, Min } from 'class-validator';
import { PrismaService } from '../common/prisma.service';

class ReviewDto {
  @IsString() @Length(1, 80) name: string;
  @IsEmail() email: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @Length(1, 1000) comment: string;
}

@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  // Everything the home page needs. Review emails are never included.
  @Get()
  async home() {
    const [profile, sections, works, links, contacts, reviews] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: 1 } }),
      this.prisma.section.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
      this.prisma.work.findMany({
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        select: {
          id: true, type: true, titleAr: true, titleEn: true, version: true,
          summaryAr: true, summaryEn: true, imageUrl: true, link: true,
        },
      }),
      this.prisma.link.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
      this.prisma.contact.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
      this.prisma.review.findMany({
        where: { approved: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, rating: true, comment: true, createdAt: true },
      }),
    ]);
    return { profile, sections, works, links, contacts, reviews };
  }

  @Get('works/:id')
  async work(@Param('id', ParseIntPipe) id: number) {
    const work = await this.prisma.work.findUnique({ where: { id }, include: { files: true } });
    if (!work) throw new NotFoundException();
    return work;
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('reviews')
  async review(@Body() dto: ReviewDto) {
    await this.prisma.review.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        rating: dto.rating,
        comment: dto.comment.trim(),
        approved: false,
      },
    });
    return { ok: true };
  }
}
