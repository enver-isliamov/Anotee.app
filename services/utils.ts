
/**
 * Generates a robust unique identifier (UUID v4 style).
 * Falls back to timestamp+random if crypto is not available.
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Checks if a timestamp is older than X days
 */
export const isExpired = (timestamp: number, days: number = 7): boolean => {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  return (now - timestamp) > (days * msPerDay);
};

export const getDaysRemaining = (timestamp: number, days: number = 7): number => {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const expirationDate = timestamp + (days * msPerDay);
    const diff = expirationDate - now;
    return Math.max(0, Math.ceil(diff / msPerDay));
};

/**
 * Generates a deterministic pastel color from a string (UserId).
 */
export const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // HSL colors are better for distinctive but pleasant UI colors
  // Use hash to pick Hue (0-360)
  const h = Math.abs(hash % 360);
  // Fixed Saturation and Lightness for consistency
  return `hsl(${h}, 70%, 60%)`; 
};
