/* eslint-disable @typescript-eslint/no-unsafe-return */

export const serializerObject = <T = object>(object: T) => {
  return JSON.stringify(object, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  });
};
