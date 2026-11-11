// Shared by the picker, drag-and-drop validation and filename metadata fallback.
export const MEDIA_EXTENSIONS = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'aif', 'mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'wmv', 'ogv', '3gp'];
export const MEDIA_ACCEPT = MEDIA_EXTENSIONS.map(extension => `.${extension}`).join(',');
export const MEDIA_FORMAT_LABEL = MEDIA_EXTENSIONS.map(extension => extension.toUpperCase()).join(', ');
export function isMediaFile(file) {
  return MEDIA_EXTENSIONS.includes(file.name.split('.').pop().toLowerCase()) && file.name.includes('.');
}
export function stripMediaExtension(name) {
  return isMediaFile({ name }) ? name.slice(0, name.lastIndexOf('.')) : name;
}
