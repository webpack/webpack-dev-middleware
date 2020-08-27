const resGetHeader = (res, header) => {
  if (res.get) {
    return res.get(header);
  }
  return res.getHeader(header);
};
const resSetHeader = (res, header, value) => {
  if (res.set) {
    return res.set(header, value);
  }
  return res.setHeader(header, value);
};

export default { resGetHeader, resSetHeader };
