const bcrypt = require('bcrypt');
const saltRounds = 10;

export const encrypt = (password: string) => {
  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(password, salt);
};

export const compareEncrypts = (password: string, hash: string) => {
  return bcrypt.compareSync(password, hash);
};