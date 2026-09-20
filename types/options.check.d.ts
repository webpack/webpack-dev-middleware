export = validate10;
declare function validate10(
  data: any,
  {
    instancePath,
    parentData,
    parentDataProperty,
    rootData,
  }?: {
    instancePath?: string | undefined;
    rootData?: any;
  },
): boolean;
declare namespace validate10 {
  export { validate10 as default };
}
