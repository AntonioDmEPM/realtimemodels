import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import KnowledgeBase from "./pages/KnowledgeBase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
            <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
            <Route path="/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
            <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
            <Route path="/knowledge-base" element={<ErrorBoundary><KnowledgeBase /></ErrorBoundary>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
