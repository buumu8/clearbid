import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import UploadPage from './pages/UploadPage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import DecisionPage from './pages/DecisionPage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import PublicPortal from './pages/PublicPortal.jsx';

import LandingPage from './pages/LandingPage.jsx';

export default function App() {
  return (
    <div>
      <header className="topbar">

        <Link to="/" className="brand">

          <img src="/logo.svg" alt="" />

          ClearBid

        </Link>

        <nav>

          <NavLink to="/officer/new">New purchase</NavLink>

          <NavLink to="/public">Public portal</NavLink>

        </nav>

      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/officer/new" element={<UploadPage />} />
          <Route path="/officer/:id/review" element={<ReviewPage />} />
          <Route path="/officer/:id/decide" element={<DecisionPage />} />
          <Route path="/officer/:id/report" element={<ReportPage />} />
          <Route path="/public" element={<PublicPortal />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}