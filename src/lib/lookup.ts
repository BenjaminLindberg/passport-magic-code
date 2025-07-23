export const lookup = (objects: any[], key: string) => {
  for (let i = 0; i < objects.length; i++) {
    if (objects[i] && key in objects[i]) {
      const obj = objects[i];
      return obj[key as keyof typeof obj];
    }
  }
};
