// Get the base path for the application
export const basePath = process.env.NODE_ENV === "production" ? "/MAMIP" : "";

// Helper to get data URLs
export const getDataUrl = (path: string) => `${basePath}/data/${path}`;
