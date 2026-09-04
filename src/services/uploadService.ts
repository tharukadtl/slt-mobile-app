import api from './api';

// POST /api/uploads/photos — generic photo upload (FileUploadController.java).
// Backend hard caps this at 5 files per call and rejects non-JPEG/PNG content.
const MAX_PHOTOS = 5;

const guessMimeType = (uri: string): string => {
  const ext = uri.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : 'image/jpeg';
};

const uploadService = {
  uploadPhotos: async (uris: string[]): Promise<string[]> => {
    if (uris.length === 0) return [];
    if (uris.length > MAX_PHOTOS) {
      throw new Error(`A maximum of ${MAX_PHOTOS} photos can be uploaded at a time.`);
    }

    const form = new FormData();
    uris.forEach((uri, i) => {
      const type = guessMimeType(uri);
      const name = `photo_${i}.${type === 'image/png' ? 'png' : 'jpg'}`;
      // React Native's FormData accepts this {uri,name,type} shape for file parts.
      form.append('files', {uri, name, type} as unknown as Blob);
    });

    const response = await api.post('/api/uploads/photos', form, {
      headers: {'Content-Type': 'multipart/form-data'},
    });
    return response.data.urls as string[];
  },
};

export default uploadService;
