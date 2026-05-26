import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/Home";
import Room from "./pages/Room";
import Rules from "./pages/Rules";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/rooms/:id" element={<Room />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    <Toaster />
  </StrictMode>
);
