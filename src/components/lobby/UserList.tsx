"use client";

import React from 'react';

interface User {
  id: string | number;
  username: string;
  color?: string;
}

interface UserListProps {
  users: User[];
}

const UserList: React.FC<UserListProps> = ({ 
  users = [
    { id: 1, username: "사용자1", color: "purple-300" },
    { id: 2, username: "사용자2", color: "green-300" },
    { id: 3, username: "사용자3", color: "blue-300" }
  ] 
}) => {
  return (
    <div className="flex-grow p-4 overflow-y-auto">
      <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        접속자 목록
      </h2>
      
      <div className="space-y-2">
        {users.map(user => (
          <div key={user.id} className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors text-sm flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs overflow-hidden">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className={`w-5 h-5 text-${user.color || 'white'}`}
              >
                <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span>{user.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList; 