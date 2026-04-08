export interface ImageCompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.75;
const DEFAULT_FORMAT = 'image/webp';

export async function compressImage(
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> {
  const {
    maxWidth = DEFAULT_MAX_DIMENSION,
    maxHeight = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    format = DEFAULT_FORMAT,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;

        if (width > height) {
          width = Math.min(width, maxWidth);
          height = width / aspectRatio;
        } else {
          height = Math.min(height, maxHeight);
          width = height * aspectRatio;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const extension = format.split('/')[1];
          const newFileName = file.name.replace(/\.[^/.]+$/, `.${extension}`);
          const compressedFile = new File([blob], newFileName, {
            type: format,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        format,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    reader.readAsDataURL(file);
  });
}

export async function getCroppedImage(
  imageSrc: string,
  croppedAreaPixels: CroppedArea,
  rotation = 0
): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const { width, height } = croppedAreaPixels;

      canvas.width = width;
      canvas.height = height;

      if (rotation) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-width / 2, -height / 2);
      }

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const file = new File([blob], 'cropped-image.webp', {
            type: 'image/webp',
            lastModified: Date.now(),
          });

          resolve(file);
        },
        'image/webp',
        DEFAULT_QUALITY
      );
    };

    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024;
  const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!allowedFormats.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported format. Please use JPG, PNG, or WebP.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 10MB.',
    };
  }

  return { valid: true };
}

export async function processImageForUpload(file: File, isSquare: boolean = false): Promise<File> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const needsCompression = file.size > 1.5 * 1024 * 1024;

  if (needsCompression || isSquare) {
    const maxDimension = isSquare ? 800 : DEFAULT_MAX_DIMENSION;
    return await compressImage(file, {
      maxWidth: maxDimension,
      maxHeight: maxDimension,
    });
  }

  return file;
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    reader.readAsDataURL(file);
  });
}

export interface NormalizeImageOptions {
  targetWidth?: number;
  targetHeight?: number;
  quality?: number;
  backgroundBlur?: boolean;
}

const FEED_TARGET_WIDTH = 1080;
const FEED_TARGET_HEIGHT = 1920;

export async function normalizeImageForFeed(
  file: File,
  options: NormalizeImageOptions = {}
): Promise<File> {
  const {
    targetWidth = FEED_TARGET_WIDTH,
    targetHeight = FEED_TARGET_HEIGHT,
    quality = 0.85,
    backgroundBlur = true
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const targetRatio = targetWidth / targetHeight;
      const imageRatio = img.width / img.height;

      let drawWidth: number;
      let drawHeight: number;
      let offsetX: number;
      let offsetY: number;

      if (imageRatio > targetRatio) {
        drawWidth = targetWidth;
        drawHeight = targetWidth / imageRatio;
        offsetX = 0;
        offsetY = (targetHeight - drawHeight) / 2;
      } else {
        drawHeight = targetHeight;
        drawWidth = targetHeight * imageRatio;
        offsetX = (targetWidth - drawWidth) / 2;
        offsetY = 0;
      }

      if (backgroundBlur && (offsetX > 0 || offsetY > 0)) {
        ctx.filter = 'blur(40px)';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        ctx.filter = 'brightness(0.3)';
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.filter = 'none';
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const extension = 'webp';
          const newFileName = file.name.replace(/\.[^/.]+$/, `.${extension}`);
          const normalizedFile = new File([blob], newFileName, {
            type: 'image/webp',
            lastModified: Date.now(),
          });

          resolve(normalizedFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    reader.readAsDataURL(file);
  });
}
