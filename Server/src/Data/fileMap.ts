export type FileRecord = {
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
};

const fileMap = new Map<string, FileRecord>();

export const setFile = (fileId: string, record: FileRecord) => {
  fileMap.set(fileId, record);
};

export const getFile = (fileId: string) => {
  return fileMap.get(fileId);
};

export const deleteFile = (fileId: string) => {
  fileMap.delete(fileId);
};

export const hasFile = (fileId: string) => {
  return fileMap.has(fileId);
};
