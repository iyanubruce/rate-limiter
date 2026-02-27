import { UserRepository } from "../../database/repositories/user";
import JWT from "../../helpers/jwt";
import { db } from "../../config/database";
import logger from "../../utils/logger";

const userRepository = new UserRepository(db());

export const register = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
) => {
  try {
    const existingUser = await userRepository.getUserByEmail(email);
    if (existingUser) {
      throw new Error("User already exists");
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
  } catch (error) {
    logger.error(error);
    return { error: "Internal server error" };
  }
};

export const googleAuth = async (
  googleId: string,
  email: string,
  first_name: string,
  last_name: string,
) => {
  try {
    const user = await userRepository.findOrCreateGoogleUser(
      googleId,
      email,
      first_name,
      last_name,
    );
    if (!user) {
      return { error: "User already exists" };
    }
    const token = JWT.encode({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return { user, token };
  } catch (error) {
    logger.error(error);
    return { error: "Internal server error" };
  }
};
