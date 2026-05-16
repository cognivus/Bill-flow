import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User, Business } from "@/types";

interface AuthState {
  user: User | null;
  business: Business | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasBusiness: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setBusiness: (business: Business | null) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      business: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasBusiness: false,

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      setBusiness: (business) => {
        set({ business, hasBusiness: !!business });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
        set({
          user: null,
          business: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          hasBusiness: false,
        });
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    {
      name: "billflow-auth",
      partialize: (state) => ({
        user: state.user,
        business: state.business,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        hasBusiness: state.hasBusiness,
      }),
    }
  )
);
