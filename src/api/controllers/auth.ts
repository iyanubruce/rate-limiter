import UserRepository from "../../database/repositories/user";
import TenantRepository from "../../database/repositories/tenant";
import JWT from "../../helpers/jwt";
import { db } from "../../config/database";
import { BadRequestError } from "../../error";
import bcrypt from "bcrypt";
import config from "../../config/env";
const userRepository = new UserRepository(db());
const tenantRepository = new TenantRepository(db());
export const register = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  organizationEmail: string,
  organizationName: string,
) => {
  const existingUser = await userRepository.getUserByEmail(email);
  const existingTenant = await tenantRepository.getTenant({
    email: organizationEmail,
  });

  if (existingUser) {
    throw new BadRequestError("User already exists");
  }

  if (existingTenant)
    throw new BadRequestError("Tenant with email already exists");

  const hashedPassword = bcrypt.hashSync(password, 10);

  const { tenant, user } = await db().transaction(async (transaction) => {
    const tenant = await tenantRepository.createTenant(
      {
        email: organizationEmail || email,
        name: organizationName,
      },
      transaction,
    );

    const user = await userRepository.createUser(
      {
        email,
        password: hashedPassword,
        firstName,
        tenantId: tenant!.id,
        lastName,
      },
      transaction,
    );
    return { tenant, user };
  });

  const { password: userPassword, ...safeUser } = user!;

  const token = JWT.encode({
    id: user?.id,
    tenantId: tenant!.id,
    email: user?.email,
    role: user?.role,
  });
  return { user: safeUser, token };
};

export const login = async (email: string, password: string) => {
  const user = await userRepository.getUserByEmail(email);

  if (!user) throw new BadRequestError("Invalid credentials");

  if (!(await bcrypt.compare(password, user.password || "")))
    throw new BadRequestError(`Invalid credentials.`);

  const { password: userPassword, ...safeUser } = user;
  const token = JWT.encode({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
  });
  return { user: safeUser, token };
};

export const refresh = async (refreshToken: string) => {
  const decoded = JWT.verify(refreshToken);
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
