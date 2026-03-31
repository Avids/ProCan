import { prisma } from '../utils/db';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt';

export const loginEmployee = async (email: string, passwordString: string) => {
  const user = await prisma.employee.findUnique({
    where: { email },
  });

  if (!user || (!user.isActive)) {
    throw new Error('Invalid credentials or inactive user');
  }

  const isMatch = await bcrypt.compare(passwordString, user.password);
  
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // Generate JWT token
  const token = generateToken({ id: user.id, email: user.email, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      position: user.position
    }
  };
};

export const getEmployeeData = async (userId: string) => {
  return await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      position: true,
      isActive: true,
    }
  });
};
