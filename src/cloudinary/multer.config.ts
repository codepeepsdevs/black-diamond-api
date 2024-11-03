import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from './cloudinary.config';
import { Request } from 'express';
import { DRIVER_CLOUDINARY_FOLDER_NAME } from 'src/constants';
import { memoryStorage } from 'multer';

// Configure Cloudinary storage
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    public_id: (req: Request, file: Express.Multer.File) => {
      return `${Date.now()}_${file.originalname.split('.')[0]}`;
    },
    folder: process.env[DRIVER_CLOUDINARY_FOLDER_NAME], // Folder in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png'], // Allowed file formats
    // transformation: [{ width: 500, height: 500, crop: 'limit' }], // Optional transformations
  } as CloudinaryStorage['params'],
});

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
