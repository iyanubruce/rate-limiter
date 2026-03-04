import { UserRepository } from "../../database/repositories/user";
import JWT from "../../helpers/jwt";
import { db } from "../../config/database";
import logger from "../../utils/logger";
import { BadRequestError } from "../../error";
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

  const user = await userRepository.createUser(
    email,
    password,
    firstName,
    lastName,
  );

  const token = JWT.encode({
    id: user?.id,
    email: user?.email,
    role: user?.role,
  });
  return { user, token };
};

export const googleAuth = async (
  googleId: string,
  email: string,
  first_name: string,
  last_name: string,
) => {
  const user = await userRepository.findOrCreateGoogleUser(
    googleId,
    email,
    first_name,
    last_name,
  );
  const token = JWT.encode({
    id: user?.id,
    email: user?.email,
    role: user?.role,
  });
  return { user, token };
};

export const login = async (email: string, password: string) => {
  const user = await userRepository.getUserByEmail(email);
  if (!user) {
    throw new BadRequestError("Invalid credentials");
  }
  const token = JWT.encode({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  return { user, token };
};
