import { supabase } from './supabase/client';

export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  videos: ['video/mp4', 'video/webm', 'video/quicktime'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB

export type AttachmentType = 'image' | 'video' | 'document';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  type?: AttachmentType;
}

export interface UploadProgress {
  progress: number;
  uploading: boolean;
  error?: string;
}

export const getFileType = (mimeType: string): AttachmentType | null => {
  if (ALLOWED_FILE_TYPES.images.includes(mimeType)) return 'image';
  if (ALLOWED_FILE_TYPES.videos.includes(mimeType)) return 'video';
  if (ALLOWED_FILE_TYPES.documents.includes(mimeType)) return 'document';
  return null;
};

export const validateFile = (file: File): FileValidationResult => {
  const fileType = getFileType(file.type);

  if (!fileType) {
    return {
      valid: false,
      error: 'upload.errorFileType',
    };
  }

  const maxSize = fileType === 'video' ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: fileType === 'video' ? 'upload.errorVideoTooLarge' : 'upload.errorFileTooLarge',
    };
  }

  return {
    valid: true,
    type: fileType,
  };
};

export const uploadFile = async (
  file: File,
  userId: string,
  onProgress?: (progress: number) => void,
  bucketName: 'message-attachments' | 'post-media' = 'message-attachments'
): Promise<{ url: string; path: string } | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  console.log('[UPLOAD] Starting upload:', {
    bucket: bucketName,
    path: fileName,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('[UPLOAD] Upload error:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  console.log('[UPLOAD] Upload successful:', {
    bucket: bucketName,
    path: data.path,
    url: publicUrl
  });

  return {
    url: publicUrl,
    path: data.path,
  };
};

export const extractStoragePathFromUrl = (url: string, bucketName: string): string | null => {
  try {
    const bucketPath = `/storage/v1/object/public/${bucketName}/`;
    const index = url.indexOf(bucketPath);
    if (index === -1) return null;

    return url.substring(index + bucketPath.length);
  } catch (error) {
    console.error('Error extracting storage path:', error);
    return null;
  }
};

export const deleteFile = async (
  filePath: string,
  bucketName: 'message-attachments' | 'post-media' = 'message-attachments'
): Promise<boolean> => {
  const { error } = await supabase.storage
    .from(bucketName)
    .remove([filePath]);

  if (error) {
    console.error('Delete error:', error);
    return false;
  }

  return true;
};

export const uploadVideoToCloudinary = async (
  file: File,
  folder: string = 'gigzone/posts',
  userId?: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string; public_id: string } | null> => {
  try {
    const bucketName: 'message-attachments' | 'post-media' = folder.includes('messages')
      ? 'message-attachments'
      : 'post-media';

    const fileExt = file.name.split('.').pop() ?? 'mp4';
    const pathPrefix = userId ?? 'shared';
    const fileName = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    onProgress?.(10);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('[Video Upload] Supabase error:', error);
      return null;
    }

    onProgress?.(90);

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    onProgress?.(100);

    return { url: publicUrl, public_id: data.path };
  } catch (error) {
    console.error('[Video Upload Error]', error);
    return null;
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
