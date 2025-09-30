import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AXIOS_INSTANCE } from './api/mutator/custom-instance';
type Dispatch = (Auth: string) => void;

type AuthProviderProps = { children: ReactNode; initialState?: string | null };

const AuthContext = createContext<string | null>(null);
const AuthDispatchContext = createContext<Dispatch | null>(null);

const AuthProvider = ({ children, initialState = null }: AuthProviderProps) => {
  // it's a quick demo with useState but you can also have a more complexe state with a useReducer
  const [token, setToken] = useState(initialState);

  useEffect(() => {
    const interceptorId = AXIOS_INSTANCE.interceptors.request.use((config) => ({
      ...config,
      headers: token
        ? {
            ...config.headers,
            Authorization: `Bearer ${token}`,
          }
        : config.headers,
    }));

    return () => {
      AXIOS_INSTANCE.interceptors.request.eject(interceptorId);
    };
  }, [token]);

  return (
    <AuthContext.Provider value={token}>
      <AuthDispatchContext.Provider value={setToken}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthContext.Provider>
  );
};

const useAuth = (): string | null => {
  return useContext<string | null>(AuthContext);
};

const useAuthDispatch = (): Dispatch => {
  const context = useContext<Dispatch | null>(AuthDispatchContext);

  if (context === null) {
    throw new Error('useAuthDispatch must be used within a AuthProvider');
  }
  return context;
};

export { AuthProvider, useAuth, useAuthDispatch };
