import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Role = 'founder' | 'candidate';

interface RoleContextValue {
  role: Role;
  toggleRole: () => void;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>('founder');

  const toggleRole = useCallback(() => {
    setRoleState((prev) => (prev === 'founder' ? 'candidate' : 'founder'));
  }, []);

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole);
  }, []);

  return (
    <RoleContext.Provider value={{ role, toggleRole, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
