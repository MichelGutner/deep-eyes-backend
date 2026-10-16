import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PRISMA_SERVICE, PrismaService } from '@/modules/prisma';
import { normalizeAndroidAbi } from '../../domain/native-frames';
import { SymbolStoreService } from '../services/symbol-store.service';

class UploadMetaDto {
  @IsOptional() @IsString() @MaxLength(200) release?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(32) arch?: string;
}

/** The subset of multer's file object this controller uses (@types/multer isn't installed). */
interface UploadedTempFile {
  path: string;
  originalname: string;
  size: number;
}

const MAX_UPLOAD_BYTES =
  Number(process.env.SYMBOLS_MAX_UPLOAD_MB ?? 1024) * 1024 * 1024;
// Streamed to disk, never buffered in memory — dSYMs and mappings get big.
const uploadToDisk = FileInterceptor('file', {
  dest: join(tmpdir(), 'deep-eyes-uploads'),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

/**
 * Debug symbol uploads, meant to be called from the release build (Gradle task / Xcode
 * build phase / CI). Authenticated with a user JWT, not the application's apiKey: the
 * apiKey ships inside the app binary, so it must not be able to overwrite symbols.
 */
@Controller('applications/:applicationId/symbols')
export class SymbolsController {
  constructor(
    private readonly store: SymbolStoreService,
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
  ) {}

  private async assertApplication(
    applicationId: string,
    req: Request,
  ): Promise<void> {
    const orgId = (req as any).user?.organizationId;
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { organization_id: true },
    });
    if (!app || (orgId && app.organization_id !== orgId)) {
      throw new NotFoundException('Application not found');
    }
  }

  /** Runs `fn` with the uploaded temp file and always cleans it up (moved files are already gone). */
  private async withUpload<T>(
    file: UploadedTempFile | undefined,
    fn: (file: UploadedTempFile) => Promise<T>,
  ): Promise<T> {
    if (!file) throw new BadRequestException('Missing multipart field "file"');
    try {
      return await fn(file);
    } finally {
      await rm(file.path, { force: true });
    }
  }

  @Get()
  async list(
    @Param('applicationId') applicationId: string,
    @Req() req: Request,
  ) {
    await this.assertApplication(applicationId, req);
    return this.store.list(applicationId);
  }

  /** R8/ProGuard `mapping.txt` for one release (the SDK's `release`, e.g. versionName). */
  @Post('android-mapping')
  @UseInterceptors(uploadToDisk)
  async uploadAndroidMapping(
    @Param('applicationId') applicationId: string,
    @UploadedFile() file: UploadedTempFile | undefined,
    @Body() body: UploadMetaDto,
    @Req() req: Request,
  ) {
    return this.withUpload(file, async (upload) => {
      await this.assertApplication(applicationId, req);
      if (!body.release) throw new BadRequestException('"release" is required');
      return this.store.saveAndroidMapping(
        applicationId,
        body.release,
        upload.path,
      );
    });
  }

  /** Zipped .dSYM bundle(s) or a bare DWARF file; indexed by image UUID, so no release needed. */
  @Post('dsym')
  @UseInterceptors(uploadToDisk)
  async uploadDsym(
    @Param('applicationId') applicationId: string,
    @UploadedFile() file: UploadedTempFile | undefined,
    @Req() req: Request,
  ) {
    return this.withUpload(file, async (upload) => {
      await this.assertApplication(applicationId, req);
      let stored;
      try {
        stored = await this.store.saveDsym(applicationId, upload.path);
      } catch (err) {
        throw new UnprocessableEntityException((err as Error).message);
      }
      if (!stored.length) {
        throw new UnprocessableEntityException(
          'No Mach-O DWARF file with an LC_UUID found in the upload',
        );
      }
      return { images: stored };
    });
  }

  /** Unstripped `.so` (from `build/intermediates/merged_native_libs/...`) for NDK frames. */
  @Post('native-lib')
  @UseInterceptors(uploadToDisk)
  async uploadNativeLib(
    @Param('applicationId') applicationId: string,
    @UploadedFile() file: UploadedTempFile | undefined,
    @Body() body: UploadMetaDto,
    @Req() req: Request,
  ) {
    return this.withUpload(file, async (upload) => {
      await this.assertApplication(applicationId, req);
      if (!body.release) throw new BadRequestException('"release" is required');
      const name = body.name || upload.originalname;
      if (!name.endsWith('.so'))
        throw new BadRequestException(
          '"name" must be the .so file name, e.g. libapp.so',
        );
      return this.store.saveNativeLib(
        applicationId,
        body.release,
        name,
        normalizeAndroidAbi(body.arch),
        upload.path,
      );
    });
  }

  @Delete(':symbolId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('applicationId') applicationId: string,
    @Param('symbolId') symbolId: string,
    @Req() req: Request,
  ) {
    await this.assertApplication(applicationId, req);
    if (!(await this.store.remove(applicationId, symbolId))) {
      throw new NotFoundException('Symbol file not found');
    }
  }
}
