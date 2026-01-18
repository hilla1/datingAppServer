import {
  uploadToCloudinary,
  deleteFromCloudinary,
  renameInCloudinary,
} from '../middleware/uploadMiddleware.js';
import mime from 'mime-types';

export const uploadFile = async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    return res.json({
      success: true,
      message: 'File uploaded successfully',
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'File upload failed',
      error: error.message 
    });
  }
};

export const deleteFile = async (req, res) => {
  const userId = req.userId;
  const { publicId } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!publicId) {
    return res.status(400).json({ success: false, message: 'Missing publicId' });
  }

  try {
    const { success, resourceType } = await deleteFromCloudinary(publicId);

    if (success) {
      return res.json({ 
        success: true,
        message: `File deleted successfully (as ${resourceType})`
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Delete failed after trying all resource types',
    });
  } catch (error) {
    console.error('Deletion error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.message.includes('not found') ? 'File not found' : 'File deletion failed',
      error: error.message 
    });
  }
};


export const renameFile = async (req, res) => {
  const userId = req.userId;
  const { publicId, newName } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!publicId || !newName) {
    return res.status(400).json({
      success: false,
      message: 'Missing publicId or newName',
    });
  }

  const mimeType = mime.lookup(newName) || '';
  const resourceTypes = ['raw', 'image', 'video'];

  for (const type of resourceTypes) {
    try {
      const result = await renameInCloudinary(publicId, newName, mimeType, type);

      if (result?.public_id) {
        return res.json({
          success: true,
          message: 'File renamed successfully',
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    } catch (error) {
      if (error.message?.includes('Resource not found')) {
        // try next resource type
        continue;
      } else {
        console.error(`Rename failed for type ${type}:`, error.message);
        return res.status(500).json({
          success: false,
          message: `Rename failed on resource type ${type}`,
          error: error.message,
        });
      }
    }
  }

  return res.status(404).json({
    success: false,
    message: 'File not found in any resource type',
  });
};
