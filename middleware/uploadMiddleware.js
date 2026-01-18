import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import mime from 'mime-types';

const storage = multer.memoryStorage();
export const upload = multer({ storage });

const CLOUDINARY_AUTO_EXTENSION_TYPES = [
  'image/',
  'video/',
];

const shouldAddExtension = (mimeType) => {
  if (CLOUDINARY_AUTO_EXTENSION_TYPES.some(type => mimeType?.startsWith(type))) {
    return false;
  }
  return true;
};

const generatePublicId = (originalName, mimeType) => {
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now();

  let publicId = `${safeBase}-${timestamp}`;

  if (shouldAddExtension(mimeType)) {
    const ext = mime.extension(mimeType) || originalName.split('.').pop() || '';
    if (ext) {
      publicId += `.${ext}`;
    }
  }

  return publicId;
};

const getResourceType = (mimeType) => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  return 'raw';
};

export const uploadToCloudinary = async (fileBuffer, originalName = 'file') => {
  const mimeType = mime.lookup(originalName) || '';
  const publicId = generatePublicId(originalName, mimeType);
  const resourceType = getResourceType(mimeType);

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: publicId,
        invalidate: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  const resourceTypesToTry = ['raw', 'image', 'video'];
  let lastError = null;

  for (const resourceType of resourceTypesToTry) {
    try {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(
          publicId,
          {
            resource_type: resourceType,
            invalidate: true,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      if (result.result === 'ok') {
        return {
          success: true,
          resourceType,
          result
        };
      }
    } catch (error) {
      lastError = error;
      if (!error.message.includes('not found')) {
        console.warn(`Delete attempt failed for ${publicId} as ${resourceType}:`, error.message);
      }
    }
  }

  throw lastError || new Error(`File not found or could not be deleted (tried as raw, image, and video)`);
};

export const renameInCloudinary = async (publicId, newName, mimeType, resourceTypeFromClient = null) => {
  const newPublicId = generatePublicId(newName, mimeType);
  const resourceType = resourceTypeFromClient || getResourceType(mimeType);

  return new Promise((resolve, reject) => {
    cloudinary.uploader.rename(
      publicId,
      newPublicId,
      {
        resource_type: resourceType,
        invalidate: true,
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
  });
};
