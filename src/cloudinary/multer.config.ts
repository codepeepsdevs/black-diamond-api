import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { cloudinary } from './cloudinary.config';
import { Request } from 'express';
import { DRIVER_CLOUDINARY_FOLDER_NAME } from 'src/constants';
import { memoryStorage, StorageEngine } from 'multer';

type CloudinaryStoredFile = Express.Multer.File & {
  filename?: string;
  path?: string;
};

class CloudinaryStorageEngine implements StorageEngine {
  _handleFile(
    _request: Request,
    file: Express.Multer.File,
    callback: (error?: Error | null, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const publicId = `${Date.now()}_${file.originalname.split('.')[0]}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: process.env[DRIVER_CLOUDINARY_FOLDER_NAME],
        allowed_formats: ['jpg', 'jpeg', 'png'],
      },
      (error, result) => {
        if (error || !result) {
          callback(error || new Error('Cloudinary upload failed'));
          return;
        }

        callback(null, {
          filename: result.public_id,
          path: result.secure_url,
          size: result.bytes,
        });
      },
    );

    file.stream.pipe(uploadStream);
  }

  _removeFile(
    _request: Request,
    file: CloudinaryStoredFile,
    callback: (error: Error | null) => void,
  ): void {
    if (!file.filename) {
      callback(null);
      return;
    }

    cloudinary.uploader
      .destroy(file.filename)
      .then(() => callback(null))
      .catch((error) => callback(error));
  }
}

// Configure Cloudinary storage
const cloudinaryStorage = new CloudinaryStorageEngine();

export const multerOptions: MulterOptions = {
  storage: cloudinaryStorage,
};

export const multerCSVOptions: MulterOptions = {
  storage: memoryStorage(), // Use memory storage instead of cloud storage
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    // Only allow CSV files
    if (file.mimetype !== 'text/csv') {
      return cb(new Error('Only CSV files are allowed!'), false);
    }
    cb(null, true); // Accept the file
  },
  limits: {
    fileSize: 1024 * 1024 * 5, // Limit file size to 5MB
  },
};

// export const multerCSVOptions: MulterOptions = {
//   storage: {
//     cloudinary: cloudinary,
//     params: {
//       public_id: (req: Request, file: Express.Multer.File) => {
//         return `${Date.now()}_${file.originalname.split('.')[0]}`;
//       },
//       folder: process.env[DRIVER_CLOUDINARY_FOLDER_NAME], // Folder in Cloudinary
//       allowed_formats: ['.csv'], // Allowed file formats
//       // transformation: [{ width: 500, height: 500, crop: 'limit' }], // Optional transformations
//     } as CloudinaryStorage['params'],
//   },
// };
