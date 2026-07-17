export interface JwtPayload {
  sub: string;
  role: 'guest' | 'user' | 'admin';
}

export interface AuthenticatedUser {
  userId: string;
  role: JwtPayload['role'];
}

