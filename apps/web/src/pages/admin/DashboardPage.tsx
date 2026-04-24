import React from "react";
import { useAuth } from "../../context/AuthContext";

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button
          onClick={() => {
            void logout();
          }}
          className="text-red-500 hover:underline text-sm"
        >
          Đăng xuất
        </button>
      </div>
      <p className="text-gray-500">Xin chào organizer {user?.fullName}</p>
    </div>
  );
};
