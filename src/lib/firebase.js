require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const stream = require('stream');

// Creates a client
const storage = new Storage();

async function uploadBase64(filePath, base64String) {
  try {
    const fileRef = await storage.bucket(process.env.STORAGE_BUCKET).file(`${filePath}.png`);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(Buffer.from(base64String, 'base64'));
    bufferStream.pipe(fileRef.createWriteStream({
      metadata: {
        contentType: 'image/png',
        metadata: {
          custom: 'metadata',
        },
      },
      public: true,
      validation: 'md5',
    }));

    return fileRef.publicUrl();
  } catch (error) {
    console.error(error);
    return false;
  }
}

module.exports = {
  uploadBase64,
};
