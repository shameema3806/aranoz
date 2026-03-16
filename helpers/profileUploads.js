const multer = require('multer');
const path = require('path');
const fs = require('fs');

const profileUploadPath = path.join(__dirname, '../public/profile-images');

try {
  if (!fs.existsSync(profileUploadPath)) {
    fs.mkdirSync(profileUploadPath, { recursive: true });
    console.log(' Created public/profile-images folder');
  } else {
    console.log(' public/profile-images folder already exists');
  }
} catch (err) {
  console.error(' Failed to create folder:', err);
}

const profileStorage = multer.diskStorage({
  destination: function(req, file, cb) {
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

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const profileUploads = multer({ 
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },  
  fileFilter 
});

module.exports = profileUploads;