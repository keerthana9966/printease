const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'die4meaf5',
  api_key: process.env.CLOUDINARY_API_KEY || '159926379154654',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mcxHnhmG34S19OSvXGH8C2Az3GM'
});

module.exports = cloudinary;
