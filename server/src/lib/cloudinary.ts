import { v2 as cloudinary } from "cloudinary";
import { config } from "../config/index.js";

// Load the standard CLOUDINARY_URL first. Cloudinary supplies this single
// variable in many deployment dashboards; passing empty explicit values here
// used to overwrite it and made every upload fail with "Must supply cloud_name".
cloudinary.config(true);
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
}

export default cloudinary;
