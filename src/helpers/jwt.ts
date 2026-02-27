import jwt from 'jsonwebtoken';
import appConfig from '../config/env';

export default class JWT {
  private static readPublicKey(): string {
    return appConfig.jwt.secret;
  }

  private static readPrivateKey(): string {
    return appConfig.jwt.secret;
  }

  public static encode(payload: any, expiresIn?: number): string {
    const cert = this.readPrivateKey();
    const options: jwt.SignOptions = {};

    if (!expiresIn) {
      options.expiresIn = Number(appConfig.jwt.expiresIn);
    } else if (expiresIn > 0) {
      options.expiresIn = expiresIn;
    } else {
      options.expiresIn = Number(appConfig.jwt.expiresIn);
    }

    const token = jwt.sign(payload, cert, options);
    return token;
  }

  public static decode(token: string): jwt.JwtPayload {
    const cert = this.readPublicKey();
    const decoded = jwt.verify(token, cert);
    if (typeof decoded === 'string') {
      throw new Error('Expected JWT payload to be an object');
    }
    return decoded as jwt.JwtPayload;
  }
}
