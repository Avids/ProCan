import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layouts and Pages
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import DashboardIndex from './pages/Dashboard/index';

// Feature Modules
import ProjectsIndex from './pages/Projects/index';
import ProjectDetail from './pages/Projects/ProjectDetail';
import PurchaseOrderIndex from './pages/PurchaseOrders/index';
import MaterialsIndex from './pages/Materials/index';
import VendorsIndex from './pages/Vendors/index';
import SubmittalsIndex from './pages/Submittals/index';
import RFIsIndex from './pages/RFIs/index';
import EmployeesPage from './pages/Employees/index';
import ProjectDirectory from './pages/ProjectDirectory';
import EVMIndex from './pages/EVM/index';

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardIndex />} />
              
              <Route path="projects" element={<ProjectsIndex />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="evm" element={<EVMIndex />} />
              <Route path="project-directory" element={<ProjectDirectory />} />
              
              <Route path="vendors" element={<VendorsIndex />} />
              <Route path="purchase-orders" element={<PurchaseOrderIndex />} />
              <Route path="materials" element={<MaterialsIndex />} />
              <Route path="submittals" element={<SubmittalsIndex />} />
              <Route path="rfis" element={<RFIsIndex />} />
              <Route path="employees" element={<EmployeesPage />} />
            </Route>

            {/* Catch-all 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
