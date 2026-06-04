import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImageCompressionService {
  private readonly logger = new Logger(ImageCompressionService.name);

  async compressBase64Image(base64Data: string): Promise<string> {
    if (!base64Data || !base64Data.startsWith('data:image')) {
      return base64Data;
    }

    try {
      const base64Match = base64Data.match(
        /^data:(image\/[a-zA-Z]+);base64,(.+)$/,
      );
      if (!base64Match) return base64Data;

      const mimeType = base64Match[1];
      const base64Content = base64Match[2];

      const buffer = Buffer.from(base64Content, 'base64');

      let outputFormat: 'jpeg' | 'png' | 'webp' = 'jpeg';
      if (mimeType === 'image/png') outputFormat = 'png';
      if (mimeType === 'image/webp') outputFormat = 'webp';

const quality = outputFormat === 'png' ? 6 : 40;

       const compressedBuffer = await sharp(buffer)
         .resize({
           width: 500,
           height: 500,
           fit: 'inside',
           withoutEnlargement: true,
         })
        .toFormat(outputFormat, { quality })
        .toBuffer();

      const compressedBase64 = compressedBuffer.toString('base64');
      const originalSize = buffer.length;
      const compressedSize = compressedBuffer.length;

      this.logger.log(
        `Image compressed: ${originalSize} bytes -> ${compressedSize} bytes (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`,
      );

      return `data:image/${outputFormat};base64,${compressedBase64}`;
    } catch (error) {
      this.logger.error(`Failed to compress image: ${error.message}`);
      return base64Data;
    }
  }

  async compressImages(images: string[]): Promise<string[]> {
    if (!images || !Array.isArray(images)) return images;

    const compressedImages = await Promise.all(
      images.map((img) => this.compressBase64Image(img)),
    );

    return compressedImages.filter(
      (img) => img && img.startsWith('data:image'),
    );
  }
}
