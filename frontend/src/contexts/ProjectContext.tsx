import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

export interface ProjectOption {
  id: string;
  name: string;
  projectNumber: string;
}

interface ProjectContextType {
  activeProject: ProjectOption | null;
  setActiveProject: (project: ProjectOption | null) => void;
  availableProjects: ProjectOption[];
  isLoadingProjects: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [activeProject, setActiveProjectState] = useState<ProjectOption | null>(null);
  const [availableProjects, setAvailableProjects] = useState<ProjectOption[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Load active project from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('activeProject');
    if (saved) {
      try {
        setActiveProjectState(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved project', e);
      }
    }
  }, []);

  // Fetch available projects for this user
  useEffect(() => {
    const fetchProjects = async () => {
      if (!token || !user) return;
      setIsLoadingProjects(true);
      try {
        // Technically this gets all projects. If we had user-specific filtering, 
        // the backend /projects endpoint could handle it based on token.
        const res = await api.get('/projects');
        setAvailableProjects(res.data);
      } catch (error) {
        console.error('Failed to fetch user projects', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [token, user]);

  const setActiveProject = (project: ProjectOption | null) => {
    setActiveProjectState(project);
    if (project) {
      localStorage.setItem('activeProject', JSON.stringify(project));
    } else {
      localStorage.removeItem('activeProject');
    }
  };

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject, availableProjects, isLoadingProjects }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
