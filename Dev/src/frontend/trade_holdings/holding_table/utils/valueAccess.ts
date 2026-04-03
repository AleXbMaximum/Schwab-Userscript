export const getVal = (d: any, path: string) => {
  const val = path.split(".").reduce((o: any, k: string) => o?.[k], d);
  if (val != null && typeof val === "object" && "parsedValue" in val) {
    return (val as any).parsedValue;
  }
  return val;
};
