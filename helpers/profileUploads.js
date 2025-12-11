// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Profile images upload folder
// const profileUploadPath = path.join(__dirname, '../uploads/profile-images');

// // Create folder if it doesn't exist
// if (!fs.existsSync(profileUploadPath)) {
//     fs.mkdirSync(profileUploadPath, { recursive: true });
// }

// // Multer storage configuration for profile images
// const profileStorage = multer.diskStorage({
//     destination: function(req, file, cb) {
//         cb(null, profileUploadPath);
//     },
//     filename: function(req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, uniqueSuffix + path.extname(file.originalname));
//     }
// });

// // Export multer instance
// const profileUploads = multer({ storage: profileStorage });

// module.exports = profileUploads;


const multer = require('multer');
const path = require('path');
const fs = require('fs');

// FIXED: Use raw Windows path to handle spaces; adjust if your project path changes
const profileUploadPath = 'D:/FIRST PROJECT/aranoz/public/profile-images';  // Raw path (forward slashes work on Windows)

// Create folder if it doesn't exist (with error handling)
try {
  if (!fs.existsSync(profileUploadPath)) {
    fs.mkdirSync(profileUploadPath, { recursive: true });
    console.log(' Created public/profile-images folder');
  } else {
    console.log(' public/profile-images folder already exists');
  }
} catch (err) {
  console.error(' Failed to create folder:', err);
  // Fallback: Try alternative path without spaces (rename project folder if possible)
}

// Multer storage configuration for profile images
const profileStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Re-check/create on each upload for safety
    if (!fs.existsSync(profileUploadPath)) {
      fs.mkdirSync(profileUploadPath, { recursive: true });
    }
    cb(null, profileUploadPath);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Enhanced: File filter & limits
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Export multer instance
const profileUploads = multer({ 
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB max
  fileFilter 
});

module.exports = profileUploads;