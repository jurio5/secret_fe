'use client'

export interface RoleData {
  role: string;
}

export const getRoleFromCookie = (): RoleData | null => {
  if (typeof window === 'undefined') return null;
  
  const cookies = document.cookie.split("; ");
  const encodedRoleCookie = cookies.find((cookie) => cookie.startsWith("role="));
  
  if(!encodedRoleCookie) return null;

  const encodedRole = encodedRoleCookie.split("=")[1];
  const decodedRole = decodeURIComponent(encodedRole);
  const roleData = JSON.parse(decodedRole);
  console.log(roleData);
  
  return {
    role: roleData.role
  }
};
