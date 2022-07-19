export default async (name: string, { size }): Promise<string> => {
  return `
  <svg viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>
  </svg>`;
};
