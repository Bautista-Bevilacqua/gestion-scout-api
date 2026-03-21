import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "TU_CLOUD_NAME",
  api_key: process.env.CLOUDINARY_API_KEY || "TU_API_KEY",
  api_secret: process.env.CLOUDINARY_API_SECRET || "TU_API_SECRET",
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "sistema-scout-legajos",
      allowed_formats: ["jpg", "png", "pdf", "jpeg"],
      // ESTA LÍNEA ES LA QUE TE ARREGLA EL PROBLEMA DEL CELULAR:
      resource_type: "auto",
    };
  },
});
export const upload = multer({ storage: storage });
