const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Correct path: public/img/product
const uploadPath = path.join(__dirname, '../public/upload/product-images');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploads = multer({ storage: storage });

module.exports = uploads;
