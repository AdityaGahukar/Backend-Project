import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp"); // specify the destination folder for uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // we can use custom naming convention here (refer docs)
    }
});

export const upload = multer({storage});
