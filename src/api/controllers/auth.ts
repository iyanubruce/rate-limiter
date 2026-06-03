import UserRepository from "../../database/repositories/user";
import JWT from "../../helpers/jwt";
import { db } from "../../config/database";
import { BadRequestError } from "../../error";
import bcrypt from "bcrypt";
import config from "../../config/env";
const userRepository = new UserRepository(db());

export const register = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
) => {
  const existingUser = await userRepository.getUserByEmail(email);

  if (existingUser) {
    throw new BadRequestError("User already exists");
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  const user = await userRepository.createUser({
    email,
    password: hashedPassword,
    firstName,
    lastName,
  });
  const { password: userPassword, ...safeUser } = user as any;

  const token = JWT.encode({
    id: user?.id,
    email: user?.email,
    role: user?.role,
  });
  return { user: safeUser, token };
};

export const googleAuth = async (
  googleId: string,
  email: string,
  firstName: string,
  lastName: string,
) => {
  const user = await userRepository.findOrCreateGoogleUser({
    googleId,
    email,
    firstName,
    lastName,
  });
  const { password, google_id, ...safeUser } = user as any;
  const token = JWT.encode({
    id: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
  });
  return { user: safeUser, token };
};

export const login = async (email: string, password: string) => {
  const user = await userRepository.getUserByEmail(email);

  if (!user) throw new BadRequestError("Invalid credentials");

  if (!(await bcrypt.compare(password, user.password || "")))
    throw new BadRequestError(`Invalid credentials.`);

  const { password: userPassword, google_id, ...safeUser } = user;
  console.log(safeUser);
  const token = JWT.encode({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  return { user: safeUser, token };
};

export const refresh = async (refreshToken: string) => {
  const decoded = JWT.verify(refreshToken);
  console.log(decoded);
  const user = await userRepository.findById(decoded.id);

  if (!user) {
    throw new BadRequestError("Invalid refresh token");
  }
  const token = JWT.encode({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  return { token, expiresIn: config.jwt.expiresIn };
};
