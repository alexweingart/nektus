import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth/next";

export const getAuthSession = async () => {
  const session = await getServerSession(authOptions);
  return session;
};

export const getRequiredAuthSession = async () => {
  const session = await getAuthSession();
  if (!session?.user) {
    throw new Error("User not authenticated");
  }
  return session;
};
