export const TOOLS = {
  "image-compressor": {
    id: "image-compressor",
    name: "Image Compressor",
    category: "image",
    module: "image-compressor",
    accepts: [
      "image/jpeg",
      "image/png",
      "image/webp"
    ],
    multiple: true,
    maxFiles: 20,
    maxSizeMB: 25
  }
};